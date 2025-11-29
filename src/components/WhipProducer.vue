<template>
  <div>
    <button @click="startStream" class="bg-blue-500">Whip</button>
  </div>
</template>

<style lang="scss">

</style>


<script lang="ts">
import { defineComponent } from 'vue'
import { WHIPClient } from '@eyevinn/whip-web-client'
// import { useDisplayMedia } from '@vueuse/core'

export default defineComponent({
  name: 'WhipProducer',
  setup() {
    async function startStream() {
      console.log("print")

      const captureStream = await navigator.mediaDevices.getDisplayMedia({
        selfBrowserSurface: "include",
        preferCurrentTab: true
      })


      console.log(captureStream)

      const client = new WHIPClient({
        endpoint: "http://localhost:8889/test/whip",
        opts: {
          debug: true,
          noTrickleIce: false
        }
      });

      await client.ingest(captureStream)
    }

    return {
      startStream
    }
  }
})
</script>
