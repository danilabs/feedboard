<template>
  <div class="relative">
    <span style="position: absolute; top: 5px; left: 5px;">WHEP</span>
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
        video: vDiv.value as unknown as HTMLVideoElement,
        type: 'whep',
        statsTypeFilter: '^candidate-*|^inbound-rtp'
      })

      player.on('no-media', () => {
        console.log('media timeout occured');
      });
      player.on('media-recovered', () => {
        console.log('media recovered');
      });

      // Subscribe for RTC stats: `stats:${RTCStatsType}`
      player.on('stats:inbound-rtp', (report) => {
        if (report.kind === 'video') {
          console.log(report);
        }
      });

      await player.load(new URL("http://localhost:8889/test_stream/whep"))
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
