<template>
  <div class="grid grid-cols-4 object-contain">
    <div class="aspect-video bg-red-800"><WhepPlayer /></div>
    <div class="aspect-video bg-green-400"><HLSPlayer /></div>
    <div class="aspect-video bg-blue-600"><WhepPlayer /></div>
    <div class="aspect-video bg-amber-300"><HLSPlayer /></div>
    <div class="aspect-video bg-pink-500"><WhepPlayer /></div>
    <div class="aspect-video bg-orange-500"><HLSPlayer /></div>
    <div class="aspect-video bg-red-800"><WhepPlayer /></div>
    <div class="aspect-video bg-green-400"><HLSPlayer /></div>
    <div class="aspect-video bg-blue-600"><WhepPlayer /></div>
    <div class="aspect-video bg-amber-300"><HLSPlayer /></div>
    <div class="aspect-video bg-pink-500"><WhepPlayer /></div>
    <div class="aspect-video bg-orange-500"><HLSPlayer /></div>
    <div class="aspect-video bg-red-800"><WhepPlayer /></div>
    <div class="aspect-video bg-green-400"><HLSPlayer /></div>
    <div class="aspect-video bg-blue-600"><WhepPlayer /></div>
    <div class="aspect-video bg-amber-300"><HLSPlayer /></div>
  </div>
</template>

<style lang="scss"></style>

<script lang="ts">
import { defineComponent } from 'vue'
import WhepPlayer from '@/components/WhepPlayer.vue'
import HLSPlayer from '@/components/HLSPlayer.vue'
export default defineComponent({
  name: 'HomeView',
  components: { HLSPlayer, WhepPlayer },
  setup() {
    return {}
  },
})
</script>
