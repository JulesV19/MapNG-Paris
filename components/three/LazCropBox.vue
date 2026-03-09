<script setup>
import { shallowRef, watch, markRaw, onUnmounted } from 'vue';
import * as THREE from 'three';

const props = defineProps({
  terrainData: { required: true },
});

const SCENE_SIZE = 100;
// Keep the box visible without turning it into a tall slab.
const BOX_HEIGHT = Math.max(1.5, SCENE_SIZE * 0.03);

const linesRef = shallowRef(null);
const materialRef = shallowRef(markRaw(new THREE.LineBasicMaterial({
  color: 0xFF6600,
  linewidth: 2,
  depthTest: false,
  transparent: true,
  opacity: 0.85,
})));

watch(() => props.terrainData, (data) => {
  if (!data?.exportCropSize || !data?.width || !data?.height || !data?.heightMap) {
    linesRef.value = null;
    return;
  }

  const cropSize = data.exportCropSize;
  const halfW = (SCENE_SIZE / 2) * (cropSize / data.width);
  const halfD = (SCENE_SIZE / 2) * (cropSize / data.height);

  // Compute unitsPerMeter from the terrain's geographic bounds (same as TerrainMesh)
  const latRad = ((data.bounds?.north ?? 0) + (data.bounds?.south ?? 0)) / 2 * Math.PI / 180;
  const metersPerDegLng = 111320 * Math.cos(latRad);
  const realWidthMeters = ((data.bounds?.east ?? 1) - (data.bounds?.west ?? 0)) * metersPerDegLng;
  const unitsPerMeter = SCENE_SIZE / realWidthMeters;

  // Sample terrain height at the crop center so the box is anchored at the
  // actual ground surface rather than at minHeight (which may be ocean floor).
  const cx = Math.floor(data.width  / 2);
  const cy = Math.floor(data.height / 2);
  const centerH = data.heightMap[cy * data.width + cx];
  const validH = (centerH !== undefined && centerH > -10000) ? centerH : data.minHeight;
  const surfaceY = (validH - data.minHeight) * unitsPerMeter;

  // TerrainMesh is Y-up in world space, so the footprint must be on X/Z.
  const yBottom = Math.max(0, surfaceY - BOX_HEIGHT * 0.15);
  const yTop = yBottom + BOX_HEIGHT;

  // 8 corners of the box
  const corners = [
    [-halfW, yBottom, -halfD],
    [ halfW, yBottom, -halfD],
    [ halfW, yBottom,  halfD],
    [-halfW, yBottom,  halfD],
    [-halfW, yTop, -halfD],
    [ halfW, yTop, -halfD],
    [ halfW, yTop,  halfD],
    [-halfW, yTop,  halfD],
  ];

  // 12 edges
  const edgePairs = [
    [0,1],[1,2],[2,3],[3,0], // bottom face
    [4,5],[5,6],[6,7],[7,4], // top face
    [0,4],[1,5],[2,6],[3,7], // vertical edges
  ];

  const pts = [];
  for (const [a, b] of edgePairs) {
    pts.push(...corners[a], ...corners[b]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));

  if (linesRef.value) linesRef.value.dispose();
  linesRef.value = markRaw(geo);
}, { immediate: true });

onUnmounted(() => {
  linesRef.value?.dispose();
  materialRef.value?.dispose();
});
</script>

<template>
  <TresLineSegments
    v-if="linesRef && terrainData?.exportCropSize"
    :geometry="linesRef"
    :material="materialRef"
    :render-order="999"
  />
</template>
