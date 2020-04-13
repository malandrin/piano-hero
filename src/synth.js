const TAU = Math.PI * 2
const ATTACK_TIME = 0.03  // seconds
const NOTE_LENGTH = 0.5   // seconds
const GLOBAL_VOLUME = 0.6

class SynthProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()

    this.playingNotes = []
    this.attackLen = sampleRate * ATTACK_TIME
    this.phaseInc = TAU / sampleRate

    this.port.onmessage = (e) => {
      const data = e.data

      if (data.indexOf('playNote') === 0) {
        const freq = parseFloat(data.substring(9))
        this.playNote(freq, NOTE_LENGTH)
      }
    }
  }

  playNote(freq, time) {
    this.playingNotes.push({
      freq: freq,
      len: sampleRate * time,
      wavePos: 0,
      envelope: {
        state: 'attack',
        pos: 0,
        attackLen: this.attackLen,
        decayLen: (sampleRate * time) - this.attackLen
      }
    })
  }

  process(inputs, outputs) {
    const outputChannel = outputs[0][0]
    const notes = this.playingNotes

    for (let i = 0; i < outputChannel.length; ++i) {
      for (let n = 0; n < notes.length; ++n) {
        const note = notes[n]
        const inAttackState = note.envelope.state === 'attack'
        let volume

        if (inAttackState) {
          volume = (note.envelope.pos / note.envelope.attackLen)
        } else {
          volume = 1.0 - (note.envelope.pos / note.envelope.decayLen)
        }

        outputChannel[i] += Math.sin(note.wavePos) * volume * 0.2

        note.wavePos += this.phaseInc * note.freq
        --note.len

        if (note.len <= 0) {
          continue
        }

        ++note.envelope.pos

        if (inAttackState && (note.envelope.pos >= note.envelope.attackLen)) {
          note.envelope.state = 'decay'
          note.envelope.pos = 0
        }
      }

      outputChannel[i] = Math.min(Math.max(outputChannel[i] * GLOBAL_VOLUME, -1), 1.0)
    }

    this.playingNotes = this.playingNotes.filter(n => n.len > 0)

    return true
  }
}

registerProcessor('synth-processor', SynthProcessor)