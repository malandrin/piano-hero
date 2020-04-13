# piano-hero

## Description

This project tries to imitate the style of the "Guitar Hero" games. Features:

- Support for MIDI devices.
- Support for MIDI files as sheet music.
- Gameplay: you have to play the notes in the right moment. At the end of the song, you can see stats for perfect, good and bad notes.
- You can adjust the speed of the notes.
- Mode pianola: you can load a MIDI file and the app will play it for you.

This project is an experiment I did it to learn a bit more about the Web Audio API, MIDI files and Web MIDI API. As an experiment, it has some allowances:

- It has to work in Chrome. I haven't test it in any other browser.
- It has to look fine in my screen. This means it is not web responsive and I haven't test it in other resolutions or devices.
- The generated sounds haven't to be 'perfect'. I haven't spend many time to make the sounds as realistic as possible.
- It has to work with the MIDI device "ROLI LUMI" because it's the only I have.
- It has to work at least with the MIDI file: "Fur Elise" (I think this song is like the "Hello World!" for piano players:) The parser only supports the MIDI events presents in this file.

This project uses Vue.js and Buefy.

You can try it at: https://www.cesarbotana.com/apps/piano-hero/

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
