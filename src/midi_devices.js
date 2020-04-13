const NOTE_ON_EVENT = 144
const NOTE_OFF_EVENT = 128

export default class {
  constructor(noteOnCallback, noteOffCallback) {
    this.enabled = false
    this.devices = []
    this.noteOnCallback = noteOnCallback
    this.noteOffCallback = noteOffCallback

    if (navigator.requestMIDIAccess) {
      this.enabled = true

      const self = this
      navigator.requestMIDIAccess()
        .then(function(midiAccess) {
          for (let input of midiAccess.inputs.values()) {
            self.devices.push({
              id: input.id,
              name: input.name
            })

            input.onmidimessage = self.onMidiMessage.bind(self)
          }
        })
    }
  }

  onMidiMessage(message) {
    if (message.data[0] === NOTE_ON_EVENT) {
      this.noteOnCallback(message.target.name, message.data[1])
    } else if (message.data[0] === NOTE_OFF_EVENT) {
      this.noteOffCallback(message.target.name, message.data[1])
    }
  }
}