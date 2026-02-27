<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
      <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-[#FF6600] rounded-lg shadow-sm">
            <Layers :size="20" class="text-white" />
          </div>
          <div>
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">About MapNG</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">BeamNG.drive Terrain Generator</p>
          </div>
        </div>
        <button @click="$emit('close')" class="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
          <X :size="20" />
        </button>
      </div>
      
      <div class="p-6 overflow-y-auto custom-scrollbar space-y-6 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
        <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 rounded-lg p-4 text-orange-900 dark:text-orange-100">
          <p class="font-medium">MapNG is a specialized web application that converts real-world geographic data into game-engine-ready terrain assets for BeamNG.drive modding.</p>
        </div>

        <div class="space-y-4">
          <h3 class="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe :size="16" class="text-[#FF6600]" />
            What does it do?
          </h3>
          <p>
            Select any location on Earth, configure your terrain settings, and MapNG will generate high-precision heightmaps, detailed textures, and full 3D models ready for game engine import — all at a consistent 1 meter per pixel scale. The app features an interactive 3D preview with HDR lighting, cascaded shadow maps, and procedurally generated 3D buildings, trees, and road networks rendered directly from OpenStreetMap data. For large-scale projects, Batch Job mode can process entire grids of tiles automatically.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <h4 class="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Elevation Sources</h4>
            <ul class="space-y-2 list-disc list-inside marker:text-[#FF6600]">
              <li>Standard 30m Global (AWS Terrarium/SRTM)</li>
              <li>USGS 1m DEM (USA — CONUS, Alaska, Hawaii)</li>
              <li>GPXZ Premium High-Res (Global, concurrent requests for paid plans)</li>
            </ul>
          </div>
          <div class="space-y-2">
            <h4 class="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">3D Preview</h4>
            <ul class="space-y-2 list-disc list-inside marker:text-[#FF6600]">
              <li>HDR environment lighting &amp; CSM shadows</li>
              <li>Satellite, OSM, Hybrid &amp; bare texture modes</li>
              <li>3D buildings, trees, bushes &amp; barriers</li>
              <li>Surrounding terrain tiles (8 directions)</li>
              <li>Quality &amp; wireframe controls</li>
            </ul>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <h4 class="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Export Formats (11 Types)</h4>
            <ul class="space-y-2 list-disc list-inside marker:text-[#FF6600]">
              <li>16-bit PNG Heightmap</li>
              <li>Satellite Texture (JPG)</li>
              <li>OSM "Blueprint" Texture (up to 8192×8192 PNG)</li>
              <li>Hybrid Satellite + Roads Texture (PNG)</li>
              <li>Segmented Satellite Texture (PNG)</li>
              <li>Segmented Hybrid Texture (PNG)</li>
              <li>Road Mask (16-bit PNG)</li>
              <li>GeoTIFF (WGS84 or source CRS)</li>
              <li>GeoJSON Vector Data</li>
              <li>GLB 3D Model (+ optional surroundings)</li>
              <li>Collada DAE (+ optional surroundings)</li>
              <li>Job Data (.mapng) - Complete compressed session package</li>
            </ul>
          </div>
          <div class="space-y-2">
            <h4 class="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">OSM Texture Features</h4>
            <ul class="space-y-2 list-disc list-inside marker:text-[#FF6600]">
              <li>40+ land-use color categories</li>
              <li>Lane-accurate road rendering with markings</li>
              <li>Junction fills with Bézier-curved corners</li>
              <li>Crosswalk detection &amp; zebra stripes</li>
              <li>Chaikin's algorithm for smooth curves</li>
              <li>Customizable OSM background color</li>
            </ul>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <h4 class="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Surrounding Tiles</h4>
            <p class="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              Download up to 8 adjacent terrain tiles as a ZIP package with heightmaps, satellite textures, and metadata — perfect for building multi-tile BeamNG worlds.
            </p>
          </div>
          <div class="space-y-2">
             <h4 class="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Resolution Note</h4>
             <p class="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                <strong>All heightmaps are exported at 1 meter per pixel.</strong><br/>
                Output sizes range from 512px to 8192px (0.26 km² to 67 km²). Standard 30m data is bilinearly upsampled for smooth surfaces.
             </p>
          </div>
        </div>

        <div class="space-y-2">
          <h4 class="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
            <Grid3X3 :size="14" class="text-[#FF6600]" />
            Batch Job Mode
            <span class="text-[8px] uppercase tracking-wider bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">Beta</span>
          </h4>
          <p class="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
            Process large areas by defining a grid of tiles (up to 20×20). Each tile is generated sequentially with all selected exports packaged into individual ZIP files. Features include:
          </p>
          <ul class="space-y-1 list-disc list-inside marker:text-[#FF6600] text-xs">
            <li>Configurable grid dimensions, resolution, and export selections</li>
            <li>Live progress tracking with color-coded tile grid and satellite thumbnails</li>
            <li>Persistent state — pause, resume, and retry failed tiles</li>
            <li>Automatic memory cleanup between tiles for stability</li>
            <li>GPXZ concurrent requests for paid plans (based on account limits)</li>
            <li>Per-tile coordinate-stamped filenames for easy organization</li>
          </ul>
        </div>

        <div class="space-y-2">
            <h4 class="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">Additional Features</h4>
            <ul class="space-y-2 list-disc list-inside marker:text-[#FF6600]">
              <li><strong>Job Import/Export:</strong> Save and restore full sessions via .mapng files</li>
              <li>Nominatim location search with type-categorized icons</li>
              <li>Preset scenic locations (Grand Canyon, Mt. Fuji, Tail of the Dragon, etc.)</li>
              <li>GPXZ plan auto-detection with concurrent request support</li>
              <li>Web Worker-based off-thread terrain processing</li>
              <li>Light &amp; dark mode with persistent preferences</li>
              <li>Automatic geolocation on first visit</li>
              <li>Generation caching — skip reprocessing when switching views</li>
              <li>Abort support for long-running generation tasks</li>
            </ul>
        </div>

        <div class="pt-4 border-t border-gray-100 dark:border-gray-800">
          <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
            Created by <a href="https://github.com/nikkiluzader" target="_blank" class="text-[#FF6600] hover:underline">Nikki Luzader</a> • Open Source on <a href="https://github.com/nikkiluzader/mapng" target="_blank" class="text-[#FF6600] hover:underline">GitHub</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Layers, X, Globe, Grid3X3 } from 'lucide-vue-next';

defineEmits(['close']);
</script>
