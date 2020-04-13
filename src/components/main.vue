<template>
  <div class="main columns is-gapless">
    <div class="menu column is-narrow">
      <div class="title is-2">Piano Hero</div>
      <div class="songName">{{midiFile ? midiFile.songName : ''}}</div>

      <b-field label="Speed" v-bind:horizontal="true" v-bind:style="{'padding-left': '20px', 'padding-right': '20px'}">
        <b-slider type="is-primary" size="is-large" v-model="songSpeed" v-bind:min="0.25" v-bind:max="2" v-bind:value="1" v-bind:step="0.25" ticks/>
      </b-field>

      <b-field label="Pianola" v-bind:horizontal="true" v-bind:style="{'padding-left': '20px', 'padding-right': '20px'}">
        <b-switch v-bind:rounded="false" type="is-primary" v-model="inPianolaMode"/>
      </b-field>

      <b-field label="MIDI Device" v-bind:horizontal="true" v-bind:style="{'padding-left': '20px', 'padding-right': '20px'}">
          <b-dropdown
            v-bind:disabled="midiDevices.devices.length === 0"
            v-model="midiDeviceSelected"
            aria-role="list"
          >
            <button class="button is-primary" slot="trigger" slot-scope="{ active }">
                <span>{{midiDeviceSelected !== null ? midiDeviceSelected : 'Select a device'}}</span>
                <b-icon :icon="active ? 'menu-up' : 'menu-down'"></b-icon>
            </button>

            <b-dropdown-item
              v-for="device in midiDevices.devices"
              v-bind:value="device.name"
              v-bind:key="device.id"
              aria-role="listitem"
            >
              {{device.name}}
            </b-dropdown-item>
        </b-dropdown>
      </b-field>

      <b-field class="file">
        <b-upload v-on:input="loadMidiFile">
          <a class="button is-primary">
            <span>Load Song</span>
          </a>
        </b-upload>
      </b-field>

      <button class="button is-primary" v-on:click="loadFurElise">
        <span>Load Fur Elise</span>
      </button>

      <div class="buttons">
        <b-button
          type="is-primary"
          size="is-large"
          v-bind:disabled="!midiFile || gameState === 2 || gameState === 3"
          v-on:click="playSong"
        >
          &#9654;
        </b-button>

        <b-button
          type="is-primary"
          size="is-large"
          v-bind:disabled="!midiFile || gameState === 1 || gameState === 4"
          v-on:click="pauseSong"
        >
          &#10074;&#10074;
        </b-button>

        <b-button
          type="is-primary"
          size="is-large"
          v-bind:disabled="!midiFile || gameState === 1 || gameState === 4"
          v-on:click="stopSong"
        >
          &#9724;
        </b-button>
      </div>
    </div>
    <div class="content column">
      <div
        class="columns is-gapless"
        v-bind:style="{'height': 'calc(100% - 200px)'}"
      >
        <div class="notesColumns column" ref="notesColumns">
          <div class="columns is-centered is-gapless">
            <div
              v-for="(column, cindex) in notesColumns"
              v-bind:key="`notesColumn_${cindex}`"
              v-bind:class="{notesColumn: !column.isNarrow, narrowNotesColumn: column.isNarrow}"
              v-bind:style="{'margin-left': getMarginLeftNotesColumn(cindex)}"
            >
              <div
                class="note"
                v-for="(time, nindex) in column.visibleNotes"
                v-bind:key="`note_${cindex}_${nindex}`"
                v-bind:style="{top: getScreenYPosByTime(time)}"
              />
              <div class="dropArea"/>
            </div>
          </div>
        </div>
      </div>
      <div class="keyboard columns is-centered is-gapless">
        <div
          v-for="(key, index) in keys"
          v-bind:key="key[0] + key[1]"
          v-bind:class="{whiteKey: isWhiteKey(key[0]), blackKey: !isWhiteKey(key[0]), pressed: isKeyPressed(key[0], key[1])}"
          v-bind:style="{'margin-left': getMarginLeftNotesColumn(index)}"
          v-on:mousedown="playNote(key[0], key[1])"
        >
          <div class="keySign">{{getKeySign(key[0], key[1])}}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Vue from 'vue'
import MidiDevices from '@/midi_devices'
import MidiFile from '@/midi_file'
import Synth from 'worklet-loader!@/synth.js'

const BLACK_KEY_WIDTH = 22
const NOTE_HEIGHT = 38
const VISIBILITY_RANGE = 5 // seconds
const OCTAVE_BASE = 2
const NOTE_EXTRA_TIME = 0.3 // seconds = extra time before note is computed as missing
const MIDI_VALUE_C2 = 36
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NOTES_FREQUENCY = { 'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.0, 'G#': 415.3, 'A': 440.0, 'A#': 466.16, 'B': 493.88 }

const KEYS_MAPPING = {
  'Q': ['A', 2],
  'W': ['B', 2],
  'E': ['C', 3],
  'R': ['D', 3],
  'T': ['E', 3],
  'Y': ['F', 3],
  'U': ['G', 3],
  'I': ['A', 3],
  'O': ['B', 3],
  '8': ['G#', 3],
  'Z': ['C', 4],
  'X': ['D', 4],
  'C': ['E', 4],
  'V': ['F', 4],
  'B': ['G', 4],
  'N': ['A', 4],
  'M': ['B', 4],
  ',': ['C', 5],
  '.': ['D', 5],
  '-': ['E', 5],
  'H': ['G#', 4],
  'L': ['C#', 5],
  'Ñ': ['D#', 5]
}

const COUNTDOWN_TIME = 3 // seconds
const GAME_STATE = {
  idle: 1,
  countdown: 2,
  playing: 3,
  paused: 4
}

export default {
  name: 'Keyboard',
  data: function() {
    let octave = 2
    let keys = []

    for (let o = 0; o < 4; ++o) {
      for (const n of NOTES) {
        keys.push([n, octave])
      }

      ++octave
    }

    let notesColumns = []

    for (let k of keys) {
      notesColumns.push({
        isNarrow: !this.isWhiteKey(k[0]),
        notes: [],
        visibleNotes: [],
        startNotesIdx: 0
      })
    }

    return {
      keys: keys,
      keysPressed: {},
      notesColumns: notesColumns,
      prevGameState: null,
      gameState: GAME_STATE.idle,
      midiFile: null,
      midiDevices: new MidiDevices(this.onDeviceKeyDown, this.onDeviceKeyUp),
      midiDeviceSelected: null,
      songSpeed: 1,
      inPianolaMode: false,
      stats: {
        perfect: 0,
        good: 0,
        bad: 0
      }
    }
  },
  created: function() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    this.start = Date.now()
    this.playTime = 0
    this.prevPlayTime = 0
    this.animFrameId = window.requestAnimationFrame(this.tick)

    this.$buefy.dialog.alert({
      title: 'Welcome!',
      message: "Piano Hero enables you to play the piano freely or following a pattern. It´s just an experiment, so probably it contains some bugs.",
      onConfirm: this.onWelcomeDialogClosed
    })
  },
  destroyed: function() {
    if (this.animFrameId) {
      window.cancelAnimationFrame(this.animFrameId)
    }

    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('keydown', this.onKeyDown)
  },
  methods: {
    tick: function() {
      const current = Date.now()
      const delta = ((current - this.start) / 1000) * this.songSpeed

      this.start = current

      switch (this.gameState) {
        case GAME_STATE.countdown:
          this.computeNotesState()
          this.playTime += delta
          this.timer -= delta

          if (this.timer <= 0) {
            this.setGameState(GAME_STATE.playing)
          }
          break

        case GAME_STATE.playing:
          this.computeNotesState()
          this.computeMissingNotes()

          if (this.inPianolaMode) {
            const self = this
            for (const column of this.notesColumns) {
              for (const note of column.notes) {
                if ((this.playTime >= note.time) && (note.time > this.prevPlayTime)) {
                  this.onNoteOn(note.note, note.octave)
                  setTimeout(() => self.onNoteOff(note.note, note.octave), 200)
                }
              }
            }
          }

          this.prevPlayTime = this.playTime
          this.playTime += delta

          if (this.playTime > this.lastNoteTime + NOTE_EXTRA_TIME) {
            this.stopSong()

            if (!this.inPianolaMode) {
              this.$buefy.dialog.alert({
                title: 'Game Over',
                message: `Notes - Perfect: ${this.stats.perfect} | Good: ${this.stats.good} | Bad: ${this.stats.bad}`
              })
            }
          }
          break
      }

      this.animFrameId = window.requestAnimationFrame(this.tick)
    },
    initAudio: function() {
      this.audioContext = new window.AudioContext()

      const self = this
      this.audioContext.audioWorklet.addModule(Synth).then(() => {
        self.synthWorkletNode = new AudioWorkletNode(self.audioContext, 'synth-processor', {
          numberOfInputs: 0
        })
        self.synthWorkletNode.connect(self.audioContext.destination)
      })
    },
    isWhiteKey: function(note) {
      return note.length === 1
    },
    isKeyPressed: function(note, octave) {
      return this.keysPressed[this.getNoteId(note, octave)]
    },
    playNote: function(note, octave) {
      if (this.synthWorkletNode) {
        const freq = NOTES_FREQUENCY[note] * Math.pow(2, octave - 4)
        this.synthWorkletNode.port.postMessage(`playNote:${freq}`)
      }
    },
    onKeyDown: function(event) {
      const key = event.key.toUpperCase()
      if (key in KEYS_MAPPING) {
        const noteInfo = KEYS_MAPPING[key]
        this.onNoteOn(noteInfo[0], noteInfo[1])
      }
    },
    onKeyUp: function(event) {
      const key = event.key.toUpperCase()
      if (key in KEYS_MAPPING) {
        const noteInfo = KEYS_MAPPING[key]
        this.onNoteOff(noteInfo[0], noteInfo[1])
      }
    },
    onDeviceKeyDown: function(deviceName, midiNote)
    {
      if (deviceName === this.midiDeviceSelected) {
        const noteInfo = this.convertMidiNote(midiNote)
        this.onNoteOn(noteInfo.note, noteInfo.octave)
      }
    },
    onDeviceKeyUp: function(deviceName, midiNote)
    {
      if (deviceName === this.midiDeviceSelected) {
        const noteInfo = this.convertMidiNote(midiNote)
        this.onNoteOff(noteInfo.note, noteInfo.octave)
      }
    },
    onNoteOn: function(note, octave) {
      const noteId = this.getNoteId(note, octave)

      if (this.keysPressed[noteId]) {
        return
      }

      this.playNote(note, octave)
      Vue.set(this.keysPressed, noteId, true)

      if (this.gameState === GAME_STATE.playing && !this.inPianolaMode) {
        const notesColumnIdx = ((octave - OCTAVE_BASE) * NOTES.length) + NOTES.indexOf(note)
        for (const note of this.notesColumns[notesColumnIdx].notes) {
          if (note.processed) {
            continue
          }

          const diff = Math.abs(note.time - this.playTime)
          if (diff <= 0.5) {
            note.processed = true
            if (diff < 0.1) {
              ++this.stats.perfect
            } else {
              ++this.stats.good
            }
            break
          }
        }
      }
    },
    onNoteOff: function(note, octave) {
      Vue.set(this.keysPressed, this.getNoteId(note, octave), false)
    },
    convertMidiNote: function(midiNote) {
      // A piano has 88 keys and ours has 48. We should adjust the note to the octave in the range 2-5 (the note adjust can make the midi song sounds different)
      const noteBase = (midiNote - MIDI_VALUE_C2)
      let octave = OCTAVE_BASE + Math.floor(noteBase / 12)

      if (octave < OCTAVE_BASE) {
        octave = OCTAVE_BASE
      } else if (octave > 5) {
        octave = 5
      }

      // noteIdx is the note without the octave info (from C to B)
      const noteIdx = (noteBase - ((octave - OCTAVE_BASE) * 12))

      return {
        note: NOTES[noteIdx],
        noteIdx: noteIdx,
        octave: octave
      }
    },
    onMidiFileLoaded: function(midiContent) {
      this.midiFile = new MidiFile(midiContent)
      this.lastNoteTime = 0

      for (let noteColumn of this.notesColumns) {
        noteColumn.notes = []
        noteColumn.startNotesIdx = 0
        Vue.set(noteColumn, 'visibleNotes', [])
      }

      for (const event of this.midiFile.events) {
        const noteInfo = this.convertMidiNote(event.noteNumber)

        // noteGlobalIdx is the note in the screen piano (idx 0 = first key in the left). It is adjust to the range 0 - piano num keys
        let noteGlobalIdx = noteInfo.noteIdx + ((noteInfo.octave - OCTAVE_BASE) * 12)

        if (noteGlobalIdx >= this.notesColumns.length) {
          noteGlobalIdx = this.notesColumns.length - 1
        } else if (noteGlobalIdx < 0) {
          noteGlobalIdx = 0
        }

        const noteTime = event.time + 3  // 3 seconds before start to play the song

        if (noteTime > this.lastNoteTime) {
          this.lastNoteTime = noteTime
        }

        this.notesColumns[noteGlobalIdx].notes.push({
          note: noteInfo.note,
          octave: noteInfo.octave,
          time: event.time + 3,
          processed: false  // has been processed as missing, or perfect, etc
        })
      }
    },
    loadFurElise: function() {
      this.stopSong()

      const self = this
      let request = new XMLHttpRequest()

      request.open('GET', '/static/beethoven_fur_elise.mid', true)
      request.responseType = 'arraybuffer'

      request.onload = function() {
        if (request.response) {
          self.onMidiFileLoaded(new Uint8Array(request.response))
        }
      };

      request.send(null);
    },
    loadMidiFile: function(file) {
      this.stopSong()

      const reader = new window.FileReader()
      const self = this

      reader.onload = function(evt) {
        if (evt.target.readyState === FileReader.DONE) {
          self.onMidiFileLoaded(new Uint8Array(evt.target.result))
        }
      }
      reader.readAsArrayBuffer(file)
    },
    onWelcomeDialogClosed: function() {
      this.initAudio()
    },
    setGameState: function(state) {
      this.prevGameState = this.gameState
      this.gameState = state

      switch(state) {
        case GAME_STATE.idle:
          for (const column of this.notesColumns) {
            column.visibleNotes = []
          }
          break

        case GAME_STATE.countdown:
          this.timer = COUNTDOWN_TIME
          this.playTime = 0
          this.stats = {
            perfect: 0,
            good: 0,
            bad: 0
          }

          for (const column of this.notesColumns) {
            column.startNotesIdx = 0

            for (let note of column.notes) {
              note.processed = false
            }
          }
          break
      }
    },
    getKeySign: function(note, octave) {
      for (const key in KEYS_MAPPING) {
        const mapping = KEYS_MAPPING[key]

        if ((mapping[0] === note) && (mapping[1] === octave)) {
          return key
        }
      }

      return ''
    },
    getNoteId: function(note, octave) {
      return `${note}${octave}`
    },
    getScreenYPosByTime: function(time) {
      return `${((1 - ((time - this.playTime) / VISIBILITY_RANGE)) * this.$refs.notesColumns.clientHeight) - NOTE_HEIGHT}px`
    },
    getMarginLeftNotesColumn: function(index) {
      if (index === 0) {
        return '0px'
      }

      const column = this.notesColumns[index]
      const prevColumn = this.notesColumns[index - 1]
      if (column.isNarrow || prevColumn.isNarrow) {
        return `${-BLACK_KEY_WIDTH / 2}px`
      }

      return '0px'
    },
    computeMissingNotes: function() {
      if (this.inPianolaMode) {
        return
      }

      for (const noteColumns of this.notesColumns) {
        for (const note of noteColumns.notes) {
          if (note.processed) {
            continue
          }

          if (note.time < (this.playTime - NOTE_EXTRA_TIME)) {
            ++this.stats.bad
            note.processed = true
          }
        }
      }

    },
    computeNotesState: function() {
      const endTime = this.playTime + VISIBILITY_RANGE

      for (let column of this.notesColumns) {
        column.visibleNotes = []

        let idx = column.startNotesIdx
        while (idx < column.notes.length) {
          const time = column.notes[idx].time

          if (time >= this.playTime) {
            if (time <= endTime) {
              if (!column.notes[idx].processed) {
                column.visibleNotes.push(time)
              }
            } else {
              break  // no more visible notes
            }
          } else if (idx > column.startNotesIdx) {
            column.startNotesIdx = idx
          }

          ++idx
        }
      }
    },
    playSong: function() {
      switch (this.prevGameState) {
        case GAME_STATE.idle:
        case GAME_STATE.countdown:
          this.setGameState(GAME_STATE.countdown)
          break
        default:
          this.setGameState(GAME_STATE.playing)
          break
      }
    },
    pauseSong: function() {
      this.setGameState(GAME_STATE.paused)
    },
    stopSong: function() {
      this.setGameState(GAME_STATE.idle)
      this.prevGameState = GAME_STATE.idle
    }
  }
}
</script>

<style lang="less" scoped>
  .main {
    display: flex;
    height: 100%;
    background: white;

    .menu {
      width: 300px;

      .title {
        margin-top: 30px;
      }

      .songName {
        font-size: 20px;
        color: #FF6B3A;
        margin-top: -10px;
        margin-bottom: 10px;
        font-style: italic;
        height: 30px;
      }

      .file {
        display: block;
        margin-top: 50px;
      }

      .buttons {
        display: inline-block;
        margin-top: 30px;
      }
    }

    .content {
      .columns {
        margin-bottom: 0px;
      }

      .notesColumns {
        .columns {
          height: 100%;
        }

        .dropArea {
          position: absolute;
          bottom: 200px;
          width: 38px;
          height: 38px;
          background: #EFE0BC;
        }

        .notesColumn {
          width: 38px;
          height: 100%;
          overflow: hidden;
          background: black;
          border-right: 1px solid white;

          .note {
            position: absolute;
            height: 38px;
            width: 38px;
            border: 2px solid #EBDEC4;
            border-radius: 8px;
            background: #F05E3B;
            z-index: 2;
          }
        }

        .narrowNotesColumn {
          width: 22px;
          height: 100%;
          z-index: 1;
          background: black;

          .note {
            position: absolute;
            height: 38px;
            width: 22px;
            border: 2px solid #EBDEC4;
            border-radius: 6px;
            background: #4BAE8C;
            z-index: 2;
          }
        }
      }

      .keyboard {
        user-select: none;
        height: 185px;

        .whiteKey {
          width: 38px;
          height: 180px;
          border: 1px solid grey;
          border-bottom-left-radius: 6px;
          border-bottom-right-radius: 6px;
          background: white;
          cursor: pointer;
          box-shadow: 0px 5px 0 0 rgba(0, 0, 0, 0.2);
          transition: height 30ms linear, box-shadow 30ms linear;
          z-index: 2;

          &.pressed {
            height: 185px;
            box-shadow: none;
            transition: height 30ms linear, box-shadow 30ms linear;
            background: yellow;

            .keySign {
              bottom: 20px;
              transition: bottom 30ms linear;
            }
          }

          .keySign {
            position: absolute;
            bottom: 25px;
            color: black;
            width: 38px;
          }
        }

        .blackKey {
          width: 22px;
          height: 100px;
          background: black;
          border: 1px solid transparent;
          border-bottom-left-radius: 6px;
          border-bottom-right-radius: 6px;
          box-shadow: 0px 4px 0 0 rgba(0, 0, 0, 0.2);
          cursor: pointer;
          z-index: 3;
          transition: height 30ms linear, box-shadow 30ms linear;

          &.pressed {
            height: 105px;
            box-shadow: none;
            border: 1px solid grey;
            transition: height 30ms linear, box-shadow 30ms linear;
            background: yellow;

            .keySign {
              color: black;
              bottom: 95px;
              transition: bottom 30ms linear;
            }
          }

          .keySign {
            position: absolute;
            bottom: 100px;
            color: white;
            width: 22px;
          }
        }
      }
    }
  }
</style>
