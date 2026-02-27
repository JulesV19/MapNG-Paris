<template>
  <BaseCard class="space-y-3 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600">
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-600 dark:text-gray-400">Width (columns)</span>
        <div class="flex items-center gap-2">
          <BaseButton size="sm" variant="secondary" @click="$emit('update:gridCols', Math.max(1, gridCols - 1))">−</BaseButton>
          <input
            type="number"
            v-model.number="localGridCols"
            min="1"
            max="20"
            class="w-12 text-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-[#FF6600] outline-none"
          />
          <BaseButton size="sm" variant="secondary" @click="$emit('update:gridCols', Math.min(20, gridCols + 1))">+</BaseButton>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-600 dark:text-gray-400">Height (rows)</span>
        <div class="flex items-center gap-2">
          <BaseButton size="sm" variant="secondary" @click="$emit('update:gridRows', Math.max(1, gridRows - 1))">−</BaseButton>
          <input
            type="number"
            v-model.number="localGridRows"
            min="1"
            max="20"
            class="w-12 text-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-[#FF6600] outline-none"
          />
          <BaseButton size="sm" variant="secondary" @click="$emit('update:gridRows', Math.min(20, gridRows + 1))">+</BaseButton>
        </div>
      </div>
    </div>

    <div class="pt-2 border-top border-gray-200 dark:border-gray-600 space-y-2">
      <div class="grid grid-cols-3 gap-2 text-[10px]">
        <div class="text-center">
          <div class="text-gray-400 dark:text-gray-500">Tiles</div>
          <div class="text-gray-900 dark:text-white font-bold text-sm">{{ totalTiles }}</div>
        </div>
        <div class="text-center">
          <div class="text-gray-400 dark:text-gray-500">Total Area</div>
          <div class="text-[#FF6600] font-bold text-sm">{{ totalAreaDisplay }}</div>
        </div>
        <div class="text-center">
          <div class="text-gray-400 dark:text-gray-500">Perimeter</div>
          <div class="text-gray-900 dark:text-white font-bold text-sm">{{ perimeterDisplay }}</div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2 text-[10px]">
        <div class="text-center">
          <div class="text-gray-400 dark:text-gray-500">West → East</div>
          <div class="text-gray-700 dark:text-gray-300 font-medium">{{ gridWidthDisplay }}</div>
        </div>
        <div class="text-center">
          <div class="text-gray-400 dark:text-gray-500">North → South</div>
          <div class="text-gray-700 dark:text-gray-300 font-medium">{{ gridHeightDisplay }}</div>
        </div>
        <div class="text-center">
          <div class="text-gray-400 dark:text-gray-500">Per Tile</div>
          <div class="text-gray-700 dark:text-gray-300 font-medium">{{ tileAreaDisplay }}</div>
        </div>
      </div>
    </div>

    <p v-if="totalTiles > 50" class="text-[10px] text-amber-600 dark:text-amber-500 font-medium">
      ⚠️ Large batch ({{ totalTiles }} tiles). This will take a long time and trigger many downloads.
    </p>
  </BaseCard>
</template>

<script setup>
import { computed } from 'vue';
import BaseCard from '../base/BaseCard.vue';
import BaseButton from '../base/BaseButton.vue';

const props = defineProps({
  gridCols: { type: Number, default: 3 },
  gridRows: { type: Number, default: 3 },
  totalTiles: { type: Number, default: 0 },
  totalAreaDisplay: { type: String, default: '' },
  perimeterDisplay: { type: String, default: '' },
  gridWidthDisplay: { type: String, default: '' },
  gridHeightDisplay: { type: String, default: '' },
  tileAreaDisplay: { type: String, default: '' },
});

const emit = defineEmits(['update:gridCols', 'update:gridRows']);

const localGridCols = computed({
  get: () => props.gridCols,
  set: (val) => emit('update:gridCols', Math.max(1, Math.min(20, val || 1))),
});

const localGridRows = computed({
  get: () => props.gridRows,
  set: (val) => emit('update:gridRows', Math.max(1, Math.min(20, val || 1))),
});
</script>
