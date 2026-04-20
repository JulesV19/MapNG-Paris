<template>
  <div class="space-y-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
    <div class="flex items-center justify-between">
      <h4 class="font-bold text-gray-900 dark:text-white flex items-center gap-2">
        🏠 {{ $t('exportPanel.architecture') }}
      </h4>
      <label class="flex items-center gap-2 cursor-pointer">
        <input 
          type="checkbox" 
          v-model="isCustom" 
          @change="toggleCustom"
          class="accent-[#2563EB] w-4 h-4"
        />
        <span class="text-xs text-gray-700 dark:text-gray-300">
          {{ $t('exportPanel.enableCustomStyles') }}
        </span>
      </label>
    </div>

    <div v-if="isCustom" class="space-y-4 pt-3 border-t border-gray-200 dark:border-gray-700 mt-3 animate-in fade-in">
      
      <!-- Sliders de répartition des styles -->
      <div class="space-y-2">
        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {{ $t('exportPanel.styleDistribution') }}
        </label>
        <div v-for="(style, index) in localProfile.styles" :key="style.id" class="flex items-center gap-3">
          <span class="text-xs text-gray-700 dark:text-gray-300 w-24 capitalize">{{ style.id }}</span>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            v-model.number="localProfile.styles[index].weight"
            @input="emitUpdate"
            class="flex-1 accent-[#2563EB]"
          />
          <span class="text-xs text-gray-500 w-10 text-right">{{ Math.round(style.weight * 100) }}%</span>
        </div>
      </div>

      <!-- Saisie des couleurs de toits -->
      <div class="space-y-2">
        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {{ $t('exportPanel.roofColors') }}
        </label>
        <p class="text-[10px] text-gray-500">{{ $t('exportPanel.colorHint') }}</p>
        
        <div v-for="(colors, type) in localProfile.roofColors" :key="type" class="flex items-center gap-2">
          <span class="text-xs text-gray-700 dark:text-gray-300 w-24 capitalize">{{ type }}</span>
          <input 
            type="text" 
            :value="formatColors(colors)"
            @change="(e) => updateColors(type, e.target.value)"
            class="flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-900 dark:text-white focus:ring-[#2563EB] outline-none"
          />
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: Object, default: () => null }
});
const emit = defineEmits(['update:modelValue']);

const isCustom = ref(!!props.modelValue);

const localProfile = ref(props.modelValue || {
  styles: [
    { id: 'classique', weight: 0.40 },
    { id: 'moderne', weight: 0.30 },
    { id: 'contemporain', weight: 0.15 },
    { id: 'medieval', weight: 0.15 }
  ],
  roofColors: {
    classique: [0x58626a, 0x4a5460, 0x78503a],
    moderne: [0x484840, 0x3c3c38],
    contemporain: [0xb8c0c8, 0xaab2ba],
    house: [0x8b3a3a, 0x7a3e3e, 0x5c5c5c],
    industrial: [0xa0a0a0, 0x8c8c8c],
    default: [0x58626a, 0x4a5460]
  }
});

const toggleCustom = () => {
  if (isCustom.value) {
    emitUpdate();
  } else {
    emit('update:modelValue', null);
  }
};

const emitUpdate = () => {
  if (!isCustom.value) return;
  const totalWeight = localProfile.value.styles.reduce((sum, s) => sum + s.weight, 0);
  const normalizedStyles = localProfile.value.styles.map(s => ({
    id: s.id,
    weight: totalWeight > 0 ? s.weight / totalWeight : 0
  }));

  emit('update:modelValue', {
    styles: normalizedStyles,
    roofColors: localProfile.value.roofColors
  });
};

const formatColors = (colorsArray) => {
  return colorsArray.map(c => '#' + c.toString(16).padStart(6, '0')).join(', ');
};

const updateColors = (type, colorString) => {
  const colorsArray = colorString.split(',')
    .map(s => s.trim())
    .filter(s => s.startsWith('#') || s.startsWith('0x'))
    .map(s => parseInt(s.replace('#', ''), 16))
    .filter(n => !isNaN(n));
    
  if (colorsArray.length > 0) {
    localProfile.value.roofColors[type] = colorsArray;
    emitUpdate();
  }
};

watch(() => props.modelValue, (newVal) => {
  isCustom.value = !!newVal;
  if (newVal) {
    localProfile.value = JSON.parse(JSON.stringify(newVal));
  }
}, { deep: true });
</script>