<template>
  <div class="grid grid-cols-2 gap-2">
    <BaseButton size="sm" variant="secondary" @click="$emit('copy')">Copy Configuration</BaseButton>
    <BaseButton size="sm" variant="secondary" @click="$emit('paste')">Paste Configuration</BaseButton>
    <BaseButton size="sm" variant="secondary" @click="$emit('save')">Save Configuration</BaseButton>
    <BaseButton size="sm" variant="secondary" @click="triggerLoad">Load Configuration</BaseButton>
    <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="handleFile" />
  </div>
  <p v-if="status" class="text-[10px] text-gray-500 dark:text-gray-400">{{ status }}</p>
</template>

<script setup>
import { ref } from 'vue';
import BaseButton from '../base/BaseButton.vue';

const props = defineProps({
  status: { type: String, default: '' },
});

const emit = defineEmits(['copy', 'paste', 'save', 'load']);

const fileInput = ref(null);
const triggerLoad = () => fileInput.value?.click();
const handleFile = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  emit('load', file);
  event.target.value = '';
};
</script>
