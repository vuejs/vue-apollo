const channels = [
  { id: 'general', name: 'General discussion' },
  { id: 'random', name: 'Have fun chatting!' },
  { id: 'help', name: 'Ask for or give help' },
]

exports.getAll = () => {
  return channels
}

exports.getOne = (id) => {
  return channels.find(c => c.id === id)
}
