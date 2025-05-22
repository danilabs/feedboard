<template>
  <div>
    <video ref="vDiv" class="aspect-video" muted>

    </video>
  </div>
</template>

<style scoped>

</style>
<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue'
import { WebRTCPlayer } from '@eyevinn/webrtc-player'

export default defineComponent({
  name: 'WhepPlayer',
  setup () {
    const vDiv = ref<HTMLDivElement>(null)
    let player: WebRTCPlayer

    async function initMediaPlayer() {
      console.log('initMediaPlayer')
      player = new WebRTCPlayer({
        video: vDiv.value as HTMLVideoElement,
        type: 'whep',
      })
      await player.load(new URL("http://localhost:8889/cooks/whep"))
      vDiv.value.play()
    }

    onMounted(async () => {
      await initMediaPlayer()      // vDiv.value.play()
    })

    return {
      vDiv,
    }
  }
})
</script>
