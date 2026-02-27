<template>
  <div class="space-y-6">
    <!-- Experimental Banner -->
    <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 flex items-start gap-2">
      <AlertTriangle :size="14" class="text-amber-500 mt-0.5 shrink-0" />
      <p class="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
        <span class="font-bold">Experimental.</span> Batch processing is a work in progress. Large grids or high-resolution tiles may encounter issues.
      </p>
    </div>

    <BatchGridConfig
      :grid-cols="gridCols"
      :grid-rows="gridRows"
      :total-tiles="totalTiles"
      :total-area-display="totalAreaDisplay"
      :perimeter-display="perimeterDisplay"
      :grid-width-display="gridWidthDisplay"
      :grid-height-display="gridHeightDisplay"
      :tile-area-display="tileAreaDisplay"
      @update:grid-cols="(v) => gridCols = v"
      @update:grid-rows="(v) => gridRows = v"
    />

    <hr class="border-gray-200 dark:border-gray-600" />

    <!-- Resolution -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <Box :size="16" class="text-gray-700 dark:text-gray-300" />
        Tile Resolution
      </label>
      <ResolutionSelector
        :modelValue="resolution"
        @update:modelValue="$emit('resolutionChange', $event)"
      >
        <p>Each tile: {{ resolution }}m × {{ resolution }}m at 1m/px</p>
        <p>Grid coverage: {{ gridWidthDisplay }} × {{ gridHeightDisplay }}</p>
        <p v-if="resolution >= 4096" class="text-amber-600 dark:text-amber-500 font-medium">⚠️ High resolution tiles require significant RAM per tile.</p>
      </ResolutionSelector>
    </div>

    <hr class="border-gray-200 dark:border-gray-600" />

    <BatchPerformanceProfile v-model:modelValue="performanceProfile" />

    <hr class="border-gray-200 dark:border-gray-600" />

    <!-- OSM Toggle -->
    <div class="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
      <label class="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2 cursor-pointer">
        <Trees :size="12" class="text-emerald-600 dark:text-emerald-400" />
        Include OSM Features
      </label>
      <input type="checkbox" v-model="includeOSM" class="accent-[#FF6600] w-4 h-4 cursor-pointer" />
    </div>

    <!-- Elevation Source -->
    <ElevationSourceSelector
      v-model:elevationSource="elevationSource"
      :usgsStatus="null"
      v-model:gpxzApiKey="gpxzApiKey"
      :gpxzStatus="gpxzStatus"
      :isCheckingGPXZ="isCheckingGPXZ"
      :isBatchMode="true"
      :totalTiles="totalTiles"
      @verifyGpxzKey="checkGPXZStatus"
    />

    <hr class="border-gray-200 dark:border-gray-600" />

    <!-- Coordinates -->
    <div class="space-y-2">
      <button @click="showCoordinates = !showCoordinates"
        class="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[#FF6600] transition-colors group">
        <span class="flex items-center gap-2">
          <MapPin :size="16" class="text-gray-500 dark:text-gray-400 group-hover:text-[#FF6600] transition-colors" />
          Grid Center
        </span>
        <ChevronDown :size="14" :class="['transition-transform duration-200', showCoordinates ? 'rotate-180' : '']" />
      </button>

      <template v-if="showCoordinates">
        <CoordinatesInput :center="center" @locationChange="handleLocationChange" />
      </template>
    </div>

    <hr class="border-gray-200 dark:border-gray-600" />

    <BatchExportOptions
      :exports="exports"
      :include-o-s-m="includeOSM"
      :mesh-resolution="meshResolution"
      @update:exports="(v) => exports.value = v"
      @update:mesh-resolution="(v) => meshResolution.value = v"
    />

    <hr class="border-gray-200 dark:border-gray-600" />

    <!-- Selected exports count -->
    <div class="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600 space-y-1">
      <p><span class="font-medium text-gray-700 dark:text-gray-300">{{ selectedExportCount }} export{{ selectedExportCount !== 1 ? 's' : '' }}</span> selected per tile</p>
      <p>{{ totalTiles }} tiles × {{ selectedExportCount }} exports = <span class="text-[#FF6600] font-bold">{{ totalTiles * selectedExportCount }} total files</span> (packaged as {{ totalTiles }} ZIPs)</p>
      <p class="text-amber-600 dark:text-amber-500 font-medium mt-1">
        ℹ️ Your browser may ask permission to download multiple files.
      </p>
    </div>

    <!-- Action Buttons -->
    <div class="space-y-2">
      <BatchRunConfigControls
        :status="runConfigStatus"
        @copy="copyRunConfiguration"
        @paste="pasteRunConfiguration"
        @save="saveRunConfiguration"
        @load="handleRunConfigFile"
      />

      <BaseButton
        block
        size="lg"
        variant="primary"
        :disabled="selectedExportCount === 0 || isRunning || (elevationSource === 'gpxz' && !gpxzApiKey)"
        @click="handleStart"
      >
        <Play :size="16" />
        Start Batch Job ({{ totalTiles }} tiles)
      </BaseButton>

      <template v-if="hasResumableSavedState">
        <BaseButton block size="md" variant="primary" class="bg-emerald-600 hover:bg-emerald-700" @click="$emit('resumeBatch')">
          <RotateCcw :size="14" />
          Resume Previous Job ({{ savedState.totalCompleted }}/{{ savedState.tiles.length }} done)
        </BaseButton>
        <BaseButton block size="sm" variant="secondary" @click="$emit('clearSavedBatch')">
          <X :size="12" />
          Clear Saved Job
        </BaseButton>
        <BaseButton block size="sm" variant="secondary" @click="$emit('clearCache')">
          <X :size="12" />
          Clear Cache
        </BaseButton>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { Grid3X3, Box, Trees, Mountain, MapPin, ChevronDown, Play, RotateCcw, X, AlertTriangle } from 'lucide-vue-next';
import CoordinatesInput from '../map/CoordinatesInput.vue';
import ElevationSourceSelector from '../map/ElevationSourceSelector.vue';
import ResolutionSelector from '../map/ResolutionSelector.vue';
import BatchGridConfig from '../batch/BatchGridConfig.vue';
import BatchPerformanceProfile from '../batch/BatchPerformanceProfile.vue';
import BatchExportOptions from '../batch/BatchExportOptions.vue';
import BatchRunConfigControls from '../batch/BatchRunConfigControls.vue';
import BaseButton from '../base/BaseButton.vue';
import { probeGPXZLimits } from '../../services/terrain';
import { cloneRateLimitInfo, downloadJsonFile } from '../../services/traceability';

const props = defineProps({
  center: { type: Object, required: true },
  resolution: { type: Number, required: true },
  isRunning: { type: Boolean, default: false },
  savedState: { type: Object, default: null },
});

const emit = defineEmits([
  'locationChange', 'resolutionChange', 'startBatch',
  'resumeBatch', 'clearSavedBatch', 'update:gridCols', 'update:gridRows', 'clearCache',
]);

const handleLocationChange = (newLocation) => {
  emit('locationChange', { ...props.center, ...newLocation });
};

// Grid config
const gridCols = ref(parseInt(localStorage.getItem('mapng_batch_cols')) || 3);
const gridRows = ref(parseInt(localStorage.getItem('mapng_batch_rows')) || 3);

// Settings
const includeOSM = ref(localStorage.getItem('mapng_batch_osm') !== 'false');
const elevationSource = ref(localStorage.getItem('mapng_batch_elevation') || 'default');
const gpxzApiKey = ref(localStorage.getItem('mapng_gpxzApiKey') || '');
const gpxzStatus = ref(null);
const isCheckingGPXZ = ref(false);
const showCoordinates = ref(false);
const meshResolution = ref(parseInt(localStorage.getItem('mapng_batch_mesh')) || 256);
const performanceProfile = ref(localStorage.getItem('mapng_batch_profile') || 'balanced');
const runConfigStatus = ref('');

// Export options
const exports = ref({
  heightmap: true,
  satellite: true,
  osmTexture: true,
  hybridTexture: true,
  segmentedSatellite: false,
  segmentedHybrid: false,
  roadMask: false,
  glb: false,
  dae: false,
  geotiff: false,
  geojson: false,
});

// Load saved export prefs
try {
  const saved = localStorage.getItem('mapng_batch_exports');
  if (saved) Object.assign(exports.value, JSON.parse(saved));
} catch { /* ignore */ }

// Formatting helpers
function formatDist(km) {
  return km >= 1 ? `${km.toFixed(1)} km` : `${(km * 1000).toFixed(0)} m`;
}
function formatArea(km2) {
  return km2 >= 1 ? `${km2.toFixed(2)} km²` : `${(km2 * 1_000_000).toFixed(0)} m²`;
}

// Computed
const totalTiles = computed(() => gridCols.value * gridRows.value);
const gridWidthKm = computed(() => (gridCols.value * props.resolution) / 1000);
const gridHeightKm = computed(() => (gridRows.value * props.resolution) / 1000);
const totalAreaKm = computed(() => gridWidthKm.value * gridHeightKm.value);
const totalAreaDisplay = computed(() => formatArea(totalAreaKm.value));
const perimeterDisplay = computed(() => formatDist(2 * (gridWidthKm.value + gridHeightKm.value)));
const tileAreaKm = computed(() => (props.resolution * props.resolution) / 1_000_000);
const tileAreaDisplay = computed(() => formatArea(tileAreaKm.value));
const gridWidthDisplay = computed(() => formatDist(gridWidthKm.value));
const gridHeightDisplay = computed(() => formatDist(gridHeightKm.value));
const selectedExportCount = computed(() =>
  Object.values(exports.value).filter(Boolean).length
);

const hasResumableSavedState = computed(() => {
  if (!props.savedState || props.isRunning) return false;
  return props.savedState.status !== 'completed';
});

// Handlers
const handleStart = () => {
  emit('startBatch', {
    center: { ...props.center },
    resolution: props.resolution,
    gridCols: gridCols.value,
    gridRows: gridRows.value,
    includeOSM: includeOSM.value,
    elevationSource: elevationSource.value,
    gpxzApiKey: gpxzApiKey.value,
    gpxzStatus: gpxzStatus.value ? { ...gpxzStatus.value } : cloneRateLimitInfo(),
    glbMeshResolution: meshResolution.value,
    performanceProfile: performanceProfile.value,
    exports: { ...exports.value },
  });
};

const buildRunConfiguration = () => {
  return {
    schemaVersion: 1,
    mode: 'batch',
    center: { ...props.center },
    resolution: props.resolution,
    gridCols: gridCols.value,
    gridRows: gridRows.value,
    includeOSM: includeOSM.value,
    elevationSource: elevationSource.value,
    gpxzApiKey: gpxzApiKey.value || '',
    gpxzStatus: gpxzStatus.value ? { ...gpxzStatus.value } : cloneRateLimitInfo(),
    glbMeshResolution: meshResolution.value,
    performanceProfile: performanceProfile.value,
    exports: { ...exports.value },
  };
};

const copyRunConfiguration = async () => {
  const payload = buildRunConfiguration();
  const text = JSON.stringify(payload, null, 2);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      runConfigStatus.value = 'Run configuration copied to clipboard.';
      return;
    }
  } catch {
  }
  runConfigStatus.value = 'Clipboard write unavailable in this browser/session.';
};

const pasteRunConfiguration = async () => {
  try {
    if (!navigator.clipboard?.readText) {
      runConfigStatus.value = 'Clipboard read unavailable in this browser/session.';
      return;
    }
    const text = await navigator.clipboard.readText();
    if (!text?.trim()) {
      runConfigStatus.value = 'Clipboard is empty.';
      return;
    }
    const json = JSON.parse(text);
    applyRunConfiguration(json);
    runConfigStatus.value = 'Configuration pasted from clipboard.';
  } catch (error) {
    console.error('Failed to paste batch configuration:', error);
    runConfigStatus.value = 'Clipboard content is not valid configuration JSON.';
  }
};

const saveRunConfiguration = () => {
  const payload = buildRunConfiguration();
  downloadJsonFile(payload, `MapNG_BatchRunConfig_${new Date().toISOString().slice(0, 10)}.json`);
  runConfigStatus.value = 'Configuration downloaded as JSON.';
};

const applyRunConfiguration = (config) => {
  const src = config?.runConfiguration || config;
  if (!src || typeof src !== 'object') throw new Error('Invalid JSON schema');

  const mode = src.mode || config?.mode;
  if (src.schemaVersion !== 1 || (mode && mode !== 'batch')) {
    throw new Error('Unsupported configuration schema.');
  }

  if (src.center && Number.isFinite(src.center.lat) && Number.isFinite(src.center.lng)) {
    emit('locationChange', { lat: src.center.lat, lng: src.center.lng });
  }
  if (Number.isFinite(src.resolution)) {
    emit('resolutionChange', parseInt(src.resolution));
  }
  if (Number.isFinite(src.gridCols)) {
    gridCols.value = Math.max(1, Math.min(20, parseInt(src.gridCols)));
  }
  if (Number.isFinite(src.gridRows)) {
    gridRows.value = Math.max(1, Math.min(20, parseInt(src.gridRows)));
  }
  if (typeof src.includeOSM === 'boolean') {
    includeOSM.value = src.includeOSM;
  }
  if (typeof src.elevationSource === 'string' && ['default', 'usgs', 'gpxz'].includes(src.elevationSource)) {
    elevationSource.value = src.elevationSource;
  }
  if (typeof src.gpxzApiKey === 'string') {
    gpxzApiKey.value = src.gpxzApiKey;
  }
  if (src.gpxzStatus && typeof src.gpxzStatus === 'object') {
    gpxzStatus.value = { ...src.gpxzStatus };
  }
  if (Number.isFinite(src.glbMeshResolution)) {
    meshResolution.value = parseInt(src.glbMeshResolution);
  }
  if (typeof src.performanceProfile === 'string' && ['throughput', 'balanced', 'low_memory'].includes(src.performanceProfile)) {
    performanceProfile.value = src.performanceProfile;
  }
  if (src.exports && typeof src.exports === 'object') {
    Object.keys(exports.value).forEach((key) => {
      if (typeof src.exports[key] === 'boolean') {
        exports.value[key] = src.exports[key];
      }
    });
  }
};

const handleRunConfigFile = async (file) => {
  if (!file) return;

  try {
    const text = await file.text();
    const json = JSON.parse(text);
    applyRunConfiguration(json);
    runConfigStatus.value = 'Configuration loaded. Start batch to rerun with these settings.';
  } catch (error) {
    console.error('Failed to load batch configuration:', error);
    runConfigStatus.value = 'Invalid configuration file (schema mismatch).';
  }
};

// Emit grid changes for map overlay
watch(gridCols, (v) => {
  localStorage.setItem('mapng_batch_cols', String(v));
  emit('update:gridCols', v);
});
watch(gridRows, (v) => {
  localStorage.setItem('mapng_batch_rows', String(v));
  emit('update:gridRows', v);
});

// Persist settings
watch(includeOSM, (v) => localStorage.setItem('mapng_batch_osm', String(v)));
watch(elevationSource, (v) => localStorage.setItem('mapng_batch_elevation', v));
watch(gpxzApiKey, (v) => {
  localStorage.setItem('mapng_gpxzApiKey', v);
  gpxzStatus.value = null;
});

// Check GPXZ account status
const checkGPXZStatus = async () => {
  if (!gpxzApiKey.value) return;
  isCheckingGPXZ.value = true;
  try {
    const info = await probeGPXZLimits(gpxzApiKey.value);
    gpxzStatus.value = info;
  } finally {
    isCheckingGPXZ.value = false;
  }
};
watch(meshResolution, (v) => localStorage.setItem('mapng_batch_mesh', String(v)));
watch(performanceProfile, (v) => localStorage.setItem('mapng_batch_profile', v));
watch(exports, (v) => localStorage.setItem('mapng_batch_exports', JSON.stringify(v)), { deep: true });

// Disable OSM-dependent exports when OSM is off
watch(includeOSM, (v) => {
  if (!v) {
    exports.value.osmTexture = false;
    exports.value.hybridTexture = false;
    exports.value.roadMask = false;
    exports.value.geojson = false;
  }
});

// Initial emit to set grid on map
emit('update:gridCols', gridCols.value);
emit('update:gridRows', gridRows.value);
</script>
