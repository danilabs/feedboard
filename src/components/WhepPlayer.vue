<template>
  <div>
    <video ref="vDiv" class="aspect-video" muted></video>
  </div>
</template>

<style scoped></style>
<script lang="ts">
import { defineComponent, onMounted, type PropType, ref } from 'vue'
import { WebRTCPlayer } from '@eyevinn/webrtc-player'

export default defineComponent({
  name: 'WhepPlayer',
  props: {
    streamURL: {
      type: String as PropType<string>,
      required: false,
    },
  },
  setup(props) {
    const vDiv = ref<HTMLDivElement>(null)
    let player: WebRTCPlayer

    async function initMediaPlayer() {
      console.log('initMediaPlayer')
      player = new WebRTCPlayer({
        video: vDiv.value as HTMLVideoElement,
        type: 'whep',
      })
      await player.load(new URL(props.streamURL))
      vDiv.value.play()
    }

    onMounted(async () => {
      await initMediaPlayer() // vDiv.value.play()
    })

    return {
      vDiv,
    }
  },
})
</script>
