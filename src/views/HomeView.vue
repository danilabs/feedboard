<template>
  <div class="grid grid-cols-3 object-contain">
    <div class="aspect-video row-span-2 col-span-2 bg-red-800">
      <WhepPlayer stream-u-r-l="http://localhost:8889/cooks/whep" />
    </div>
    <div class="aspect-video bg-green-400">
      <WhepPlayer stream-u-r-l="http://localhost:8889/cooks/whep" />
    </div>
    <div class="aspect-video bg-blue-600">
      <WhepPlayer stream-u-r-l="http://localhost:8889/test_bars/whep" />
    </div>
    <div class="aspect-video bg-amber-300">
      <WhepPlayer stream-u-r-l="http://localhost:8889/auto_2.1/whep" />
    </div>
    <div class="aspect-video bg-pink-500">
      <WhepPlayer stream-u-r-l="http://localhost:8889/axis_camera/whep" />
    </div>
    <div class="aspect-video bg-orange-500">
      <WhepPlayer stream-u-r-l="http://localhost:8889/auto_7.1/whep" />
    </div>
    <!--    <div class="aspect-video bg-red-800"><WhepPlayer stream-u-r-l="http://localhost:8889/cooks/whep"/></div>-->
    <!--    <div class="aspect-video bg-green-400"><HLSPlayer /></div>-->
    <!--    <div class="aspect-video bg-blue-600"><WhepPlayer stream-u-r-l="http://localhost:8889/test_bars/whep"/></div>-->
    <!--    <div class="aspect-video bg-amber-300"><HLSPlayer /></div>-->
    <!--    <div class="aspect-video bg-pink-500"><WhepPlayer stream-u-r-l="http://localhost:8889/axis_camera/whep"/></div>-->
    <!--    <div class="aspect-video bg-orange-500"><HLSPlayer /></div>-->
    <!--    <div class="aspect-video bg-red-800"><WhepPlayer stream-u-r-l="http://localhost:8889/cooks/whep"/></div>-->
    <!--    <div class="aspect-video bg-green-400"><HLSPlayer /></div>-->
    <!--    <div class="aspect-video bg-blue-600"><WhepPlayer stream-u-r-l="http://localhost:8889/test_bars/whep"/></div>-->
    <!--    <div class="aspect-video bg-amber-300"><HLSPlayer /></div>-->
  </div>
  <div>
    <whip-producer />
  </div>
</template>

<style lang="scss"></style>

<script lang="ts">
import { defineComponent } from 'vue'
import WhepPlayer from '@/components/WhepPlayer.vue'
import HLSPlayer from '@/components/HLSPlayer.vue'
import WhipProducer from '@/components/WhipProducer.vue'
export default defineComponent({
  name: 'HomeView',
  components: { WhipProducer, HLSPlayer, WhepPlayer },
  setup() {
    return {}
  },
})
</script>
