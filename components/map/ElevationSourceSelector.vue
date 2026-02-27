<template>
  <div class="space-y-2">
    <button 
      @click="showElevationSource = !showElevationSource"
      class="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[#FF6600] transition-colors group"
    >
      <span class="flex items-center gap-2">
        <Mountain :size="16" class="text-gray-500 dark:text-gray-400 group-hover:text-[#FF6600] transition-colors" />
        Elevation Data Source
      </span>
      <ChevronDown :size="14" :class="['transition-transform duration-200', showElevationSource ? 'rotate-180' : '']" />
    </button>
    
    <div v-if="showElevationSource" class="space-y-2 bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
        <!-- Default -->
        <label class="flex items-start gap-2 cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors">
            <input type="radio" v-model="localElevationSource" value="default" class="mt-0.5 accent-[#FF6600]" />
            <div class="space-y-0.5">
                <span class="block text-xs font-medium text-gray-900 dark:text-white">Standard (30m Global)</span>
                <span class="block text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                    Amazon Terrarium (SRTM). Reliable global coverage. Good for general terrain.
                </span>
            </div>
        </label>

        <!-- USGS -->
        <label class="flex items-start gap-2 cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors">
            <input type="radio" v-model="localElevationSource" value="usgs" class="mt-0.5 accent-[#FF6600]" />
            <div class="space-y-0.5">
                <div class="flex items-center gap-2">
                    <span class="block text-xs font-medium text-gray-900 dark:text-white">USGS 1m DEM (USA Only)</span>
                    <span v-if="usgsStatus" class="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold px-1 bg-emerald-100 dark:bg-emerald-900/30 rounded">ONLINE</span>
                    <span v-else-if="usgsStatus === false" class="text-[9px] text-red-600 dark:text-red-400 font-bold px-1 bg-red-100 dark:bg-red-900/30 rounded">OFFLINE</span>
                </div>
                <span class="block text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                    High-precision data for USA. Falls back to Standard if data is missing/corrupt.
                </span>
            </div>
        </label>

        <!-- GPXZ -->
        <label class="flex items-start gap-2 cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors">
            <input type="radio" v-model="localElevationSource" value="gpxz" class="mt-0.5 accent-[#FF6600]" />
            <div class="space-y-0.5 w-full">
                <span class="block text-xs font-medium text-gray-900 dark:text-white">GPXZ (Premium Global)</span>
                <span class="block text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                    Highest quality global data. Requires API Key. <a href="https://www.gpxz.io/docs/dataset#coverage" target="_blank" class="text-[#FF6600] hover:underline" @click.stop>Check Coverage</a>
                </span>
                
                <div v-if="localElevationSource === 'gpxz'" class="mt-2 animate-in fade-in slide-in-from-top-1">
                    <input 
                        type="password" 
                        v-model="localGpxzApiKey"
                        placeholder="Enter GPXZ API Key"
                        class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-[#FF6600] outline-none"
                    />
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-1">
                        Free tier: 100 req/day. <a href="https://www.gpxz.io/" target="_blank" class="text-[#FF6600] hover:underline">Get a key</a>
                    </p>
                    <p v-if="isBatchMode" class="text-[10px] text-amber-600 dark:text-amber-500 font-medium mt-1">
                      ⚠️ Batch jobs with GPXZ use many API calls ({{ totalTiles }} tiles × multiple requests each).
                    </p>
                    <!-- GPXZ Account Status -->
                    <div v-if="localGpxzApiKey" class="mt-2">
                      <button @click="verifyGpxzKey" :disabled="isCheckingGPXZ"
                        class="text-[10px] text-[#FF6600] hover:underline disabled:opacity-50 disabled:no-underline">
                        {{ isCheckingGPXZ ? 'Checking...' : (gpxzStatus ? 'Refresh Status' : 'Check Account') }}
                      </button>
                      <div v-if="gpxzStatus" class="mt-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 p-2 space-y-1">
                        <div class="flex items-center justify-between text-[10px]">
                          <span class="text-gray-500 dark:text-gray-400">Plan</span>
                          <span :class="['font-bold uppercase', gpxzStatus.plan === 'free' ? 'text-gray-600 dark:text-gray-300' : 'text-emerald-600 dark:text-emerald-400']">{{ gpxzStatus.plan }}</span>
                        </div>
                        <div class="flex items-center justify-between text-[10px]">
                          <span class="text-gray-500 dark:text-gray-400">Today</span>
                          <span class="text-gray-700 dark:text-gray-300">{{ gpxzStatus.used }} / {{ gpxzStatus.limit }}</span>
                        </div>
                        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-0.5">
                          <div class="h-1 rounded-full transition-all" :class="gpxzStatus.remaining < 20 ? 'bg-red-500' : 'bg-emerald-500'" :style="{ width: Math.min(100, (gpxzStatus.used / gpxzStatus.limit) * 100) + '%' }"></div>
                        </div>
                        <div class="flex items-center justify-between text-[10px]">
                          <span class="text-gray-500 dark:text-gray-400">Concurrency</span>
                          <span class="text-gray-700 dark:text-gray-300">{{ gpxzStatus.concurrency }}x parallel</span>
                        </div>
                        <p v-if="!gpxzStatus.valid" class="text-[10px] text-red-500 font-medium">⚠️ Invalid API key</p>
                      </div>
                    </div>
                    <p v-if="isAreaLargeForGPXZ" class="text-[10px] text-orange-600 dark:text-orange-400 font-medium leading-tight mt-1">
                        ⚠️ Large area ({{ areaSqKm.toFixed(2) }} km²). Uses multiple API calls.
                    </p>
                </div>
            </div>
        </label>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { Mountain, ChevronDown } from 'lucide-vue-next';

const props = defineProps({
  elevationSource: {
    type: String,
    required: true
  },
  usgsStatus: {
    type: Boolean,
    default: null
  },
  gpxzApiKey: {
    type: String,
    default: ''
  },
  gpxzStatus: {
    type: Object,
    default: null
  },
  isCheckingGPXZ: {
    type: Boolean,
    default: false
  },
  isAreaLargeForGPXZ: {
    type: Boolean,
    default: false
  },
  areaSqKm: {
    type: Number,
    default: 0
  },
  isBatchMode: {
    type: Boolean,
    default: false
  },
  totalTiles: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['update:elevationSource', 'update:gpxzApiKey', 'verifyGpxzKey']);

const localElevationSource = ref(props.elevationSource);
const localGpxzApiKey = ref(props.gpxzApiKey);
const showElevationSource = ref(localStorage.getItem('mapng_showElevationSource') === 'true');

watch(showElevationSource, (v) => localStorage.setItem('mapng_showElevationSource', String(v)));

watch(localElevationSource, (newVal) => {
  emit('update:elevationSource', newVal);
});

watch(() => props.elevationSource, (newVal) => {
  localElevationSource.value = newVal;
});

watch(localGpxzApiKey, (newVal) => {
  emit('update:gpxzApiKey', newVal);
});

watch(() => props.gpxzApiKey, (newVal) => {
  localGpxzApiKey.value = newVal;
});

const verifyGpxzKey = () => {
  emit('verifyGpxzKey');
};
</script>
