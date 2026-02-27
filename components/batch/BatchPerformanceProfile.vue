<template>
  <div class="space-y-2">
    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Batch Performance Profile</label>
    <select
      class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FF6600] focus:border-[#FF6600] outline-none"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option value="throughput">Max Throughput (fastest, higher memory)</option>
      <option value="balanced">Balanced (recommended)</option>
      <option value="low_memory">Low Memory 8192 Safe (slower, most stable)</option>
    </select>
    <p class="text-[10px] text-gray-500 dark:text-gray-400">
      Controls internal scheduler concurrency for fetch/compute/encode and high-res tile fan-out.
    </p>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: 'balanced' },
});

defineEmits(['update:modelValue']);
</script>
