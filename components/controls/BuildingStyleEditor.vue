<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-[10px] text-gray-500 dark:text-gray-400">
        {{ REGION_LABELS[regionId] ?? regionId }}
      </span>
      <button
        @click="reset"
        class="text-[9px] text-gray-400 dark:text-gray-500 hover:text-[#2563EB] transition-colors"
      >
        Reset
      </button>
    </div>

    <div class="space-y-1.5">
      <div v-for="item in localStyles" :key="item.id" class="flex items-center gap-2">
        <span class="text-[10px] text-gray-600 dark:text-gray-400 w-24 shrink-0">
          {{ STYLE_LABELS[item.id] ?? item.id }}
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          :value="Math.round(item.weight * 100)"
          @input="setWeight(item.id, Number($event.target.value))"
          class="flex-1 h-1.5 accent-[#2563EB] cursor-pointer"
        />
        <span class="text-[10px] text-gray-500 dark:text-gray-400 w-7 text-right shrink-0">
          {{ Math.round(item.weight * 100) }}%
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { REGION_PROFILES } from '../../services/buildingStyles.js';

const REGION_LABELS = {
  paris_intramuros: 'Paris intra-muros',
  ile_de_france:    'Île-de-France',
  normandie:        'Normandie',
  alsace:           'Alsace',
  bretagne:         'Bretagne',
  paca:             "Provence-Alpes-Côte d'Azur",
  generic_france:   'France (général)',
};

const STYLE_LABELS = {
  haussmannien: 'Haussmannien',
  classique:    'Classique',
  art_deco:     'Art déco',
  annees60:     'Années 60',
  annees80:     'Années 80',
  contemporain: 'Contemporain',
  medieval:     'Médiéval',
  normand:      'Normand',
  alsacien:     'Alsacien',
  breton:       'Breton',
  provencal:    'Provençal',
  moderne:      'Moderne',
};

const props = defineProps({
  regionId: { type: String, default: 'generic_france' },
  modelValue: { type: Array, default: null },
});

const emit = defineEmits(['update:modelValue']);

const defaultStyles = () =>
  (REGION_PROFILES[props.regionId] ?? REGION_PROFILES.generic_france).styles
    .map(s => ({ ...s }));

const localStyles = ref(props.modelValue ? props.modelValue.map(s => ({ ...s })) : defaultStyles());

watch(() => props.regionId, () => {
  localStyles.value = defaultStyles();
  emit('update:modelValue', localStyles.value.map(s => ({ ...s })));
});

watch(() => props.modelValue, (val) => {
  if (!val) {
    localStyles.value = defaultStyles();
  }
}, { deep: true });

const normalize = () => {
  const total = localStyles.value.reduce((s, x) => s + x.weight, 0);
  if (total <= 0) {
    const even = 1 / localStyles.value.length;
    localStyles.value.forEach(x => { x.weight = even; });
  } else {
    localStyles.value.forEach(x => { x.weight = x.weight / total; });
  }
};

const setWeight = (id, pct) => {
  const item = localStyles.value.find(x => x.id === id);
  if (!item) return;
  item.weight = pct / 100;
  normalize();
  emit('update:modelValue', localStyles.value.map(s => ({ ...s })));
};

const reset = () => {
  localStyles.value = defaultStyles();
  emit('update:modelValue', null);
};
</script>
