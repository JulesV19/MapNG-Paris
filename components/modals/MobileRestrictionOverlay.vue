<template>
  <div class="flex md:hidden fixed inset-0 z-[999] bg-white dark:bg-gray-900 flex-col items-center justify-center p-8 text-center text-gray-900 dark:text-white">
    <div class="bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-w-sm flex flex-col items-center">
      <div class="p-4 bg-[#FF6600]/10 rounded-full mb-6">
        <Monitor :size="48" class="text-[#FF6600]" />
      </div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Desktop Required</h1>
      <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-6">
        MapNG is a high-performance terrain generation tool designed for BeamNG modding.
      </p>
      <p class="text-gray-500 dark:text-gray-400 text-xs mb-6">
        To ensure the best experience with 3D rendering, precise map selection, and file management, please access this application on a desktop or laptop computer.
      </p>
      <div class="flex items-center gap-2 text-xs font-medium text-[#FF6600] bg-[#FF6600]/10 px-4 py-2 rounded-full border border-[#FF6600]/20">
        <MousePointer2 :size="12" />
        <span>Mouse & Keyboard Recommended</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Monitor, MousePointer2 } from 'lucide-vue-next';
</script>
