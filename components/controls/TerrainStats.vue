<template>
  <BaseCard v-if="terrainData" class="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 space-y-2" padded>
    <div class="grid grid-cols-3 gap-1 text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600 pb-2">
      <div class="text-center border-r border-gray-200 dark:border-gray-600">
        <div class="text-gray-400 dark:text-gray-500">Min</div>
        <div class="text-gray-700 dark:text-gray-300 font-medium">{{ Math.round(terrainData.minHeight) }}m</div>
      </div>
      <div class="text-center border-r border-gray-200 dark:border-gray-600">
        <div class="text-gray-400 dark:text-gray-500">Max</div>
        <div class="text-gray-700 dark:text-gray-300 font-medium">{{ Math.round(terrainData.maxHeight) }}m</div>
      </div>
      <div class="text-center">
        <div class="text-gray-400 dark:text-gray-500">Diff</div>
        <div class="text-[#FF6600] font-bold">{{ Math.round(terrainData.maxHeight - terrainData.minHeight) }}m</div>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-1 text-[10px] text-gray-500 dark:text-gray-400">
      <div class="text-center border-r border-gray-200 dark:border-gray-600">
        <div class="text-gray-400 dark:text-gray-500">Scale</div>
        <div class="text-gray-700 dark:text-gray-300 font-medium">{{ metersPerPixel.toFixed(2) }}m/px</div>
      </div>
      <div class="text-center">
        <div class="text-gray-400 dark:text-gray-500">Total Area</div>
        <div class="text-gray-700 dark:text-gray-300 font-medium">{{ areaDisplay }}</div>
      </div>
    </div>
  </BaseCard>
</template>

<script setup>
import BaseCard from '../base/BaseCard.vue';

defineProps({
  terrainData: { type: Object, default: null },
  metersPerPixel: { type: Number, default: 1 },
  areaDisplay: { type: String, default: '' },
});
</script>
