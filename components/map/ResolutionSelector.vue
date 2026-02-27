<template>
  <div class="space-y-1">
    <label v-if="label" class="text-xs text-gray-500 dark:text-gray-400">{{ label }}</label>
    <select 
      :value="modelValue" 
      @change="$emit('update:modelValue', parseInt($event.target.value))"
      class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FF6600] focus:border-[#FF6600] outline-none"
    >
      <option :value="512">512 x 512 px (Fast)</option>
      <option :value="1024">1024 x 1024 px (Standard)</option>
      <option :value="2048">2048 x 2048 px (High Detail)</option>
      <option :value="4096">4096 x 4096 px (Very High)</option>
      <option :value="8192">8192 x 8192 px (Ultra)</option>
    </select>
    <div class="text-[10px] text-gray-500 dark:text-gray-400 pt-1 space-y-1">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: Number,
    required: true
  },
  label: {
    type: String,
    default: ''
  }
});
defineEmits(['update:modelValue']);
</script>
