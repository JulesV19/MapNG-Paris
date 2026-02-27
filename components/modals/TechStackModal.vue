<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col animate-in zoom-in-95 duration-200">
      <!-- Header -->
      <div class="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur z-10">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Code :size="20" class="text-[#FF6600]" />
          </div>
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">MapNG Tech Stack</h2>
        </div>
        <button 
          @click="$emit('close')" 
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <X :size="20" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-8">
        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-[#FF6600] uppercase tracking-wider">Core Framework</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Vue 3</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Composition API & reactive state management</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">JavaScript (ES6+)</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Modern standard with dynamic imports & async/await</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Tailwind CSS</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Utility-first styling with dark mode support</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Vite</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Fast dev server & optimized production builds</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Reactive Local State</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Vue refs/computed with localStorage persistence</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Lucide Icons</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Beautiful, consistent icon set (Vue components)</div>
            </div>
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-[#FF6600] uppercase tracking-wider">3D Engine & Rendering</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Three.js</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">WebGL 3D engine — geometry, materials, textures, export</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">TresJS</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Declarative Vue 3 renderer for Three.js scenes</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Cientos</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">OrbitControls, HDR environment, shadows, sky</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Cascaded Shadow Maps</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">4-cascade CSM with 4096px shadow maps & PCF filtering</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">HDR Environment</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">4K puresky HDRI for realistic ambient & reflection lighting</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">GLTFExporter</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Full 3D model export with terrain, OSM features & surroundings</div>
            </div>
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-[#FF6600] uppercase tracking-wider">Mapping & GIS</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
             <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Leaflet & Vue-Leaflet</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Interactive 2D map with 3 base layers & dark mode</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">proj4 & GeoTIFF</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">CRS reprojection, DEM parsing & GeoTIFF export</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Local Transverse Mercator</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Custom metric projection for pixel-perfect 1m/px grids</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Nominatim Geocoding</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Dual-endpoint search with type-categorized location icons</div>
            </div>
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-[#FF6600] uppercase tracking-wider">Texture & Image Processing</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">HTML5 Canvas API</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Procedural texture generation up to 8192×8192 with 40+ land-use colors</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">fast-png</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">16-bit precision heightmap & road mask encoding</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">OSM Lane Renderer</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Lane markings, junction fills, crosswalks, Chaikin smoothing</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Web Workers</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Off-thread terrain & image resampling with transferable buffers</div>
            </div>
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-[#FF6600] uppercase tracking-wider">Data Sources</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
             <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">AWS Terrain Tiles</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Global 30m SRTM elevation (Terrarium encoding @ Z15)</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">USGS National Map</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">1m DEM via TNM Access API (CONUS, Alaska, Hawaii)</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">GPXZ API</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Premium global hi-res elevation with auto-chunking, rate-limit probing &amp; concurrent requests for paid plans</div>
            </div>
             <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Esri World Imagery</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">High-res satellite textures at Z17 (~1.2m/px)</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Overpass API (OSM)</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Roads, buildings, land-use, vegetation, barriers (3 failover endpoints)</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">JSZip</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Client-side ZIP packaging for batch jobs, surrounding-tile exports, and .mapng job files</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Blob URL Management</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Zero-copy binary data handling for high-res heightmaps and texture rehydration</div>
            </div>
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-[#FF6600] uppercase tracking-wider">Deployment</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <div class="font-medium text-gray-900 dark:text-white">Cloudflare Pages</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Global edge-deployed static hosting via Wrangler CLI</div>
            </div>
          </div>
        </section>
      </div>
      
      <div class="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400">Built to assist with BeamNG.drive modding workflows.</p>
        <p class="italic opacity-70 text-xs text-gray-400 dark:text-gray-500 mt-2">App enhanced with Claude</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Code, X } from 'lucide-vue-next';

defineEmits(['close']);
</script>
