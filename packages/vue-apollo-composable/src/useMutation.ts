import { DocumentNode } from 'graphql'
import { MutationOptions, OperationVariables, FetchResult, TypedDocumentNode, ApolloError, ApolloClient } from '@apollo/client/core/index.js'
import { ref, onScopeDispose, Ref, getCurrentScope, shallowRef, nextTick, MaybeRefOrGetter, toValue } from 'vue-demi'
import { useApolloClient } from './useApolloClient'
import { useEventHook } from './util/useEventHook'
import { trackMutation } from './util/loadingTracking'
import { toApolloError } from './util/toApolloError'

/**
 * `useMutation` options for mutations that don't require `variables`.
 */
export interface UseMutationOptions<
  TResult = any,
  TVariables = OperationVariables
> extends Omit<MutationOptions<TResult, TVariables>, 'mutation'> {
  clientId?: string
  throws?: 'auto' | 'always' | 'never'
}

type DocumentParameter<TResult, TVariables> = DocumentNode | TypedDocumentNode<TResult, TVariables>
type OptionsParameter<TResult, TVariables> = UseMutationOptions<TResult, TVariables>

export type MutateOverrideOptions<TResult> = Pick<UseMutationOptions<TResult, OperationVariables>, 'update' | 'optimisticResponse' | 'context' | 'updateQueries' | 'refetchQueries' | 'awaitRefetchQueries' | 'errorPolicy' | 'fetchPolicy' | 'clientId'>
export type MutateResult<TResult> = Promise<FetchResult<TResult, Record<string, any>, Record<string, any>> | null>
export type MutateFunction<TResult, TVariables> = (variables?: TVariables | null, overrideOptions?: MutateOverrideOptions<TResult>) => MutateResult<TResult>

export interface OnDoneContext {
  client: ApolloClient<any>
}

export interface OnErrorContext {
  client: ApolloClient<any>
}

export interface UseMutationReturn<TResult, TVariables> {
  mutate: MutateFunction<TResult, TVariables>
  loading: Ref<boolean>
  error: Ref<ApolloError | null>
  called: Ref<boolean>
  onDone: (fn: (param: FetchResult<TResult, Record<string, any>, Record<string, any>>, context: OnDoneContext) => void) => {
    off: () => void
  }
  onError: (fn: (param: ApolloError, context: OnErrorContext) => void) => {
    off: () => void
  }
}

export function useMutation<
  TResult = any,
  TVariables extends OperationVariables = OperationVariables
> (
  document: MaybeRefOrGetter<DocumentParameter<TResult, TVariables>>,
  options: MaybeRefOrGetter<OptionsParameter<TResult, TVariables>> = {},
): UseMutationReturn<TResult, TVariables> {
  const currentScope = getCurrentScope()
  const loading = ref<boolean>(false)
  currentScope && trackMutation(loading)
  const error = shallowRef<ApolloError | null>(null)
  const called = ref<boolean>(false)

  const doneEvent = useEventHook<[FetchResult<TResult, Record<string, any>, Record<string, any>>, OnDoneContext]>()
  const errorEvent = useEventHook<[ApolloError, OnErrorContext]>()

  // Apollo Client
  const { resolveClient } = useApolloClient()

  async function mutate (variables?: TVariables | null, overrideOptions: Omit<UseMutationOptions<TResult, TVariables>, 'variables'> = {}) {
    const currentDocument: DocumentNode = toValue(document)
    const currentOptions: UseMutationOptions<TResult, TVariables> = toValue(options)

    const client = resolveClient(currentOptions.clientId)
    error.value = null
    loading.value = true
    called.value = true
    try {
      const result = await client.mutate<TResult, TVariables>({
        mutation: currentDocument,
        ...currentOptions,
        ...overrideOptions,
        variables: (variables ?? currentOptions.variables)
          ? {
            ...(currentOptions.variables as TVariables),
            ...(variables as TVariables),
          }
          : undefined,
      })
      loading.value = false
      await nextTick()
      doneEvent.trigger(result, {
        client,
      })
      return result
    } catch (e) {
      const apolloError = toApolloError(e)
      error.value = apolloError
      loading.value = false
      errorEvent.trigger(apolloError, {
        client,
      })
      if (currentOptions.throws === 'always' || (currentOptions.throws !== 'never' && !errorEvent.getCount())) {
        throw apolloError
      }
    }
    return null
  }

  currentScope && onScopeDispose(() => {
    loading.value = false
  })

  return {
    mutate,
    loading,
    error,
    called,
    onDone: doneEvent.on,
    onError: errorEvent.on,
  }
}
