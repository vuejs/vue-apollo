<script lang="ts" setup>
import { useMutation, useQuery } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { computed, ref } from 'vue'
import MessageItem from './MessageItem.vue'

interface Channel {
  id: string
  label: string
}

const channelsQuery = useQuery<{ channels: Channel[] }>(gql`
  query channels {
    channels {
      id
      label
    }
  }
`)

const channels = computed(() => channelsQuery.result.value?.channels ?? [])

const selectedChannelId = ref<string | null>(null)

const selectedChannelQuery = useQuery(gql`
  query channel ($id: ID!) {
    channel (id: $id) {
      id
      label
      messages {
        id
        text
      }
    }
  }
`, () => ({
  id: selectedChannelId.value,
}), () => ({
  enabled: !!selectedChannelId.value,
}))

const addMessageMutation = useMutation(gql`
  mutation sendMessage ($input: AddMessageInput!) {
    message: addMessage (input: $input) {
      id
      text
    }
  }
`)

const selectedChannel = computed(() => selectedChannelQuery.result.value?.channel)

const newMessageText = ref('')

async function sendMessage () {
  if (!newMessageText.value.length) return

  const result = await addMessageMutation.mutate({
    input: {
      channelId: selectedChannelId.value,
      text: newMessageText.value,
    },
  })

  newMessageText.value = ''

  selectedChannelQuery.updateQuery(previousResult => ({
    ...previousResult,
    channel: {
      ...previousResult.channel,
      messages: [
        ...previousResult.channel.messages,
        result?.data.message,
      ],
    },
  }))
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex h-full">
      <div class="flex flex-col">
        <button
          v-for="channel of channels"
          :key="channel.id"
          class="channel-btn p-4"
          :class="{
            'bg-green-200': selectedChannelId === channel.id,
          }"
          @click="selectedChannelId = channel.id"
        >
          {{ channel.label }}
        </button>
      </div>

      <div
        v-if="selectedChannel"
        class="the-channel flex flex-col w-full h-full overflow-auto"
      >
        <div class="flex-none p-6 border-b border-gray-200 bg-white">
          # {{ selectedChannel.label }}
        </div>

        <div class="flex-1 overflow-y-auto">
          <MessageItem
            v-for="message of selectedChannel.messages"
            :key="message.id"
            :message="message"
            class="m-2"
          />
        </div>

        <div class="flex gap-x-2 p-4">
          <div class="border border-gray-200 rounded-lg bg-white flex-1">
            <input
              v-model="newMessageText"
              type="text"
              class="message-input w-full h-full bg-transparent px-3"
              placeholder="Type a message..."
            >
          </div>

          <button
            class="send-message-btn bg-green-200 py-3 px-4 rounded-lg"
            @click="sendMessage"
          >
            Send
          </button>
        </div>
      </div>

      <div
        v-else
        class="no-data"
      >
        No data
      </div>
    </div>
  </div>
</template>
