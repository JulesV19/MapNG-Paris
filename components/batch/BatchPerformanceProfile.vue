<template>
  <div class="space-y-2">
    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('batch.performanceProfile') }}</label>
    <select
      class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option value="throughput">{{ t('batch.profileThroughput') }}</option>
      <option value="balanced">{{ t('batch.profileBalanced') }}</option>
      <option value="low_memory">{{ t('batch.profileLowMemory') }}</option>
    </select>
    <p class="text-[10px] text-gray-500 dark:text-gray-400">
      {{ t('batch.profileHelp') }}
    </p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n({ useScope: 'global' });

defineProps({
  modelValue: { type: String, default: 'balanced' },
});

defineEmits(['update:modelValue']);
</script>
