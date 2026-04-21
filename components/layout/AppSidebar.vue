<template>
  <aside class="w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-10 relative shadow-xl">
    <div class="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 bg-white dark:bg-gray-900">
      <div class="p-1.5 bg-[#2563EB] rounded-lg">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="w-7 h-7">
          <g fill="white" opacity="0.95">
            <polygon points="15,75 35,35 55,75" />
            <polygon points="40,75 60,25 85,75" />
            <line x1="10" y1="80" x2="90" y2="80" stroke="white" stroke-width="2" opacity="0.5" />
            <line x1="10" y1="85" x2="90" y2="85" stroke="white" stroke-width="1.5" opacity="0.3" />
          </g>
        </svg>
      </div>
      <div>
        <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">RealScape</h1>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('sidebar.tagline') }}</p>
      </div>
      <BaseButton
        size="sm"
        variant="ghost"
        class="ml-auto text-gray-400 hover:text-[#2563EB] transition-colors p-1 rounded-full hover:bg-orange-50 dark:hover:bg-gray-800"
        :title="t('sidebar.aboutTooltip')"
        @click="$emit('show-about')"
      >
        <CircleHelp :size="20" />
      </BaseButton>
    </div>

    <ModeToggle :batch-mode="batchMode" @set-batch-mode="$emit('set-batch-mode', $event)" />

    <div class="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50 dark:bg-gray-800/50 p-5">
      <slot />
    </div>

    <div class="px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 space-y-1">
      <div class="flex items-center justify-between gap-2 px-2">
        <label class="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">{{ t('language.label') }}</label>
        <select
          :value="locale"
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-[11px] text-gray-700 dark:text-gray-200"
          @change="handleLocaleChange"
        >
          <option v-for="code in locales" :key="code" :value="code">
            {{ t(`language.${code}`) }}
          </option>
        </select>
      </div>
      <div class="flex items-center justify-between gap-1">
        <div class="flex items-center gap-1">
          <BaseButton variant="ghost" size="sm" class="px-2 py-1 text-[11px] font-medium" @click="$emit('show-disclaimer')">{{ t('sidebar.disclaimer') }}</BaseButton>
          <a href="mailto:jv9994@icloud.com" class="text-[#2563EB] hover:text-[#E65C00] transition-colors px-2 py-1">{{ t('sidebar.contact') }}</a>
          <BaseButton
            variant="ghost"
            size="sm"
            class="text-gray-600 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-[#2563EB] transition-colors flex items-center gap-1 px-2 py-1"
            @click="$emit('show-stack')"
          >
            <Code :size="12" /> {{ t('sidebar.stack') }}
          </BaseButton>
        </div>
        <BaseButton
          variant="secondary"
          size="sm"
          class="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          :title="isDarkMode ? t('sidebar.switchToLightMode') : t('sidebar.switchToDarkMode')"
          @click="$emit('toggle-dark')"
        >
          <Sun v-if="isDarkMode" :size="14" />
          <Moon v-else :size="14" />
        </BaseButton>
      </div>
      <span class="text-[10px] text-gray-400 dark:text-gray-500 leading-tight px-2">{{ t('sidebar.build', { hash: buildHash, time: buildTime }) }}</span>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseButton from '../base/BaseButton.vue';
import ModeToggle from '../ui/ModeToggle.vue';
import { getSupportedLocales, setI18nLanguage } from '../../i18n';
import { CircleHelp, Sun, Moon, Code } from 'lucide-vue-next';

const { t, locale } = useI18n({ useScope: 'global' });
const locales = computed(() => getSupportedLocales());

defineProps({
  batchMode: { type: Boolean, default: false },
  isDarkMode: { type: Boolean, default: false },
  buildHash: { type: String, default: '' },
  buildTime: { type: String, default: '' },
});

defineEmits(['show-about', 'show-disclaimer', 'show-stack', 'toggle-dark', 'set-batch-mode']);

const handleLocaleChange = (event) => {
  setI18nLanguage(event.target.value);
};
</script>
