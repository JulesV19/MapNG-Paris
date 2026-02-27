<template>
  <div :class="classes" v-bind="$attrs">
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  padded: { type: Boolean, default: true },
  border: { type: Boolean, default: true },
});

const classes = computed(() => [
  'rounded-lg bg-white dark:bg-gray-800 shadow-sm',
  props.border ? 'border border-gray-200 dark:border-gray-700' : '',
  props.padded ? 'p-3' : '',
]);
</script>
