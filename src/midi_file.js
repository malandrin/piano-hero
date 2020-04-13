export default class {
  constructor(fileContent) {
    this.tempo = 500000  // default 120 bpm
    this.songName = ''
    this.parseFile(fileContent)
  }

  parseFile(fileContent) {
    let fileOffset = 0
    let textDecoder = new TextDecoder()

    const readString = function (length) {
      const value = textDecoder.decode(fileContent.slice(fileOffset, fileOffset + length))
      fileOffset += length
      return value
    }

    const readNumber = function(length) {
      length = length || 1

      let value = 0
      for (let i = 0; i < length; ++i) {
        value = (value << 8) + fileContent[fileOffset + i]
      }

      fileOffset += length
      return value
    }

    const readVariableLength = function() {
      let value = fileContent[fileOffset++]

      if (value & 0x80) {
        value &= 0x7f
        let nextValue = 0

        do {
          nextValue = fileContent[fileOffset++]
          value = (value << 7) + (nextValue & 0x7f)
        } while (nextValue & 0x80)
      }

      return value
    }

    if (readString(4) !== 'Mthd' && readNumber(4) !== 6) {
      return null
    }

    this.formatType = readNumber(2)
    this.numberOfTracks = readNumber(2)
    this.events = []

    const timeDivision = readNumber(2)
    const ticksPerBeat = (timeDivision & 0x7fff)

    this.ticksPerBeat = ticksPerBeat

    let quarterNoteRatio = 1

    for (let i = 0; i < this.numberOfTracks; ++i) {
      if (readString(4) !== 'MTrk') {
        return null
      }

      readNumber(4) // track size

      let trackEnd = false
      let globalTicks = 0

      while (!trackEnd) {
        globalTicks += readVariableLength()
        const eventTime = (this.tempo * globalTicks * quarterNoteRatio / ticksPerBeat) / 1000000 // microseconds to seconds
        const eventData = readNumber()

        if (eventData === 0xff) {  // meta event
          const eventType = readNumber()

          switch (eventType) { // event type
            case 0x01: {  // text
              readString(readVariableLength())
            }
            break

            case 0x03: {  // track name
              const trackName = readString(readVariableLength()).trim()

              if (trackName) {
                this.songName = trackName
              }
            }
            break

            case 0x2f: {  // end of track
              readVariableLength()
              trackEnd = true
            }
            break

            case 0x51: {  // set tempo
              this.tempo = readNumber(readVariableLength())
            }
            break

            case 0x58: {  // time signature
              readVariableLength()
              const numer = readNumber()
              const denom = readNumber()
              readNumber(2)
              quarterNoteRatio = numer / Math.pow(2, denom)
            }
            break

            case 0x59: {  // key signature
              readVariableLength()
              readNumber(2)
            }
            break
          }
        } else {
          const eventType = eventData >> 4

          switch(eventType) {
            case 0x08: {  // note off
              readNumber(2)
            }
            break

            case 0x09: {  // note on
              this.events.push({
                time: eventTime,
                noteNumber: readNumber(),
                velocity: readNumber()
              })
            }
            break

            case 0x0b: {  // controller event
              readNumber(2)
            }
            break

            case 0x0c: {  // program change
              readNumber()
            }
            break

            default:
              /* eslint-disable no-console */
              console.log(`event: ${eventType} not supported`)
              /* eslint-enable no-console */
              break
          }
        }
      }
    }

    this.events.sort()
  }
}