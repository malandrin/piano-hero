<template>
  <div id="app">
    <MainView/>
  </div>
</template>

<script>
import MainView from './components/main.vue'

export default {
  name: 'app',
  components: {
    MainView
  }
}
</script>

<style>
@import url('https://fonts.googleapis.com/css?family=Source+Sans+Pro&display=swap');

#app {
  font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>
