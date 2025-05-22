<template>
  <div>
    <video muted autoplay>
      <source src="http://localhost:8888/compressed/index.m3u8" type="application/x-mpegURL">
    </video>
  </div>
</template>

<style>

</style>

<script lang="ts">
  import { defineComponent } from 'vue'

  export default defineComponent({
    name: 'HLSPlayer',
    setup () {

    }
  })
</script>
