<script setup>
import { ref, shallowRef, watch, toRaw, markRaw, onUnmounted } from 'vue';
import * as THREE from 'three';
import { fetchSurroundingTiles, POSITIONS } from '../services/surroundingTiles';

const SCENE_SIZE = 100;
const SEAM_BLEND_WIDTH_UNITS = SCENE_SIZE * 0.35;
const SEAM_OVERLAP_UNITS = 0.03;

const props = defineProps({
  terrainData: { type: Object, required: true },
  quality: { type: String, default: 'low' },
  visible: { type: Boolean, default: false },
});

// Map compass directions to scene position offsets (in SCENE_SIZE units)
// Center tile sits at (0,0). N = +Z in geo but -Z in scene (flipped).
// X: W=-1, E=+1
// Z: N=-1, S=+1 (north is "up" / negative Z in scene)
const SCENE_OFFSETS = {
  NW: { x: -1, z: -1 },
  N:  { x:  0, z: -1 },
  NE: { x:  1, z: -1 },
  W:  { x: -1, z:  0 },
  E:  { x:  1, z:  0 },
  SW: { x: -1, z:  1 },
  S:  { x:  0, z:  1 },
  SE: { x:  1, z:  1 },
};

const tileMeshes = ref([]);
const isLoading = ref(false);
const loaded = ref(false);
let abortController = null;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / Math.max(edge1 - edge0, 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

const getQualityProfile = (quality, terrainData) => {
  const centerResolution = Math.max(256, Number(terrainData?.width || 1024));

  if (quality === 'high') {
    return {
      fetchResolution: Math.min(centerResolution, 4096),
      satelliteZoom: 17,
      seamEdgeResolution: 768,
      depthResolution: 128,
      cornerResolution: 256,
      anisotropy: 16,
    };
  }

  if (quality === 'medium') {
    return {
      fetchResolution: Math.min(centerResolution, 2048),
      satelliteZoom: 16,
      seamEdgeResolution: 512,
      depthResolution: 96,
      cornerResolution: 192,
      anisotropy: 8,
    };
  }

  return {
    fetchResolution: Math.min(centerResolution, 1024),
    satelliteZoom: 15,
    seamEdgeResolution: 320,
    depthResolution: 72,
    cornerResolution: 128,
    anisotropy: 4,
  };
};

const getCenterHeightAtScenePos = (terrainData, sceneX, sceneZ, unitsPerMeter) => {
  const u = (sceneX + SCENE_SIZE / 2) / SCENE_SIZE;
  const v = (sceneZ + SCENE_SIZE / 2) / SCENE_SIZE;

  if (u < 0 || u > 1 || v < 0 || v > 1) {
    return 0;
  }

  const localX = u * (terrainData.width - 1);
  const localZ = v * (terrainData.height - 1);

  const x0 = Math.floor(localX);
  const x1 = Math.min(x0 + 1, terrainData.width - 1);
  const y0 = Math.floor(localZ);
  const y1 = Math.min(y0 + 1, terrainData.height - 1);

  const wx = localX - x0;
  const wy = localZ - y0;

  const hm = terrainData.heightMap;
  const w = terrainData.width;

  const i00 = y0 * w + x0;
  const i10 = y0 * w + x1;
  const i01 = y1 * w + x0;
  const i11 = y1 * w + x1;

  const h00 = hm[i00] < -10000 ? terrainData.minHeight : hm[i00];
  const h10 = hm[i10] < -10000 ? terrainData.minHeight : hm[i10];
  const h01 = hm[i01] < -10000 ? terrainData.minHeight : hm[i01];
  const h11 = hm[i11] < -10000 ? terrainData.minHeight : hm[i11];

  const h = (1 - wy) * ((1 - wx) * h00 + wx * h10) + wy * ((1 - wx) * h01 + wx * h11);
  return (h - terrainData.minHeight) * unitsPerMeter;
};

const projectToCenterSeam = (globalX, globalZ, offset) => {
  const half = SCENE_SIZE / 2;

  if (offset.x === 1 && offset.z === 0) {
    return { seamX: half, seamZ: clamp(globalZ, -half, half) };
  }
  if (offset.x === -1 && offset.z === 0) {
    return { seamX: -half, seamZ: clamp(globalZ, -half, half) };
  }
  if (offset.x === 0 && offset.z === 1) {
    return { seamX: clamp(globalX, -half, half), seamZ: half };
  }
  if (offset.x === 0 && offset.z === -1) {
    return { seamX: clamp(globalX, -half, half), seamZ: -half };
  }

  if (offset.x !== 0 && offset.z !== 0) {
    return { seamX: offset.x * half, seamZ: offset.z * half };
  }

  return null;
};

const blendToCenterSeamHeight = (terrainData, offset, globalX, globalZ, surroundingHeight, unitsPerMeter) => {
  const seamPoint = projectToCenterSeam(globalX, globalZ, offset);
  if (!seamPoint) return surroundingHeight;

  const centerSeamHeight = getCenterHeightAtScenePos(terrainData, seamPoint.seamX, seamPoint.seamZ, unitsPerMeter);
  const distanceToSeam = Math.hypot(globalX - seamPoint.seamX, globalZ - seamPoint.seamZ);
  const blend = smoothstep(0, SEAM_BLEND_WIDTH_UNITS, distanceToSeam);
  return centerSeamHeight * (1 - blend) + surroundingHeight * blend;
};

// Build mesh data from surrounding tile result
const buildTileMesh = (pos, data, terrainData, unitsPerMeter, profile) => {
  const offset = SCENE_OFFSETS[pos];
  if (!offset) return null;

  const maxSegX = Math.max(4, data.width - 1);
  const maxSegY = Math.max(4, data.height - 1);
  const isCornerTile = offset.x !== 0 && offset.z !== 0;
  const seamRunsAlongX = offset.x === 0 && offset.z !== 0; // N/S seam
  const seamRunsAlongY = offset.z === 0 && offset.x !== 0; // E/W seam

  let segsX;
  let segsY;

  if (isCornerTile) {
    segsX = Math.min(maxSegX, profile.cornerResolution);
    segsY = Math.min(maxSegY, profile.cornerResolution);
  } else if (seamRunsAlongX) {
    segsX = Math.min(maxSegX, profile.seamEdgeResolution);
    segsY = Math.min(maxSegY, profile.depthResolution);
  } else if (seamRunsAlongY) {
    segsX = Math.min(maxSegX, profile.depthResolution);
    segsY = Math.min(maxSegY, profile.seamEdgeResolution);
  } else {
    segsX = Math.min(maxSegX, profile.depthResolution);
    segsY = Math.min(maxSegY, profile.depthResolution);
  }

  segsX = Math.max(4, Math.floor(segsX));
  segsY = Math.max(4, Math.floor(segsY));

  const geo = new THREE.PlaneGeometry(SCENE_SIZE, SCENE_SIZE, segsX, segsY);
  const vertices = geo.attributes.position.array;
  const uvs = geo.attributes.uv.array;

  for (let i = 0; i < vertices.length / 3; i++) {
    const col = i % (segsX + 1);
    const row = Math.floor(i / (segsX + 1));

    const u = col / segsX;
    const v = row / segsY;

    const mapCol = Math.min(Math.round(u * (data.width - 1)), data.width - 1);
    const mapRow = Math.min(Math.round(v * (data.height - 1)), data.height - 1);
    const idx = mapRow * data.width + mapCol;

    let h = data.heightMap[idx];
    if (h < -10000) h = data.minHeight;

    const localX = u * SCENE_SIZE - SCENE_SIZE / 2;
    const localZ = v * SCENE_SIZE - SCENE_SIZE / 2;
    let globalX = localX + offset.x * SCENE_SIZE;
    let globalZ = localZ + offset.z * SCENE_SIZE;

    if (offset.x !== 0) {
      globalX -= Math.sign(offset.x) * SEAM_OVERLAP_UNITS;
    }
    if (offset.z !== 0) {
      globalZ -= Math.sign(offset.z) * SEAM_OVERLAP_UNITS;
    }
    const surroundingHeight = (h - terrainData.minHeight) * unitsPerMeter;
    const blendedHeight = blendToCenterSeamHeight(
      terrainData,
      offset,
      globalX,
      globalZ,
      surroundingHeight,
      unitsPerMeter,
    );

    vertices[i * 3] = globalX;
    vertices[i * 3 + 1] = -globalZ;
    vertices[i * 3 + 2] = blendedHeight;

    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }

  geo.computeVertexNormals();

  // Load satellite texture
  let texture = null;
  if (data.satelliteDataUrl) {
    texture = new THREE.TextureLoader().load(data.satelliteDataUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = profile.anisotropy;
    texture.flipY = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  }

  return { geometry: markRaw(geo), texture: texture ? markRaw(texture) : null, key: pos };
};

const dispose = () => {
  tileMeshes.value.forEach(m => {
    m.geometry?.dispose();
    m.texture?.dispose();
  });
  tileMeshes.value = [];
  loaded.value = false;
};

const fetchAndBuild = async () => {
  if (!props.terrainData?.bounds || isLoading.value) return;

  if (abortController) abortController.abort();
  abortController = new AbortController();

  dispose();
  isLoading.value = true;

  try {
    const allPositions = POSITIONS.map(p => p.key);
    const profile = getQualityProfile(props.quality, props.terrainData);
    const results = await fetchSurroundingTiles(
      props.terrainData.bounds,
      allPositions,
      profile.fetchResolution,
      profile.satelliteZoom,
      null,
      abortController.signal,
    );

    // Compute scale
    const latRad = (props.terrainData.bounds.north + props.terrainData.bounds.south) / 2 * Math.PI / 180;
    const metersPerDegree = 111320 * Math.cos(latRad);
    const realWidthMeters = (props.terrainData.bounds.east - props.terrainData.bounds.west) * metersPerDegree;
    const unitsPerMeter = SCENE_SIZE / realWidthMeters;

    const meshes = [];
    for (const [pos, data] of Object.entries(results)) {
      const mesh = buildTileMesh(pos, data, props.terrainData, unitsPerMeter, profile);
      if (mesh) meshes.push(mesh);
    }

    tileMeshes.value = meshes;
    loaded.value = true;
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('[SurroundingTerrain3D] Failed:', e);
    }
  } finally {
    isLoading.value = false;
    abortController = null;
  }
};

// Fetch when toggled visible (lazy load)
watch(() => props.visible, (v) => {
  if (v && !loaded.value && !isLoading.value) {
    fetchAndBuild();
  }
}, { immediate: true });

// Refetch if terrain data changes while visible
watch(() => props.terrainData?.bounds, () => {
  if (props.visible) {
    loaded.value = false;
    fetchAndBuild();
  }
});

watch(() => props.quality, () => {
  if (props.visible) {
    loaded.value = false;
    fetchAndBuild();
  }
});

onUnmounted(() => {
  if (abortController) abortController.abort();
  dispose();
});
</script>

<template>
  <TresGroup v-if="visible">
    <TresMesh
      v-for="tile in tileMeshes"
      :key="tile.key"
      :rotation="[-Math.PI / 2, 0, 0]"
      :position="[0, 0, 0]"
      receive-shadow
      :geometry="tile.geometry"
    >
      <TresMeshStandardMaterial
        :map="tile.texture"
        :color="tile.texture ? 0xffffff : 0x8a8a8a"
        :roughness="1"
        :metalness="0"
        :side="2"
      />
    </TresMesh>
  </TresGroup>
</template>
