<template>
  <div class="relative">
    <span style="position: absolute; top: 5px; left: 5px;">HLS</span>
    <video ref="vDiv" controls muted/>
  </div>
</template>

<style>

</style>

<script lang="ts">
  import { defineComponent, ref, onMounted } from 'vue'
  import Hls from 'hls.js'

  export default defineComponent({
    name: 'HLSPlayer',
    setup () {
      const vDiv = ref<HTMLVideoElement>()
      const src = "http://localhost:8888/compressed/index.m3u8"

      onMounted(() => {
        if (vDiv.value?.canPlayType('application/vnd.apple.mpegurl')) {
          console.log("HLS: Native")
          vDiv.value.src = src
          vDiv.value?.play()
        } else if (Hls.isSupported()) {
          console.log("HLS: hls.js")
          let hls = new Hls({debug: true});
          hls.loadSource(src)
          hls.attachMedia(vDiv.value)
          vDiv.value?.play()
        }
      })
      return {
        vDiv
      }
    }
  })
</script>
