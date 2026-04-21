import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import JSZip from "jszip";
import { textures } from "./textureGenerator.js";
import { createMetricProjector } from "./geoUtils.js";
import { fetchSurroundingTiles, POSITIONS } from "./surroundingTiles.js";
import { ColladaExporter } from './ColladaExporter.js';
import { STYLE_DEFS, REGION_PROFILES } from './buildingStyles.js';
import { detectFrenchRegion } from './regionDetector.js';

// --- Constants & Helpers ---
export const SCENE_SIZE = 100;

// Cached per-dataset projection and constants to avoid recomputation
let _cachedDataId = null;
let _cachedProjector = null;
let _cachedUnitsPerMeter = 0;
let _cachedMinHeight = 0;
let _cachedWidth = 0;
let _cachedHeight = 0;
let _cachedHeightMap = null;

const _ensureCache = (data) => {
  // Use bounds as identity — same bounds = same projection
  const dataId = `${data.bounds.north},${data.bounds.south},${data.bounds.east},${data.bounds.west},${data.width},${data.height}`;
  if (_cachedDataId !== dataId) {
    _cachedDataId = dataId;
    _cachedProjector = createMetricProjector(data.bounds, data.width, data.height);
    const latRad = (((data.bounds.north + data.bounds.south) / 2) * Math.PI) / 180;
    const metersPerDegree = 111320 * Math.cos(latRad);
    const realWidthMeters = (data.bounds.east - data.bounds.west) * metersPerDegree;
    _cachedUnitsPerMeter = SCENE_SIZE / realWidthMeters;
    _cachedMinHeight = data.minHeight;
    _cachedWidth = data.width;
    _cachedHeight = data.height;
    _cachedHeightMap = data.heightMap;
  }
};

const getTerrainHeight = (data, lat, lng) => {
  const scenePos = latLngToScene(data, lat, lng);
  return getHeightAtScenePos(data, scenePos.x, scenePos.z);
};

const latLngToScene = (data, lat, lng) => {
  _ensureCache(data);
  const p = _cachedProjector(lat, lng);

  const u = p.x / (_cachedWidth - 1);
  const v = p.y / (_cachedHeight - 1);

  const sceneX = u * SCENE_SIZE - SCENE_SIZE / 2;
  const sceneZ = v * SCENE_SIZE - SCENE_SIZE / 2;

  return new THREE.Vector3(sceneX, 0, sceneZ);
};

// Reusable Vector3 for latLngToScene when caller only needs x/z
const _tmpSceneVec = new THREE.Vector3();
const latLngToSceneFast = (data, lat, lng) => {
  _ensureCache(data);
  const p = _cachedProjector(lat, lng);
  const u = p.x / (_cachedWidth - 1);
  const v = p.y / (_cachedHeight - 1);
  _tmpSceneVec.x = u * SCENE_SIZE - SCENE_SIZE / 2;
  _tmpSceneVec.y = 0;
  _tmpSceneVec.z = v * SCENE_SIZE - SCENE_SIZE / 2;
  return _tmpSceneVec;
};

// Helper to get height from scene coordinates — uses cached constants
const getHeightAtScenePos = (data, x, z) => {
  _ensureCache(data);
  const half = SCENE_SIZE / 2;
  // Ensure we are exactly on or inside the boundary for sampling.
  const u = Math.max(0, Math.min(1, (x + half) / SCENE_SIZE));
  const v = Math.max(0, Math.min(1, (z + half) / SCENE_SIZE));

  const localX = u * (_cachedWidth - 1);
  const localZ = v * (_cachedHeight - 1);

  const x0 = Math.floor(localX);
  const x1 = Math.min(x0 + 1, _cachedWidth - 1);
  const y0 = Math.floor(localZ);
  const y1 = Math.min(y0 + 1, _cachedHeight - 1);

  const wx = localX - x0;
  const wy = localZ - y0;

  const hm = _cachedHeightMap;
  const w = _cachedWidth;
  const minH = _cachedMinHeight;

  const i00 = y0 * w + x0;
  const i10 = y0 * w + x1;
  const i01 = y1 * w + x0;
  const i11 = y1 * w + x1;

  const h00 = hm[i00] < -10000 ? minH : hm[i00];
  const h10 = hm[i10] < -10000 ? minH : hm[i10];
  const h01 = hm[i01] < -10000 ? minH : hm[i01];
  const h11 = hm[i11] < -10000 ? minH : hm[i11];

  const h = (1 - wy) * ((1 - wx) * h00 + wx * h10) + wy * ((1 - wx) * h01 + wx * h11);

  return (h - minH) * _cachedUnitsPerMeter;
};

const createRoadGeometry = (data, points, width, offset = 0, options = {}) => {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const uvs = [];
  const indices = [];

  _ensureCache(data);
  const unitsPerMeter = _cachedUnitsPerMeter;

  // Reuse Vector3 objects to avoid allocation per iteration
  const forward = new THREE.Vector3();

  let totalLength = 0;
  const dists = [0];
  for (let i = 1; i < points.length; i++) {
    totalLength += points[i].distanceTo(points[i - 1]);
    dists.push(totalLength);
  }

  let accumulatedDist = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    accumulatedDist = dists[i];

    const isDashGap =
      options.dashed &&
      Math.floor(accumulatedDist / (4 * unitsPerMeter)) % 2 === 1;

    if (i < points.length - 1) {
      forward.subVectors(points[i + 1], points[i]).normalize();
    } else {
      forward.subVectors(points[i], points[i - 1]).normalize();
    }

    const perpX = -forward.z;
    const perpZ = forward.x;
    const halfWidth = (width / 2) * unitsPerMeter;
    const off = offset * unitsPerMeter;

    const lx = p.x + perpX * (off - halfWidth);
    const lz = p.z + perpZ * (off - halfWidth);
    const rx = p.x + perpX * (off + halfWidth);
    const rz = p.z + perpZ * (off + halfWidth);

    const ly = getHeightAtScenePos(data, lx, lz);
    const ry = getHeightAtScenePos(data, rx, rz);

    const elev = 0.02 * unitsPerMeter;

    vertices.push(lx, ly + elev, lz);
    vertices.push(rx, ry + elev, rz);

    const uMax = width / 3; // Répétition de la texture tous les 3 mètres en largeur
    const v = accumulatedDist / (3 * unitsPerMeter); // Répétition tous les 3 mètres en longueur

    uvs.push(0, v);
    uvs.push(uMax, v);

    if (i < points.length - 1 && !isDashGap) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const addColor = (geo, colorHex) => {
  const count = geo.attributes.position.count,
    colors = new Float32Array(count * 3),
    c = new THREE.Color(colorHex);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
};

// === Street Furniture Procedural Model Generators ===

/**
 * Street lamp: tapered pole + lamp head.
 * OSM2World: pole 0.16→0.08m radius, 5m tall, inverted pyramid lamp.
 */
const createStreetLampMesh = (unitsPerMeter) => {
  const poleH = 5.0 * unitsPerMeter;
  const lampH = 0.8 * unitsPerMeter;
  const totalH = poleH;

  // Tapered pole
  let pole = new THREE.CylinderGeometry(
    0.06 * unitsPerMeter, 0.12 * unitsPerMeter, poleH - lampH, 6,
  );
  if (pole.index) pole = pole.toNonIndexed();
  pole.translate(0, (poleH - lampH) / 2, 0);
  addColor(pole, 0x888888);

  // Lamp housing (inverted cone)
  let lampBase = new THREE.CylinderGeometry(
    0.02 * unitsPerMeter, 0.3 * unitsPerMeter, lampH * 0.6, 6,
  );
  if (lampBase.index) lampBase = lampBase.toNonIndexed();
  lampBase.translate(0, poleH - lampH + lampH * 0.3, 0);
  addColor(lampBase, 0x444444);

  // Lamp globe (bright cap)
  let lampGlobe = new THREE.SphereGeometry(0.15 * unitsPerMeter, 6, 4);
  if (lampGlobe.index) lampGlobe = lampGlobe.toNonIndexed();
  lampGlobe.translate(0, poleH - lampH * 0.15, 0);
  addColor(lampGlobe, 0xfff8dc);

  const merged = mergeGeometries([pole, lampBase, lampGlobe]);
  pole.dispose(); lampBase.dispose(); lampGlobe.dispose();
  return merged;
};

/**
 * Bollard: simple cylinder.
 * OSM2World: r=0.15m, h=1.0m, STEEL.
 */
const createBollardMesh = (unitsPerMeter) => {
  const h = 1.0 * unitsPerMeter;
  const r = 0.12 * unitsPerMeter;
  let geo = new THREE.CylinderGeometry(r * 0.85, r, h, 6);
  if (geo.index) geo = geo.toNonIndexed();
  geo.translate(0, h / 2, 0);
  addColor(geo, 0x777777);
  return geo;
};

/**
 * Bench: seat + backrest + 4 legs.
 * OSM2World: seat 2m × 0.5m × 0.05m at 0.5m, backrest 0.5m tall, legs 0.08m.
 */
const createBenchMesh = (unitsPerMeter) => {
  const benchW = 1.5 * unitsPerMeter;
  const seatD = 0.45 * unitsPerMeter;
  const seatH = 0.5 * unitsPerMeter;
  const seatThk = 0.04 * unitsPerMeter;
  const legSz = 0.06 * unitsPerMeter;
  const backH = 0.4 * unitsPerMeter;
  const backThk = 0.03 * unitsPerMeter;
  const parts = [];

  // Seat
  let seat = new THREE.BoxGeometry(benchW, seatThk, seatD);
  if (seat.index) seat = seat.toNonIndexed();
  seat.translate(0, seatH, 0);
  addColor(seat, 0x8B6914);
  parts.push(seat);

  // Backrest
  let back = new THREE.BoxGeometry(benchW, backH, backThk);
  if (back.index) back = back.toNonIndexed();
  back.translate(0, seatH + backH / 2, -seatD / 2 + backThk / 2);
  addColor(back, 0x8B6914);
  parts.push(back);

  // 4 Legs
  const legPositions = [
    [-benchW / 2 + legSz, -seatD / 2 + legSz],
    [benchW / 2 - legSz, -seatD / 2 + legSz],
    [-benchW / 2 + legSz, seatD / 2 - legSz],
    [benchW / 2 - legSz, seatD / 2 - legSz],
  ];
  for (const [lx, lz] of legPositions) {
    let leg = new THREE.BoxGeometry(legSz, seatH, legSz);
    if (leg.index) leg = leg.toNonIndexed();
    leg.translate(lx, seatH / 2, lz);
    addColor(leg, 0x555555);
    parts.push(leg);
  }

  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
};

const createWasteBasketMesh = (unitsPerMeter) => {
  const h = 0.8 * unitsPerMeter;
  const r = 0.25 * unitsPerMeter;
  let geo = new THREE.CylinderGeometry(r, r * 0.8, h, 8);
  if (geo.index) geo = geo.toNonIndexed();
  geo.translate(0, h / 2, 0);
  addColor(geo, 0x2d3748); // gris ardoise (poubelle de ville)
  return geo;
};

const createPostBoxMesh = (unitsPerMeter) => {
  const w = 0.5 * unitsPerMeter, h = 1.2 * unitsPerMeter, d = 0.4 * unitsPerMeter;
  let geo = new THREE.BoxGeometry(w, h, d);
  if (geo.index) geo = geo.toNonIndexed();
  geo.translate(0, h / 2, 0);
  addColor(geo, 0xfacc15); // jaune ou rouge selon le pays (ici jaune typique la poste)
  return geo;
};

const createFireHydrantMesh = (unitsPerMeter) => {
  const h = 0.9 * unitsPerMeter, r = 0.15 * unitsPerMeter;
  let geo = new THREE.CylinderGeometry(r, r, h, 6);
  if (geo.index) geo = geo.toNonIndexed();
  geo.translate(0, h / 2, 0);
  let cap = new THREE.SphereGeometry(r, 6, 4);
  if (cap.index) cap = cap.toNonIndexed();
  cap.translate(0, h, 0);
  const merged = mergeGeometries([geo, cap]);
  geo.dispose(); cap.dispose();
  addColor(merged, 0xdc2626); // rouge
  return merged;
};

/**
 * Traffic sign: pole + sign face (octagon for stop, triangle for give_way, rectangle default).
 * OSM2World: pole r=0.05m h=2.0m, sign ~0.6m.
 */
const createTrafficSignMesh = (signType, unitsPerMeter) => {
  const poleH = 2.5 * unitsPerMeter;
  const poleR = 0.04 * unitsPerMeter;
  const signSize = 0.5 * unitsPerMeter;
  const signThk = 0.02 * unitsPerMeter;
  const parts = [];

  // Pole
  let pole = new THREE.CylinderGeometry(poleR, poleR, poleH, 6);
  if (pole.index) pole = pole.toNonIndexed();
  pole.translate(0, poleH / 2, 0);
  addColor(pole, 0x888888);
  parts.push(pole);

  // Sign face
  let signColor = 0xcc0000; // red for stop
  if (signType === "give_way" || signType === "yield") {
    signColor = 0xcc0000; // red border triangle
  } else if (signType === "generic") {
    signColor = 0x2255cc; // blue info sign
  }

  // Regular sign: flat box
  let signGeo = new THREE.BoxGeometry(signSize, signSize, signThk);
  if (signGeo.index) signGeo = signGeo.toNonIndexed();
  signGeo.translate(0, poleH + signSize * 0.1, signThk);
  addColor(signGeo, signColor);
  parts.push(signGeo);

  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
};

const createTreeMesh = (type, unitsPerMeter, options = {}) => {
  try {
    const { lightweightVegetationMode = false } = options;
    const trunkRadialSegments = lightweightVegetationMode ? 5 : 8;
    const palmFrondsCount = lightweightVegetationMode ? 5 : 8;
    const palmFrondRadialSegments = lightweightVegetationMode ? 3 : 4;
    const coniferRadialSegments = lightweightVegetationMode ? 6 : 8;
    const deciduousDetail = lightweightVegetationMode ? 0 : 1;

    const trunkHeight = (type === "palm" ? 5 : 6) * unitsPerMeter;
    let trunkGeo = new THREE.CylinderGeometry(
      0.15 * unitsPerMeter,
      0.25 * unitsPerMeter,
      trunkHeight,
      trunkRadialSegments,
    );
    if (trunkGeo.index) trunkGeo = trunkGeo.toNonIndexed();
    trunkGeo.translate(0, trunkHeight / 2, 0);
    addColor(trunkGeo, 0x5d4037);

    if (type === "palm") {
      const fronds = [];
      for (let i = 0; i < palmFrondsCount; i++) {
        let frondGeo = new THREE.CylinderGeometry(
          0.01 * unitsPerMeter,
          0.2 * unitsPerMeter,
          3.5 * unitsPerMeter,
          palmFrondRadialSegments,
        );
        if (frondGeo.index) frondGeo = frondGeo.toNonIndexed();
        frondGeo.translate(0, 1.75 * unitsPerMeter, 0);
        frondGeo.rotateZ(-Math.PI / 4); // Droop down
        frondGeo.rotateY((i / palmFrondsCount) * Math.PI * 2);
        frondGeo.translate(0, trunkHeight * 0.95, 0);
        addColor(frondGeo, 0x15803d);
        fronds.push(frondGeo);
      }
      const merged = mergeGeometries([trunkGeo, ...fronds]);
      fronds.forEach((f) => f.dispose());
      trunkGeo.dispose();
      return merged;
    } else if (type === "coniferous") {
      const crownParts = [];
      // 3 cônes empilés pour un look pin/sapin réaliste avec profondeur
      for (let i = 0; i < 3; i++) {
        let cone = new THREE.CylinderGeometry(
          0,
          (2.2 - i * 0.5) * unitsPerMeter,
          (4.0 - i * 0.5) * unitsPerMeter,
          coniferRadialSegments,
        );
        if (cone.index) cone = cone.toNonIndexed();
        cone.translate(0, (4.5 + i * 2.2) * unitsPerMeter, 0);
        addColor(cone, i % 2 === 0 ? 0x064e3b : 0x065f46); // Variation subtile de vert
        crownParts.push(cone);
      }
      const merged = mergeGeometries([trunkGeo, ...crownParts]);
      crownParts.forEach((c) => c.dispose());
      trunkGeo.dispose();
      return merged;
    } else {
      const crownParts = [];
      const baseRadius = 2.2 * unitsPerMeter;

      // Centre principal du feuillage
      let centerCrown = new THREE.IcosahedronGeometry(baseRadius, deciduousDetail);
      if (centerCrown.index) centerCrown = centerCrown.toNonIndexed();
      centerCrown.scale(1, 1.2, 1);
      centerCrown.translate(0, 6 * unitsPerMeter, 0);
      addColor(centerCrown, 0x166534);
      crownParts.push(centerCrown);

      // 4 grappes de feuilles autour pour casser la sphère parfaite (look organique/"fluffy")
      const offsets = [[1.2, 5.5, 0], [-1.2, 5.5, 0], [0, 5.5, 1.2], [0, 5.5, -1.2]];
      offsets.forEach((off, i) => {
        let p = new THREE.IcosahedronGeometry(baseRadius * 0.75, deciduousDetail);
        if (p.index) p = p.toNonIndexed();
        p.scale(1, 1.1, 1);
        p.translate(off[0] * unitsPerMeter, off[1] * unitsPerMeter, off[2] * unitsPerMeter);
        addColor(p, i % 2 === 0 ? 0x14532d : 0x166534);
        crownParts.push(p);
      });

      const merged = mergeGeometries([trunkGeo, ...crownParts]);
      crownParts.forEach((c) => c.dispose());
      trunkGeo.dispose();
      return merged;
    }
  } catch (e) {
    console.warn("Failed to create tree mesh:", e);
    return null;
  }
};

const isPointInPolygon = (point, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      zi = poly[i].z;
    const xj = poly[j].x,
      zj = poly[j].z;
    const intersect =
      zi > point.z !== zj > point.z &&
      point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const simplifyPointToSegmentDistance = (p, a, b) => {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const apx = p.x - a.x;
  const apz = p.z - a.z;
  const abLen2 = abx * abx + abz * abz;
  if (abLen2 < 1e-9) {
    const dx = p.x - a.x;
    const dz = p.z - a.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  let t = (apx * abx + apz * abz) / abLen2;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * abx;
  const pz = a.z + t * abz;
  const dx = p.x - px;
  const dz = p.z - pz;
  return Math.sqrt(dx * dx + dz * dz);
};

const simplifyRingDouglasPeucker = (points, tolerance) => {
  if (!Array.isArray(points) || points.length <= 4 || tolerance <= 0) return points;

  const result = [];
  const recurse = (start, end) => {
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = simplifyPointToSegmentDistance(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      recurse(start, index);
      recurse(index, end);
    } else {
      result.push(points[start]);
    }
  };

  recurse(0, points.length - 1);
  result.push(points[points.length - 1]);
  return result;
};

const normalizeClosedRing = (points) => {
  if (!Array.isArray(points) || points.length < 3) return [];
  const ring = points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(first.x - last.x) > 1e-6 || Math.abs(first.z - last.z) > 1e-6) {
    ring.push(new THREE.Vector3(first.x, first.y, first.z));
  }
  return ring;
};

const simplifyClosedRing = (points, tolerance) => {
  const ring = normalizeClosedRing(points);
  if (ring.length < 4 || tolerance <= 0) return ring;

  const open = ring.slice(0, -1);
  if (open.length < 3) return ring;

  const simplifiedOpen = simplifyRingDouglasPeucker(open, tolerance);
  if (simplifiedOpen.length < 3) return ring;

  const out = simplifiedOpen.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  out.push(new THREE.Vector3(out[0].x, out[0].y, out[0].z));
  return out.length >= 4 ? out : ring;
};

/**
 * Helper to generate the Three.js Mesh from TerrainData.
 * Shared by exporters to ensure identical output.
 */
const resolveTerrainTextureUrl = (data, centerTextureType = 'osm') => {
  const textureByType = {
    osm: data?.osmTextureUrl || null,
    none: null,
  };

  const requested = textureByType[centerTextureType];
  if (requested || centerTextureType === 'none') return requested;

  return (
    textureByType.osm ||
    textureByType.hybrid ||
    textureByType.satellite ||
    null
  );
};

const createTerrainMesh = async (data, maxMeshResolution = 1024, centerTextureType = 'osm') => {
  return new Promise((resolve, reject) => {
    try {
      // 1. Create Geometry
      const baseStride = Math.ceil(
        Math.max(data.width, data.height) / maxMeshResolution,
      );
      const stride = Math.max(baseStride, 1);

      const segmentsX = Math.floor((data.width - 1) / stride);
      const segmentsY = Math.floor((data.height - 1) / stride);

      const geometry = new THREE.PlaneGeometry(
        SCENE_SIZE,
        SCENE_SIZE,
        segmentsX,
        segmentsY,
      );
      const vertices = geometry.attributes.position.array;

      // Calculate scale factor (units per meter)
      const latRad =
        (((data.bounds.north + data.bounds.south) / 2) * Math.PI) / 180;
      const metersPerDegree = 111320 * Math.cos(latRad);
      const realWidthMeters =
        (data.bounds.east - data.bounds.west) * metersPerDegree;
      const unitsPerMeter = SCENE_SIZE / realWidthMeters;
      const EXAGGERATION = 1.0;

      // Apply heightmap data to vertices
      for (let i = 0; i < vertices.length / 3; i++) {
        const col = i % (segmentsX + 1);
        const row = Math.floor(i / (segmentsX + 1));

        const mapCol = Math.min(col * stride, data.width - 1);
        const mapRow = Math.min(row * stride, data.height - 1);

        const dataIndex = mapRow * data.width + mapCol;

        const u = mapCol / (data.width - 1);
        const v = mapRow / (data.height - 1);

        // Manually position X and Y to ensure they exactly match the heightmap's bounds
        // and align perfectly with surrounding tiles at the extreme boundaries.
        vertices[i * 3] = (u * SCENE_SIZE) - (SCENE_SIZE / 2);
        vertices[i * 3 + 1] = -((v * SCENE_SIZE) - (SCENE_SIZE / 2));

        // Apply height (Z becomes Y after rotation.x = -PI/2)
        // @ts-ignore
        vertices[i * 3 + 2] =
          (data.heightMap[dataIndex] - data.minHeight) *
          unitsPerMeter *
          EXAGGERATION;
      }

      geometry.computeVertexNormals();

      // 2. Create Material
      const material = new THREE.MeshStandardMaterial({
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide,
        color: 0x4d4d4d, // Couleur de fond (Gris OSM) si la texture échoue ou est absente
      });

      // 3. Helper to finalize mesh with texture
      const finalize = (tex) => {
        if (tex) {
          material.map = tex;
          material.color.setHex(0xffffff); // Réinitialise à blanc si texturé (pour ne pas teinter)
        }
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = "center_terrain";
        // Rotate to make it lie flat (Y-up) in standard 3D viewers
        mesh.rotation.x = -Math.PI / 2;
        mesh.updateMatrixWorld();
        resolve(mesh);
      };

      // 4. Load Texture
      // Prefer in-memory canvas when OSM texture is available (avoids URL expiry issues).
      const directCanvasMap = {
        osm: data?.osmTextureCanvas,
      };
      const directCanvas = directCanvasMap[centerTextureType];
      if (directCanvas) {
        const tex = new THREE.CanvasTexture(directCanvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        finalize(tex);
      } else {
        // Satellite and other types: load from URL
        const textureUrl = resolveTerrainTextureUrl(data, centerTextureType);
        if (textureUrl) {
          const loader = new THREE.TextureLoader();
          loader.load(
            textureUrl,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.minFilter = THREE.LinearMipmapLinearFilter;
              tex.magFilter = THREE.LinearFilter;
              finalize(tex);
            },
            undefined,
            (err) => {
              console.warn("Failed to load texture, exporting mesh only.", err);
              finalize();
            },
          );
        } else {
          finalize();
        }
      }
    } catch (e) {
      reject(e);
    }
  });
};

const _estimateRoadWidth = (tags) => {
  if (!tags) return 6;
  if (tags.width) {
    const w = parseFloat(String(tags.width));
    if (Number.isFinite(w) && w > 0) return w;
  }
  const hw = tags.highway;
  const isOneWay = tags.oneway === 'yes' || tags.oneway === '1' || hw === 'motorway';
  const lanes = parseInt(tags.lanes) || null;
  const laneWidth = {
    motorway: 3.7, motorway_link: 3.5, trunk: 3.7, trunk_link: 3.5,
    primary: 3.5, primary_link: 3.25, secondary: 3.5, secondary_link: 3.25,
    tertiary: 3.25, tertiary_link: 3.0, residential: 3.0, unclassified: 3.0,
    living_street: 2.75, service: 2.75,
  }[hw] || 3.0;
  if (lanes) return lanes * laneWidth;
  const defaults = {
    motorway: 14.8, trunk: 14.0, primary: 13.0, secondary: 10.5,
    tertiary: 9.0, residential: 8.0, unclassified: 6.0,
    service: 4.0, living_street: 5.0,
    footway: 2.0, path: 1.5, cycleway: 2.0, pedestrian: 3.0,
    track: 3.0, steps: 2.0,
  };
  if (defaults[hw]) return isOneWay ? defaults[hw] * 0.6 : defaults[hw];
  return 6;
};

const getRoadColorHex = (tags) => {
  const hw = tags?.highway;
  if (["footway", "path", "pedestrian", "steps", "cycleway"].includes(hw)) return 0x7a7a7a;
  if (hw === "track") return 0x73685a;
  return 0x404040;
};

export const createOSMGroup = (data, options = {}) => {
  // NOTE: This function is shared by both preview and export code paths.
  // Building geometry uses the unified lightweight pipeline everywhere.
  // Memory-budget options below remain primarily useful for preview callers.
  const {
    includeBuildings = true,
    includeVegetation = true,
    includeStreetFurniture = true,
    includeRoadMeshes = false,
    maxBuildings = Number.POSITIVE_INFINITY,
    maxTrees = 5000,
    maxBushes = 5000,
    maxStreetFurniture = 3000,
    simplifyBuildingFootprints = false,
    footprintSimplifyTolerance = 0,
    lightweightVegetationMode = false,
    regionProfile = null,
  } = options;

  const pickStyle = (seed) => {
    if (!regionProfile) return 'classique';
    const r = ((seed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
    let acc = 0;
    for (const { id, weight } of regionProfile.styles) {
      acc += weight;
      if (r < acc) return id;
    }
    return regionProfile.styles[regionProfile.styles.length - 1].id;
  };
  const group = new THREE.Group();
  if (!data.osmFeatures || data.osmFeatures.length === 0) return group;

  // Calcul de la moyenne des étages pour les bâtiments ayant l'information
  let totalKnownLevels = 0;
  let knownLevelsCount = 0;
  data.osmFeatures.forEach((f) => {
    if (f.type === "building" && f.tags) {
      const levels = parseFloat(f.tags["building:levels"] || f.tags.levels);
      if (levels > 0) {
        totalKnownLevels += levels;
        knownLevelsCount++;
      } else if (f.tags.height) {
        const h = parseFloat(f.tags.height);
        if (h > 0) {
          totalKnownLevels += Math.max(1, Math.round(h / 3.0));
          knownLevelsCount++;
        }
      }
    }
  });
  const averageLevels = knownLevelsCount > 0 ? Math.max(1, Math.round(totalKnownLevels / knownLevelsCount)) : null;

  const latRad =
    (((data.bounds.north + data.bounds.south) / 2) * Math.PI) / 180;
  const metersPerDegree = 111320 * Math.cos(latRad);
  const realWidthMeters =
    (data.bounds.east - data.bounds.west) * metersPerDegree;
  const unitsPerMeter = SCENE_SIZE / realWidthMeters;
  const footprintSimplifyToleranceScene = Math.max(0, Number(footprintSimplifyTolerance) || 0) * unitsPerMeter;

  const buildingsList = [];
  const treesList = [];
  const bushesList = [];
  const streetFurnitureList = [];
  const roadsList = [];
  // Collect road/path centerline segments in scene coords for orienting furniture
  const roadSegments = [];

  /**
   * Advanced Building Configuration Parser
   * Inspired by OSM2World's LevelAndHeightData and BuildingDefaults
   */
  const getBuildingConfig = (tags, areaMeters = 0, seed = 0, regionProfile = null) => {
    const DEFAULT_HEIGHT_LEVEL = 3.0;

    let buildingLevels =
      parseFloat(tags["building:levels"] || tags.levels) || 0;
    let minLevel =
      parseFloat(tags["building:min_level"] || tags.min_level) || 0;
    let roofLevels =
      parseFloat(tags["roof:levels"] || tags["building:roof:levels"]) || 0;
    let roofHeight =
      parseFloat(tags["roof:height"] || tags["building:roof:height"]) || 0;

    const type = tags.building || tags["building:part"] || "yes";
    let defaultLevels = averageLevels !== null ? averageLevels : 1;
    if (["house", "detached", "duplex", "terrace"].includes(type))
      defaultLevels = 2;
    else if (
      ["apartments", "office", "commercial", "retail", "hotel"].includes(type)
    )
      defaultLevels = averageLevels !== null ? Math.max(4, averageLevels) : 4;

    if (buildingLevels === 0) {
      if (tags.height)
        buildingLevels = Math.max(
          1,
          Math.round(parseFloat(tags.height) / DEFAULT_HEIGHT_LEVEL),
        );
      else if (areaMeters > 2000) buildingLevels = 5;
      else buildingLevels = defaultLevels;
    }

    let height = 0;
    if (tags.height) {
      height = parseFloat(tags.height);
    } else {
      height = (buildingLevels + roofLevels) * DEFAULT_HEIGHT_LEVEL;
      if (type === "church" || type === "cathedral")
        height = 20 + Math.random() * 10;
      else if (type === "garage" || type === "shed") height = 3.5;
      else if (type === "roof") height = 4;
    }

    let minHeight = 0;
    if (tags.min_height) minHeight = parseFloat(tags.min_height);
    else if (minLevel > 0) minHeight = minLevel * DEFAULT_HEIGHT_LEVEL;

    const roofShape =
      tags["roof:shape"] || tags["building:roof:shape"] || "flat";
    if (roofHeight === 0 && roofShape !== "flat") {
      roofHeight = roofLevels > 0 ? roofLevels * DEFAULT_HEIGHT_LEVEL : 3.0;
    }

    // --- Color & Material Logic (OSM2World inspired) ---
    const BUILDING_COLORS = {
      white: 0xfcfcfc,
      black: 0x4c4c4c,
      grey: 0x646464,
      gray: 0x646464,
      red: 0xffbebe, // Soft pink/red for buildings
      green: 0xbeffbe,
      blue: 0xbebeff,
      yellow: 0xffffaf,
      pink: 0xe1afe1,
      orange: 0xffe196,
      brown: 0xaa8250,
    };

    const ROOF_COLORS = {
      red: 0xcc0000,
      green: 0x96c882,
      blue: 0x6432c8,
      brown: 0x786e6e,
    };

    const MATERIAL_COLORS = {
      brick: 0xb91c1c,
      concrete: 0x9ca3af,
      stone: 0x6b7280,
      wood: 0x92400e,
      glass: 0x1e293b,
      metal: 0x4b5563,
    };

    const parseO2WColor = (colorTag, colorPalette, defaultColor) => {
      if (!colorTag) return defaultColor;
      if (colorPalette[colorTag.toLowerCase()])
        return colorPalette[colorTag.toLowerCase()];
      try {
        return new THREE.Color(colorTag).getHex();
      } catch (e) {
        return defaultColor;
      }
    };

    // Material overrides
    const wallMaterial = tags["building:material"] || tags["material"];
    const roofMaterial =
      tags["roof:material"] || tags["building:roof:material"];

    let wallColor = parseO2WColor(
      tags["building:colour"] ||
      tags["building:color"] ||
      tags.colour ||
      tags.color,
      BUILDING_COLORS,
      0xefd1a1,
    );
    if (
      wallMaterial &&
      MATERIAL_COLORS[wallMaterial.toLowerCase()] &&
      !tags["building:colour"]
    ) {
      wallColor = MATERIAL_COLORS[wallMaterial.toLowerCase()];
    }

    let buildingType = 'default';
    if (['apartments', 'residential', 'dormitory', 'student_accommodation'].includes(type))
      buildingType = 'residential';
    else if (['office', 'commercial', 'retail', 'hotel', 'supermarket', 'civic', 'government', 'public'].includes(type))
      buildingType = 'office';
    else if (['house', 'detached', 'semidetached_house', 'semi', 'terrace', 'bungalow', 'cabin', 'farm'].includes(type))
      buildingType = 'house';
    else if (['industrial', 'warehouse', 'storage', 'factory', 'barn'].includes(type))
      buildingType = 'industrial';

    const styleId = ['house', 'industrial'].includes(buildingType)
      ? buildingType
      : pickStyle(seed);

    let defaultRoofColor = 0x3a3a3a;
    const palette = regionProfile?.roofColors?.[styleId] || regionProfile?.roofColors?.[buildingType] || regionProfile?.roofColors?.['default'] || [0x3a3a3a];
    defaultRoofColor = palette[seed % palette.length];

    let roofColor = parseO2WColor(
      tags["roof:colour"] || tags["roof:color"] || tags["building:roof:colour"],
      ROOF_COLORS,
      defaultRoofColor,
    );
    if (
      roofMaterial &&
      MATERIAL_COLORS[roofMaterial.toLowerCase()] &&
      !tags["roof:colour"]
    ) {
      roofColor = MATERIAL_COLORS[roofMaterial.toLowerCase()];
    }

    return {
      height: height * unitsPerMeter,
      minHeight: minHeight * unitsPerMeter,
      wallColor,
      roofColor,
      roofShape,
      roofHeight: roofHeight * unitsPerMeter,
      levels: buildingLevels,
      buildingType,
      styleId,
      hasExplicitColor: !!(tags["building:colour"] || tags["building:color"] || tags.colour || tags.color),
    };
  };

  data.osmFeatures.forEach((f) => {
    if (!f.geometry[0]) return;

    // Collect road/path segments for furniture orientation
    if (f.type === "road" && f.geometry.length >= 2) {
      let prev = latLngToSceneFast(data, f.geometry[0].lat, f.geometry[0].lng);
      let prevX = prev.x, prevZ = prev.z;
      for (let i = 1; i < f.geometry.length; i++) {
        const cur = latLngToSceneFast(data, f.geometry[i].lat, f.geometry[i].lng);
        roadSegments.push(prevX, prevZ, cur.x, cur.z);
        prevX = cur.x;
        prevZ = cur.z;
      }

      if (includeRoadMeshes && !["proposed", "construction"].includes(f.tags?.highway)) {
        const width = _estimateRoadWidth(f.tags);
        const colorHex = getRoadColorHex(f.tags);
        const points = f.geometry.map((p) => latLngToScene(data, p.lat, p.lng));
        roadsList.push({ points, width, colorHex });
      }
    }

    if (includeBuildings && f.type === "building" && f.geometry.length > 2) {
      if (buildingsList.length >= maxBuildings) return;
      const rawPoints = f.geometry.map((p) => latLngToScene(data, p.lat, p.lng));
      const points = simplifyBuildingFootprints
        ? simplifyClosedRing(rawPoints, footprintSimplifyToleranceScene)
        : normalizeClosedRing(rawPoints);
      if (points.length < 4) return;
      let area = 0;
      for (let i = 0; i < points.length - 1; i++) {
        const j = i + 1;
        area += points[i].x * points[j].z - points[j].x * points[i].z;
      }
      const areaMeters = Math.abs(area) / 2 / (unitsPerMeter * unitsPerMeter);

      // Safeguard: Skip extruding buildings that are impossibly large (likely landuse errors)
      // 50,000 sqm is a very large building (like a massive mall or factory)
      const isLargeIndustry = [
        "industrial",
        "warehouse",
        "retail",
        "commercial",
      ].includes(f.tags.building);
      if (areaMeters > 50000 && !isLargeIndustry) {
        return;
      }

      const bSeed = Math.abs(Math.round(points[0].x * 100) * 1000 + Math.round(points[0].z * 100));
      const config = getBuildingConfig(f.tags, areaMeters, bSeed, regionProfile);

      const styleId = config.styleId;

      // Apply style wall-color palette when OSM doesn't specify a colour
      if (!config.hasExplicitColor && STYLE_DEFS[styleId]?.wallColors) {
        const palette = STYLE_DEFS[styleId].wallColors;
        config.wallColor = parseInt(palette[bSeed % palette.length].replace('#', ''), 16);
      }
      const holes = (f.holes || [])
        .map((h) => {
          const rawHole = h.map((p) => latLngToScene(data, p.lat, p.lng));
          return simplifyBuildingFootprints
            ? simplifyClosedRing(rawHole, footprintSimplifyToleranceScene)
            : normalizeClosedRing(rawHole);
        })
        .filter((h) => h.length >= 4);
      let avgH = 0;
      f.geometry.forEach((p) => (avgH += getTerrainHeight(data, p.lat, p.lng)));
      const buildingData = {
        points,
        holes,
        y: avgH / f.geometry.length + config.minHeight,
        height: Math.max(0.1, config.height - config.minHeight),
        areaMeters,
        ...config,
      };
      buildingsList.push(buildingData);
    } else if (includeStreetFurniture && f.type === "street_furniture" && f.geometry.length === 1) {
      if (streetFurnitureList.length >= maxStreetFurniture) return;
      const v = latLngToScene(data, f.geometry[0].lat, f.geometry[0].lng);
      v.y = getHeightAtScenePos(data, v.x, v.z);
      let subtype = "generic";
      if (f.tags.highway === "street_lamp") subtype = "street_lamp";
      else if (f.tags.barrier === "bollard") subtype = "bollard";
      else if (f.tags.amenity === "bench") subtype = "bench";
      else if (f.tags.amenity === "waste_basket") subtype = "waste_basket";
      else if (f.tags.amenity === "post_box") subtype = "post_box";
      else if (f.tags.emergency === "fire_hydrant") subtype = "fire_hydrant";
      else if (f.tags.highway === "give_way") subtype = "give_way";
      else if (f.tags.traffic_sign) subtype = "generic";
      streetFurnitureList.push({ pos: v, subtype, tags: f.tags });
    } else if (includeVegetation && f.type === "vegetation") {
      const isTree =
        f.tags.natural === "tree" ||
        f.tags.natural === "wood" ||
        f.tags.landuse === "forest" ||
        f.tags.natural === "tree_row" ||
        f.tags.natural === "tree_group";
      const isBush =
        f.tags.natural === "scrub" ||
        f.tags.natural === "heath" ||
        f.tags.barrier === "hedge";
      if (isTree) {
        let treeType = "deciduous";
        if (f.tags.leaf_type === "needleleaved" || f.tags.wood === "coniferous")
          treeType = "coniferous";
        if (
          f.tags.leaf_type === "palm" ||
          (f.tags.species && f.tags.species.toLowerCase().includes("palm"))
        )
          treeType = "palm";

        if (
          f.geometry.length > 3 &&
          f.geometry[0].lat === f.geometry[f.geometry.length - 1].lat
        ) {
          const points = f.geometry.map((p) =>
            latLngToScene(data, p.lat, p.lng),
          );
          let minX = Infinity,
            maxX = -Infinity,
            minZ = Infinity,
            maxZ = -Infinity;
          points.forEach((p) => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minZ = Math.min(minZ, p.z);
            maxZ = Math.max(maxZ, p.z);
          });
          const density = 0.04 / (unitsPerMeter * unitsPerMeter);
          const remaining = maxTrees - treesList.length;
          if (remaining <= 0) return;
          const count = Math.min(
            remaining,
            250,
            Math.floor((maxX - minX) * (maxZ - minZ) * density),
          );
          for (let i = 0; i < count; i++) {
            const rx = minX + Math.random() * (maxX - minX),
              rz = minZ + Math.random() * (maxZ - minZ);
            if (isPointInPolygon({ x: rx, z: rz }, points)) {
              treesList.push({
                pos: new THREE.Vector3(
                  rx,
                  getHeightAtScenePos(data, rx, rz),
                  rz,
                ),
                type: treeType,
              });
            }
          }
        } else {
          f.geometry.forEach((p) => {
            if (treesList.length >= maxTrees) return;
            const v = latLngToScene(data, p.lat, p.lng);
            v.y = getHeightAtScenePos(data, v.x, v.z);
            treesList.push({ pos: v, type: treeType });
          });
        }
      } else if (isBush) {
        if (
          f.geometry.length > 3 &&
          f.geometry[0].lat === f.geometry[f.geometry.length - 1].lat
        ) {
          const points = f.geometry.map((p) =>
            latLngToScene(data, p.lat, p.lng),
          );
          let minX = Infinity,
            maxX = -Infinity,
            minZ = Infinity,
            maxZ = -Infinity;
          points.forEach((p) => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minZ = Math.min(minZ, p.z);
            maxZ = Math.max(maxZ, p.z);
          });
          const density = 0.02 / (unitsPerMeter * unitsPerMeter);
          const bushRemaining = maxBushes - bushesList.length;
          if (bushRemaining <= 0) return;
          const count = Math.min(
            bushRemaining,
            250,
            Math.floor((maxX - minX) * (maxZ - minZ) * density),
          );
          for (let i = 0; i < count; i++) {
            const rx = minX + Math.random() * (maxX - minX),
              rz = minZ + Math.random() * (maxZ - minZ);
            if (isPointInPolygon({ x: rx, z: rz }, points)) {
              bushesList.push(
                new THREE.Vector3(rx, getHeightAtScenePos(data, rx, rz), rz),
              );
            }
          }
        } else {
          f.geometry.forEach((p) => {
            if (bushesList.length >= maxBushes) return;
            const v = latLngToScene(data, p.lat, p.lng);
            v.y = getHeightAtScenePos(data, v.x, v.z);
            bushesList.push(v);
          });
        }
      }
    }
  });

  if (Number.isFinite(maxTrees) && treesList.length >= maxTrees) {
    console.warn(`[OSM] Tree count capped at ${maxTrees} to prevent memory issues`);
  }
  if (Number.isFinite(maxBushes) && bushesList.length >= maxBushes) {
    console.warn(`[OSM] Bush count capped at ${maxBushes} to prevent memory issues`);
  }
  if (Number.isFinite(maxBuildings) && buildingsList.length >= maxBuildings) {
    console.warn(`[OSM] Building count capped at ${maxBuildings} for memory safety`);
  }

  if (buildingsList.length > 0) {
    // ── Facade texture pipeline ──────────────────────────────────────────
    const PPM = 32; // pixels per meter

    // Derive tangent-space normal map from grayscale albedo via Sobel filter
    const sobelNormalMap = (albCtx, W, H, strength) => {
      const src = albCtx.getImageData(0, 0, W, H).data;
      const nc = document.createElement('canvas');
      nc.width = W; nc.height = H;
      const nctx = nc.getContext('2d');
      const out = nctx.createImageData(W, H);
      const g = (x, y) => src[((Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))) * 4)] / 255;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const dx = (g(x + 1, y - 1) + 2 * g(x + 1, y) + g(x + 1, y + 1)) - (g(x - 1, y - 1) + 2 * g(x - 1, y) + g(x - 1, y + 1));
          const dy = (g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1)) - (g(x - 1, y - 1) + 2 * g(x, y - 1) + g(x + 1, y - 1));
          const nx = -dx * strength, ny = dy * strength, nz = 1.0;
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          const i = (y * W + x) * 4;
          out.data[i] = (nx / len * 0.5 + 0.5) * 255 | 0;
          out.data[i + 1] = (ny / len * 0.5 + 0.5) * 255 | 0;
          out.data[i + 2] = (nz / len * 0.5 + 0.5) * 255 | 0;
          out.data[i + 3] = 255;
        }
      }
      nctx.putImageData(out, 0, 0);
      return nc;
    };

    const makeTex = (canvas, srgb = true) => {
      const t = new THREE.CanvasTexture(canvas);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };

    // Build a wall material from a draw function + tile dimensions
    const buildFacadeMat = (tileW, tileH, drawFn, roughness, normalStrength = 5.0) => {
      const W = tileW * PPM | 0, H = tileH * PPM | 0;
      const alb = document.createElement('canvas');
      alb.width = W; alb.height = H;
      const ctx = alb.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      drawFn(ctx, W, H, PPM);
      return {
        tileW, tileH,
        wallMat: new THREE.MeshStandardMaterial({
          vertexColors: true,
          map: makeTex(alb),
          normalMap: makeTex(sobelNormalMap(ctx, W, H, normalStrength), false),
          normalScale: new THREE.Vector2(1.2, 1.2),
          roughness,
          metalness: 0.02,
          side: THREE.DoubleSide,
        }),
        roofMat: new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: roughness * 0.85,
          metalness: 0.0,
          side: THREE.DoubleSide,
        }),
      };
    };

    // ── Facade definitions: house + industrial (fixed) + active urban styles ──
    const houseDrawFn = (ctx, W, H, PPM) => {
      ctx.fillStyle = '#e2d5c3'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f0e6d5'; ctx.fillRect(0, H - PPM * 0.18, W, PPM * 0.18);
      const wW = PPM * 1.1, wH = PPM * 1.4, wY = PPM * 0.6;
      [W * 0.25, W * 0.73].forEach(cx => {
        const wx = cx - wW / 2;
        ctx.fillStyle = '#c2b6a3'; ctx.fillRect(wx - 4, wY - 4, wW + 8, wH + 12);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(wx, wY, wW, wH);
        ctx.fillStyle = '#22262a';
        ctx.fillRect(wx + 4, wY + 4, wW / 2 - 6, wH - 8);
        ctx.fillRect(wx + wW / 2 + 2, wY + 4, wW / 2 - 6, wH - 8);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(wx + wW / 2 - 1, wY + 4, 2, wH - 8);
      });
    };
    const industrialDrawFn = (ctx, W, H, PPM) => {
      ctx.fillStyle = '#8b453a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#70352e';
      for (let y = 0; y < H; y += PPM * 0.15 | 0) ctx.fillRect(0, y, W, 1);
      ctx.fillStyle = '#5e2d27';
      for (let y = 0; y < H; y += PPM * 0.15 | 0) {
        for (let x = 0; x < W; x += PPM * 0.3 | 0) {
          const ox = (y / (PPM * 0.15 | 0)) % 2 === 0 ? 0 : PPM * 0.15 | 0;
          ctx.fillRect(x + ox, y, 1, PPM * 0.15 | 0);
        }
      }
      const wW = W * 0.55 | 0, wH = PPM * 1.5 | 0,
        wx = (W - wW) / 2 | 0, wy = PPM * 1.2 | 0;
      ctx.fillStyle = '#333333'; ctx.fillRect(wx - 4, wy - 4, wW + 8, wH + 8);
      ctx.fillStyle = '#111111'; ctx.fillRect(wx, wy, wW, wH);
      ctx.fillStyle = '#444444';
      for (let i = 1; i < 4; i++) ctx.fillRect(wx + (wW / 4 * i) | 0, wy, 2, wH);
      for (let i = 1; i < 3; i++) ctx.fillRect(wx, wy + (wH / 3 * i) | 0, wW, 2);
    };

    const FACADES = {
      house: buildFacadeMat(5, 3, houseDrawFn, 0.88),
      industrial: buildFacadeMat(6, 4, industrialDrawFn, 0.92),
    };
    // Add one facade per active urban style
    const _activeStyleIds = new Set(
      buildingsList
        .filter(b => !['house', 'industrial'].includes(b.buildingType))
        .map(b => b.styleId)
    );
    for (const sid of _activeStyleIds) {
      const def = STYLE_DEFS[sid];
      if (def) FACADES[sid] = buildFacadeMat(def.floorW, def.floorH, def.draw, def.roughness, def.normalStrength);
    }


    // ── Rez-de-chaussée : 3 tuiles distinctes ────────────────────────────

    // Fenêtres résidentielles (3m × 4m)
    const GROUND_WIN = buildFacadeMat(3.0, 4.0, (ctx, W, H) => {
      ctx.fillStyle = '#e2d6c2'; ctx.fillRect(0, 0, W, H);
      const soubas = PPM * 0.5;
      ctx.fillStyle = '#ccc2ae'; ctx.fillRect(0, H - soubas, W, soubas);
      ctx.fillStyle = '#b8ad9a'; ctx.fillRect(0, H - soubas - 2, W, 2);

      const wW = PPM * 1.1, wH = PPM * 1.75;
      const wX = (W - wW) / 2, wY = H - soubas - wH - PPM * 0.2;

      // Encadrement pierre
      ctx.fillStyle = '#cfc5b1'; ctx.fillRect(wX - 7, wY - 8, wW + 14, wH + 14);
      // Linteau
      ctx.fillStyle = '#c0b6a2'; ctx.fillRect(wX - 9, wY - 10, wW + 18, 6);
      // Appui de fenêtre
      ctx.fillStyle = '#b8ad9a'; ctx.fillRect(wX - 9, wY + wH, wW + 18, 7);

      const gW = (wW - 5) / 2;
      ctx.fillStyle = '#4f6070'; ctx.globalAlpha = 0.82;
      ctx.fillRect(wX, wY, gW, wH);
      ctx.fillRect(wX + gW + 5, wY, gW, wH);
      ctx.globalAlpha = 1.0;

      // Meneau vertical et traverse
      ctx.fillStyle = '#cfc5b1';
      ctx.fillRect(wX + gW, wY, 5, wH);
      ctx.fillRect(wX, wY + wH * 0.42, wW, 3);

      // Grille en fer forgé (partie basse)
      ctx.fillStyle = '#222'; ctx.globalAlpha = 0.2;
      for (let gy = wY + wH * 0.6; gy < wY + wH - 4; gy += 5) ctx.fillRect(wX + 2, gy, wW - 4, 1);
      ctx.globalAlpha = 1.0;
    }, 0.72, 3.5);

    // Porte d'entrée cochère (2.5m × 4m)
    const GROUND_DOOR = buildFacadeMat(2.5, 4.0, (ctx, W, H) => {
      ctx.fillStyle = '#e2d6c2'; ctx.fillRect(0, 0, W, H);
      const soubas = PPM * 0.5;
      ctx.fillStyle = '#ccc2ae'; ctx.fillRect(0, H - soubas, W, soubas);
      ctx.fillStyle = '#b8ad9a'; ctx.fillRect(0, H - soubas - 2, W, 2);

      const dW = PPM * 1.4, dH = H - soubas;
      const dX = (W - dW) / 2;
      const archR = dW / 2;
      const archCY = archR; // arche centrée en haut

      // Encadrement pierre (voussures)
      ctx.fillStyle = '#c8bfaa';
      ctx.beginPath();
      ctx.arc(W / 2, archCY, archR + 9, Math.PI, 0);
      ctx.lineTo(dX + dW + 9, H - soubas);
      ctx.lineTo(dX - 9, H - soubas);
      ctx.closePath();
      ctx.fill();

      // Imposte vitrée (demi-cercle supérieur)
      ctx.fillStyle = '#6a8090'; ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.arc(W / 2, archCY, archR - 3, Math.PI, 0);
      ctx.lineTo(dX + dW - 3, archCY);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Vantaux en bois (partie rectangulaire)
      const panelY = archCY, panelH = dH - archCY;
      ctx.fillStyle = '#5c4030';
      ctx.fillRect(dX, panelY, dW, panelH);

      // Séparation des vantaux + moulures horizontales
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(dX + dW / 2 - 2, panelY, 4, panelH);
      ctx.fillRect(dX, panelY + panelH * 0.32, dW, 2);
      ctx.fillRect(dX, panelY + panelH * 0.64, dW, 2);

      // Poignées laiton
      ctx.fillStyle = '#c8a840';
      ctx.fillRect(dX + dW * 0.28 | 0, (panelY + panelH * 0.5 - 4) | 0, 4, 9);
      ctx.fillRect(dX + dW * 0.68 | 0, (panelY + panelH * 0.5 - 4) | 0, 4, 9);

      // Plaque interphone
      ctx.fillStyle = '#999';
      ctx.fillRect((dX + dW + 4) | 0, (panelY + panelH * 0.35) | 0, 7, 12);
    }, 0.72, 3.5);

    // Devanture boutique (4m × 4m)
    const GROUND_SHOP = buildFacadeMat(4.0, 4.0, (ctx, W, H) => {
      ctx.fillStyle = '#e6decb'; ctx.fillRect(0, 0, W, H);
      const padX = PPM * 0.4;
      const shopH = H - PPM * 0.6;
      ctx.fillStyle = '#d4cbb3'; ctx.fillRect(0, 0, W, shopH);

      // Bandeau d'enseigne
      ctx.fillStyle = '#c2b8a3'; ctx.fillRect(0, 0, W, PPM * 0.9);
      ctx.fillStyle = '#9e9581';
      ctx.fillRect(0, PPM * 0.15, W, 2);
      ctx.fillRect(0, PPM * 0.75, W, 2);

      // Vitrine
      const glassW = W - padX * 2, glassH = shopH - PPM * 1.8, glassY = PPM * 1.8;
      ctx.fillStyle = '#b0a793'; ctx.fillRect(padX, PPM * 0.9, glassW, PPM * 0.9);
      ctx.fillStyle = '#1a1c1e'; ctx.fillRect(padX, glassY, glassW, glassH);
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.1;
      ctx.beginPath(); ctx.moveTo(padX, glassY); ctx.lineTo(padX + glassW * 0.5, glassY); ctx.lineTo(padX, glassY + glassH * 0.8); ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#d4cbb3'; ctx.fillRect(W / 2 - 2, glassY, 4, glassH);
      ctx.fillStyle = '#8b3a3a'; ctx.fillRect(0, PPM * 0.9, W, PPM * 0.15);
    }, 0.6, 4.0);

    // ── Geometry helpers ─────────────────────────────────────────────────
    const _buildWall = (pts, holes, yBase, yTop, hexColor, tileW, tileH) => {
      const pos = [], uv = [], col = [];
      const c = new THREE.Color(hexColor);
      const vH = (yTop - yBase) / unitsPerMeter / tileH;
      const addRing = (ring) => {
        for (let i = 0; i < ring.length - 1; i++) {
          const a = ring[i], b = ring[i + 1];
          const dx = b.x - a.x, dz = b.z - a.z;
          const uE = Math.sqrt(dx * dx + dz * dz) / unitsPerMeter / tileW;
          pos.push(a.x, yBase, a.z, b.x, yBase, b.z, b.x, yTop, b.z, a.x, yBase, a.z, b.x, yTop, b.z, a.x, yTop, a.z);
          uv.push(0, 0, uE, 0, uE, vH, 0, 0, uE, vH, 0, vH);
          for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
        }
      };
      addRing(pts);
      holes.forEach(addRing);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      return geo;
    };

    // Génère un quad mural pour un segment d'arête avec la tuile choisie
    const _buildEdgeSegment = (p0, p1, yBase, yTop, tile) => {
      const dx = p1.x - p0.x, dz = p1.z - p0.z;
      const segLen = Math.sqrt(dx * dx + dz * dz);
      const uE = segLen / unitsPerMeter / tile.tileW;
      const vH = (yTop - yBase) / unitsPerMeter / tile.tileH;
      const pos = [
        p0.x, yBase, p0.z, p1.x, yBase, p1.z, p1.x, yTop, p1.z,
        p0.x, yBase, p0.z, p1.x, yTop, p1.z, p0.x, yTop, p0.z,
      ];
      const uv = [0, 0, uE, 0, uE, vH, 0, 0, uE, vH, 0, vH];
      const col = new Float32Array(18); col.fill(1.0);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      return geo;
    };

    // Génère le rez-de-chaussée segment par segment :
    // - une porte sur le côté le plus long (centre)
    // - ~15 % de boutiques aléatoires
    // - fenêtres résidentielles partout ailleurs
    const _buildGroundFloor = (pts, holes, yBase, yTop, seed) => {
      const winGeos = [], doorGeos = [], shopGeos = [];

      let longestEdgeIdx = 0, longestLen = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x, dz = pts[i + 1].z - pts[i].z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len > longestLen) { longestLen = len; longestEdgeIdx = i; }
      }

      let doorPlaced = false;

      const processRing = (ring, isExterior) => {
        for (let ei = 0; ei < ring.length - 1; ei++) {
          const a = ring[ei], b = ring[ei + 1];
          const dx = b.x - a.x, dz = b.z - a.z;
          const edgeLen = Math.sqrt(dx * dx + dz * dz);
          const segW = 3.0 * unitsPerMeter;
          const numSegs = Math.max(1, Math.round(edgeLen / segW));
          const isDoorEdge = isExterior && !doorPlaced && ei === longestEdgeIdx;
          const doorSeg = isDoorEdge ? Math.floor(numSegs / 2) : -1;
          if (isDoorEdge) doorPlaced = true;

          for (let si = 0; si < numSegs; si++) {
            const t0 = si / numSegs, t1 = (si + 1) / numSegs;
            const p0 = { x: a.x + dx * t0, z: a.z + dz * t0 };
            const p1 = { x: a.x + dx * t1, z: a.z + dz * t1 };
            const rng = (seed + ei * 17 + si * 31) % 100;
            let tile, arr;
            if (si === doorSeg) {
              tile = GROUND_DOOR; arr = doorGeos;
            } else if (rng < 15) {
              tile = GROUND_SHOP; arr = shopGeos;
            } else {
              tile = GROUND_WIN; arr = winGeos;
            }
            arr.push(_buildEdgeSegment(p0, p1, yBase, yTop, tile));
          }
        }
      };

      processRing(pts, true);
      holes.forEach(h => processRing(h, false));
      return { winGeos, doorGeos, shopGeos };
    };

    const _colorBuf = (hex, count) => {
      const c = new THREE.Color(hex), arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      return arr;
    };

    const _roofFromPos = (pos, hex) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const nonIndexed = geo.toNonIndexed();
      geo.dispose();
      nonIndexed.setAttribute('color', new THREE.Float32BufferAttribute(_colorBuf(hex, nonIndexed.attributes.position.count), 3));
      nonIndexed.computeVertexNormals();
      return nonIndexed;
    };

    const _flatRoof = (pts, holes, y, hex) => {
      const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, -p.z)));
      holes.forEach(h => shape.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p.x, -p.z)))));
      const g = new THREE.ShapeGeometry(shape);
      g.rotateX(-Math.PI / 2); g.translate(0, y, 0); g.deleteAttribute('uv');
      const ni = g.toNonIndexed(); g.dispose();
      ni.setAttribute('color', new THREE.Float32BufferAttribute(_colorBuf(hex, ni.attributes.position.count), 3));
      ni.computeVertexNormals();
      return ni;
    };

    const _foundationSlab = (pts, holes, y) => {
      const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, -p.z)));
      holes.forEach(h => shape.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p.x, -p.z)))));
      const g = new THREE.ShapeGeometry(shape);
      g.rotateX(-Math.PI / 2);
      g.translate(0, y, 0);

      const textureRepeatMeters = 4;
      const uvScaleFactor = 1 / (textureRepeatMeters * unitsPerMeter);
      const pos = g.attributes.position;
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uvs[i * 2] = pos.getX(i) * uvScaleFactor;
        uvs[i * 2 + 1] = pos.getZ(i) * uvScaleFactor;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      const ni = g.toNonIndexed();
      g.dispose();
      ni.computeVertexNormals();
      return ni;
    };

    const _pyramidalRoof = (pts, yBase, rH, hex) => {
      const n = pts.length - 1;
      let cx = 0, cz = 0;
      for (let i = 0; i < n; i++) { cx += pts[i].x; cz += pts[i].z; }
      cx /= n; cz /= n;
      const yA = yBase + rH, pos = [];
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        pos.push(cx, yA, cz, a.x, yBase, a.z, b.x, yBase, b.z);
      }
      return _roofFromPos(pos, hex);
    };


    const _prepGeo = (g, hex) => {
      const ni = g.index ? g.toNonIndexed() : g;
      if (g !== ni) g.dispose();
      ni.deleteAttribute('uv');
      addColor(ni, hex);
      ni.computeVertexNormals();
      return ni;
    };

    const _createRoofDetails = (pts, yBase, unitsPerMeter, bType, areaMeters) => {
      const parts = [];
      let cx = 0, cz = 0;
      for (let p of pts) { cx += p.x; cz += p.z; }
      cx /= pts.length; cz /= pts.length;

      if (['office', 'commercial', 'retail', 'industrial'].includes(bType) && Math.random() > 0.3) {
        const numAC = Math.min(6, Math.max(1, Math.floor(areaMeters / 120)));
        for (let i = 0; i < numAC; i++) {
          const s = (0.8 + Math.random() * 0.6) * unitsPerMeter;
          let box = new THREE.BoxGeometry(s, s * 0.8, s);
          const ox = (Math.random() - 0.5) * 3 * unitsPerMeter;
          const oz = (Math.random() - 0.5) * 3 * unitsPerMeter;
          box.translate(cx + ox, yBase + s * 0.4, cz + oz);
          parts.push(_prepGeo(box, 0x9ca3af));
        }
      }

      if (parts.length === 0) return null;
      const merged = mergeGeometries(parts);
      parts.forEach(p => p.dispose());
      return merged;
    };

    const _mansardRoofAndDetails = (pts, holes, yBase, unitsPerMeter, hex, bType, areaMeters, wallColor, styleId) => {
      const parts = [];
      const n = pts.length - 1;
      let area = 0;
      for (let i = 0; i < n; i++) area += (pts[i].x * pts[i + 1].z) - (pts[i + 1].x * pts[i].z);
      const isCCW = area > 0;
      const D = 1.0 * unitsPerMeter; // Recul du toit (Brisis)
      const H = 2.2 * unitsPerMeter; // Hauteur du brisis

      // Calcul de l'offset (rétrécissement du toit vers l'intérieur)
      const inset = [];
      for (let i = 0; i < n; i++) {
        const prev = pts[(i - 1 + n) % n];
        const curr = pts[i];
        const next = pts[(i + 1) % n];

        const d1x = curr.x - prev.x, d1z = curr.z - prev.z;
        const l1 = Math.hypot(d1x, d1z);
        const v1x = l1 > 1e-5 ? d1x / l1 : 0, v1z = l1 > 1e-5 ? d1z / l1 : 0;
        const n1x = isCCW ? -v1z : v1z, n1z = isCCW ? v1x : -v1x;

        const d2x = next.x - curr.x, d2z = next.z - curr.z;
        const l2 = Math.hypot(d2x, d2z);
        const v2x = l2 > 1e-5 ? d2x / l2 : 0, v2z = l2 > 1e-5 ? d2z / l2 : 0;
        const n2x = isCCW ? -v2z : v2z, n2z = isCCW ? v2x : -v2x;

        let bx = n1x + n2x, bz = n1z + n2z;
        const blen = Math.hypot(bx, bz);
        if (blen < 1e-4) { bx = n1x; bz = n1z; } else { bx /= blen; bz /= blen; }

        const dot = bx * n1x + bz * n1z;
        const dist = dot > 0.2 ? D / dot : D;
        const safeDist = Math.min(dist, 2.5 * unitsPerMeter);

        inset.push({ x: curr.x + bx * safeDist, y: yBase + H, z: curr.z + bz * safeDist });
      }
      inset.push(inset[0]);

      // Géométrie principale (pente raide + toit plat)
      const pos = [];
      for (let i = 0; i < n; i++) {
        const p1 = pts[i], p2 = pts[i + 1];
        const i1 = inset[i], i2 = inset[i + 1];
        pos.push(p1.x, yBase, p1.z, p2.x, yBase, p2.z, i1.x, yBase + H, i1.z);
        pos.push(p2.x, yBase, p2.z, i2.x, yBase + H, i2.z, i1.x, yBase + H, i1.z);
      }

      const shape = new THREE.Shape(inset.map(p => new THREE.Vector2(p.x, -p.z)));
      holes.forEach(h => shape.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p.x, -p.z)))));
      const g = new THREE.ShapeGeometry(shape);
      g.rotateX(-Math.PI / 2); g.translate(0, yBase + H, 0);
      const ni = g.toNonIndexed(); g.dispose();
      const topPos = ni.attributes.position.array;
      for (let i = 0; i < topPos.length; i++) pos.push(topPos[i]);
      ni.dispose();

      parts.push(_roofFromPos(pos, hex));

      // Lucarnes intégrées dans la pente (Mansard)
      const dormerW = 0.9 * unitsPerMeter;
      const dormerH = 1.3 * unitsPerMeter;
      const dormerD = D * 1.5;

      let cx = 0, cz = 0;
      for (let p of pts) { cx += p.x; cz += p.z; }
      cx /= pts.length; cz /= pts.length;

      let reliefColor = 0xdcd4c6;
      if (wallColor) {
        if (bType === 'residential') reliefColor = new THREE.Color(wallColor).multiply(new THREE.Color('#e6decb')).getHex();
        else if (bType === 'default') reliefColor = new THREE.Color(wallColor).multiply(new THREE.Color('#dcd4c6')).getHex();
        else reliefColor = wallColor;
      }

      for (let i = 0; i < n; i++) {
        const p1 = pts[i], p2 = pts[i + 1];
        const dx = p2.x - p1.x, dz = p2.z - p1.z;
        const edgeLen = Math.hypot(dx, dz);

        if (edgeLen > 4 * unitsPerMeter) {
          const numDormers = Math.floor(edgeLen / (3.5 * unitsPerMeter));
          const spacing = edgeLen / (numDormers + 1);
          const nx = isCCW ? -dz / edgeLen : dz / edgeLen;
          const nz = isCCW ? dx / edgeLen : -dx / edgeLen;
          const angle = Math.atan2(-nx, -nz); // Correction: Rotation alignée sur la normale extérieure

          for (let j = 1; j <= numDormers; j++) {
            const t = (j * spacing) / edgeLen;
            const lx = p1.x + t * dx;
            const lz = p1.z + t * dz;

            let dormer = new THREE.BoxGeometry(dormerW, dormerH, dormerD);
            dormer.rotateY(angle);
            dormer.translate(lx + nx * (dormerD * 0.3), yBase + dormerH / 2, lz + nz * (dormerD * 0.3));
            parts.push(_prepGeo(dormer, reliefColor));

            let dRoof = new THREE.CylinderGeometry(dormerW / 2, dormerW / 2, dormerD, 8, 1, false, 0, Math.PI);
            dRoof.rotateX(-Math.PI / 2);
            dRoof.rotateY(angle); // Correction: Toiture alignée avec la box de la lucarne
            dRoof.translate(lx + nx * (dormerD * 0.3), yBase + dormerH, lz + nz * (dormerD * 0.3));
            parts.push(_prepGeo(dRoof, 0x5a636b));

            let pane = new THREE.BoxGeometry(dormerW * 0.6, dormerH * 0.7, dormerD * 1.05);
            pane.rotateY(angle);
            pane.translate(lx + nx * (dormerD * 0.3), yBase + dormerH * 0.45, lz + nz * (dormerD * 0.3));
            parts.push(_prepGeo(pane, 0x111111));
          }
        }
      }

      // Cheminées — adaptées au style architectural
      const chimneyStyles = {
        haussmannien: { prob: 0.95, density: 45, w: 0.5, d: 0.9, hMin: 1.2, hMax: 1.8, color: 0x8a8a8c, potColor: 0xa05040, pots: [2, 4] },
        classique: { prob: 0.85, density: 65, w: 0.6, d: 1.0, hMin: 1.0, hMax: 1.4, color: 0xa09888, potColor: 0xa05040, pots: [2, 3] },
      };
      const cc = chimneyStyles[styleId] ?? { prob: 0.5, density: 80, w: 0.8, d: 1.2, hMin: 1.0, hMax: 1.5, color: 0xbcbcbc, potColor: 0xb95140, pots: [2, 4] };

      if (Math.random() < cc.prob) {
        // Bornes de la zone plate du toit (inset) pour contraindre le placement
        let minIX = Infinity, maxIX = -Infinity, minIZ = Infinity, maxIZ = -Infinity;
        for (const p of inset) {
          minIX = Math.min(minIX, p.x); maxIX = Math.max(maxIX, p.x);
          minIZ = Math.min(minIZ, p.z); maxIZ = Math.max(maxIZ, p.z);
        }
        const mX = (maxIX - minIX) * 0.12, mZ = (maxIZ - minIZ) * 0.12;

        const numChimneys = Math.min(5, Math.max(1, Math.floor(areaMeters / cc.density)));
        for (let i = 0; i < numChimneys; i++) {
          const w = cc.w * unitsPerMeter, d = cc.d * unitsPerMeter;
          const h = (cc.hMin + Math.random() * (cc.hMax - cc.hMin)) * unitsPerMeter;
          const px = minIX + mX + Math.random() * (maxIX - minIX - 2 * mX);
          const pz = minIZ + mZ + Math.random() * (maxIZ - minIZ - 2 * mZ);

          let base = new THREE.BoxGeometry(w, h, d);
          base.translate(px, yBase + H + h / 2, pz);
          parts.push(_prepGeo(base, cc.color));

          const numPots = cc.pots[0] + Math.floor(Math.random() * (cc.pots[1] - cc.pots[0] + 1));
          const potH = 0.4 * unitsPerMeter, potR = 0.11 * unitsPerMeter;
          for (let j = 0; j < numPots; j++) {
            let pot = new THREE.CylinderGeometry(potR * 0.8, potR, potH, 6);
            pot.translate(px, yBase + H + h + potH / 2, pz - d / 2 + (d / numPots) * (j + 0.5));
            parts.push(_prepGeo(pot, cc.potColor));
          }
        }
      }

      // Solaire pour maisons de ville
      if (bType === 'house' && Math.random() > 0.5) {
        let p = new THREE.BoxGeometry(2.0 * unitsPerMeter, 0.1 * unitsPerMeter, 1.5 * unitsPerMeter);
        p.rotateX(Math.PI / 6);
        p.translate(cx, yBase + H + 0.5 * unitsPerMeter, cz);
        parts.push(_prepGeo(p, 0x1e3a8a));
      }

      return parts;
    };

    const _createFacadeRelief = (pts, holes, yBase, bHeight, unitsPerMeter, bType, wallColor, styleDef) => {
      const parts = [];
      const groundH = 4.0 * unitsPerMeter;
      const yGroundTop = yBase + groundH;
      const yTop = yBase + bHeight;
      const rd = styleDef?.relief || {};
      const tileH = (styleDef?.floorH || 3.5) * unitsPerMeter;
      const isUrban = !['house', 'industrial'].includes(bType);
      const reliefColor = wallColor;

      const processRing = (ring) => {
        const rn = ring.length - 1;
        let area = 0;
        for (let i = 0; i < rn; i++) area += (ring[i].x * ring[i + 1].z) - (ring[i + 1].x * ring[i].z);
        const isCCW = area > 0;

        for (let i = 0; i < rn; i++) {
          const p1 = ring[i], p2 = ring[i + 1];
          const dx = p2.x - p1.x, dz = p2.z - p1.z;
          const edgeLen = Math.hypot(dx, dz);
          if (edgeLen < 1.0 * unitsPerMeter) continue;

          const nx = isCCW ? dz / edgeLen : -dz / edgeLen;
          const nz = isCCW ? -dx / edgeLen : dx / edgeLen;
          const angle = Math.atan2(nx, nz);
          const mx = p1.x + dx / 2, mz = p1.z + dz / 2;

          const addBand = (yCenter, depth, height, color) => {
            let box = new THREE.BoxGeometry(edgeLen, height, depth);
            box.rotateY(angle);
            box.translate(mx + nx * (depth / 2), yCenter, mz + nz * (depth / 2));
            parts.push(_prepGeo(box, color));
          };

          if (isUrban && bHeight > groundH + 1.0 * unitsPerMeter) {
            if (rd.hasCornicheGround !== false)
              addBand(yGroundTop, 0.2 * unitsPerMeter, 0.25 * unitsPerMeter, reliefColor);
            if (rd.hasCornicheTop) {
              const cd = (rd.cornicheDepth || 0.6) * unitsPerMeter;
              const ch = (rd.cornicheHeight || 0.5) * unitsPerMeter;
              addBand(yTop - ch / 2, cd, ch, reliefColor);
            }

            const numFloors = Math.max(1, Math.round((bHeight - groundH) / tileH));

            for (let f = 0; f < numFloors; f++) {
              const floorY = yGroundTop + f * tileH;
              const isBalcony = rd.balconyEveryFloor ||
                (rd.balconyFloors || []).some(b => b === f || (b === 'last' && f === numFloors - 1 && numFloors > 2));

              if (isBalcony && rd.balconyType) {
                const slabH = 0.15 * unitsPerMeter;
                const slabD = (rd.balconySlabDepth || 0.8) * unitsPerMeter;
                const slabY = floorY + 0.525 * unitsPerMeter;
                addBand(slabY, slabD, slabH, reliefColor);

                if (rd.balconyType === 'fer_forge') {
                  const railH = 1.0 * unitsPerMeter;
                  const railD = 0.03 * unitsPerMeter;
                  const railYC = slabY + slabH / 2 + railH / 2;
                  const railX = slabD - railD / 2;
                  let rt = new THREE.BoxGeometry(edgeLen, 0.03 * unitsPerMeter, railD);
                  rt.rotateY(angle); rt.translate(mx + nx * railX, railYC + railH / 2 - 0.015 * unitsPerMeter, mz + nz * railX);
                  parts.push(_prepGeo(rt, 0x111111));
                  let rb = new THREE.BoxGeometry(edgeLen, 0.03 * unitsPerMeter, railD);
                  rb.rotateY(angle); rb.translate(mx + nx * railX, railYC - railH / 2 + 0.015 * unitsPerMeter, mz + nz * railX);
                  parts.push(_prepGeo(rb, 0x111111));
                  const bSpacing = 0.12 * unitsPerMeter;
                  const nBal = Math.max(1, Math.floor(edgeLen / bSpacing));
                  const balW = 0.015 * unitsPerMeter, balH2 = railH - 0.06 * unitsPerMeter;
                  for (let k = 0; k <= nBal; k++) {
                    const t = k / nBal;
                    let bal = new THREE.BoxGeometry(balW, balH2, balW);
                    bal.rotateY(angle);
                    bal.translate(p1.x + dx * t + nx * railX, railYC, p1.z + dz * t + nz * railX);
                    parts.push(_prepGeo(bal, 0x111111));
                  }
                } else if (rd.balconyType === 'beton') {
                  const pH = 0.9 * unitsPerMeter, pD = 0.08 * unitsPerMeter;
                  let par = new THREE.BoxGeometry(edgeLen, pH, pD);
                  par.rotateY(angle);
                  par.translate(mx + nx * (slabD - pD / 2), slabY + slabH / 2 + pH / 2, mz + nz * (slabD - pD / 2));
                  parts.push(_prepGeo(par, reliefColor));
                }
              } else if (rd.hasFloorBands !== false && f > 0) {
                addBand(floorY, 0.15 * unitsPerMeter, 0.15 * unitsPerMeter, reliefColor);
              }
            }

            if (rd.hasTimberFrame) {
              const tc = rd.timberColor || 0x4a3728;
              const bW = 0.12 * unitsPerMeter, bD = 0.08 * unitsPerMeter;
              const upperH = bHeight - groundH;
              const nFloors = Math.max(1, Math.round(upperH / tileH));
              for (let f = 0; f <= nFloors; f++) {
                addBand(yGroundTop + f * tileH, bD, bW, tc);
              }
              const postSpacing = 1.5 * unitsPerMeter;
              const nPosts = Math.max(1, Math.floor(edgeLen / postSpacing));
              for (let pi = 0; pi <= nPosts; pi++) {
                const t = pi / nPosts;
                let post = new THREE.BoxGeometry(bW, upperH, bD);
                post.rotateY(angle);
                post.translate(p1.x + dx * t + nx * bD / 2, yGroundTop + upperH / 2, p1.z + dz * t + nz * bD / 2);
                parts.push(_prepGeo(post, tc));
              }
            }
          }

          if (rd.hasCornerPillars === true && bHeight > groundH) {
            const sz = 0.5 * unitsPerMeter;
            let cp = new THREE.BoxGeometry(sz, bHeight, sz);
            cp.translate(p1.x, yBase + bHeight / 2, p1.z);
            parts.push(_prepGeo(cp, reliefColor));
          }
        }
      };

      processRing(pts);
      holes.forEach(processRing);
      if (parts.length === 0) return null;
      const merged = mergeGeometries(parts);
      parts.forEach(p => p.dispose());
      return merged;
    };

    // ── Group buildings by type, collect geometry ────────────────────────
    const groups = {};
    Object.keys(FACADES).forEach(t => { groups[t] = { groundWinGeos: [], groundDoorGeos: [], groundShopGeos: [], wallGeos: [], roofGeos: [], reliefGeos: [] }; });

    buildingsList.forEach((b) => {
      const isFixedType = ['house', 'industrial'].includes(b.buildingType);
      const ftype = isFixedType ? b.buildingType : (b.styleId || 'haussmannien');
      const facade = FACADES[ftype];
      if (!facade) return;
      const { tileW, tileH } = facade;
      const grp = groups[ftype];

      const groundH = 4.0 * unitsPerMeter;
      const styleDef = STYLE_DEFS[b.styleId];
      const hasShop = b.height > groundH + 2.0 * unitsPerMeter &&
        !isFixedType && styleDef?.hasShop !== false;

      // Ajustement exact de la hauteur du bâtiment pour qu'elle corresponde à un nombre entier d'étages
      // Cela garantit que la texture n'est pas coupée et que le dernier balcon est collé sous le toit !
      if (hasShop) {
        const upperHeight = b.height - groundH;
        const numFloors = Math.round(upperHeight / (tileH * unitsPerMeter));
        b.height = groundH + Math.max(1, numFloors) * (tileH * unitsPerMeter);
      }

      const yTop = b.y + b.height;

      if (hasShop) {
        const yGroundTop = b.y + groundH;
        const bSeed = Math.abs(Math.round(b.points[0].x * 73) * 1000 + Math.round(b.points[0].z * 73));
        const { winGeos, doorGeos, shopGeos } = _buildGroundFloor(b.points, b.holes, b.y, yGroundTop, bSeed);
        winGeos.forEach(g => grp.groundWinGeos.push(g));
        doorGeos.forEach(g => grp.groundDoorGeos.push(g));
        shopGeos.forEach(g => grp.groundShopGeos.push(g));
        grp.wallGeos.push(_buildWall(b.points, b.holes, yGroundTop, yTop, b.wallColor, tileW, tileH));
      } else {
        grp.wallGeos.push(_buildWall(b.points, b.holes, b.y, yTop, b.wallColor, tileW, tileH));
      }

      const rs = b.roofShape;
      if (b.roofHeight > 0 && (rs === 'pyramidal' || rs === 'pyramid')) {
        grp.roofGeos.push(_pyramidalRoof(b.points, yTop, b.roofHeight, b.roofColor));
      } else {
        // Roof driven by architectural style
        const roofCfg = STYLE_DEFS[b.styleId]?.roof
          ?? (b.buildingType === 'house' ? { shape: 'hip', height: 3.0 } : { shape: 'flat' });

        const rColor = b.roofColor;

        if (roofCfg.shape === 'mansard') {
          const mansardParts = _mansardRoofAndDetails(b.points, b.holes, yTop, unitsPerMeter, rColor, b.buildingType, b.areaMeters, b.wallColor, b.styleId);
          mansardParts.forEach(p => grp.roofGeos.push(p));
        } else if (roofCfg.shape === 'hip') {
          const rH = (roofCfg.height ?? 3.0) * unitsPerMeter;
          grp.roofGeos.push(_pyramidalRoof(b.points, yTop, rH, rColor));
        } else {
          // flat
          grp.roofGeos.push(_flatRoof(b.points, b.holes, yTop, rColor));
          const details = _createRoofDetails(b.points, yTop, unitsPerMeter, b.buildingType, b.areaMeters);
          if (details) grp.roofGeos.push(details);
        }
      }

      // Ajout du relief de façade (balcons, bandeaux, corniches)
      const facadeRelief = _createFacadeRelief(b.points, b.holes, b.y, b.height, unitsPerMeter, b.buildingType, b.wallColor, STYLE_DEFS[b.styleId]);
      if (facadeRelief) grp.reliefGeos.push(facadeRelief);
    });

    // ── Merge and emit one mesh-pair per building type ───────────────────
    Object.entries(groups).forEach(([ftype, { groundWinGeos, groundDoorGeos, groundShopGeos, wallGeos, roofGeos, reliefGeos }]) => {
      for (const [geoArr, mat, name] of [
        [groundWinGeos, GROUND_WIN.wallMat, 'ground_win'],
        [groundDoorGeos, GROUND_DOOR.wallMat, 'ground_door'],
        [groundShopGeos, GROUND_SHOP.wallMat, 'ground_shop'],
      ]) {
        if (!geoArr || geoArr.length === 0) continue;
        const mg = mergeGeometries(geoArr);
        if (mg) {
          const m = new THREE.Mesh(mg, mat);
          m.castShadow = true; m.receiveShadow = true; m.name = name;
          group.add(m);
        }
        geoArr.forEach(g => g.dispose());
      }

      if (wallGeos.length === 0) return;
      const { wallMat, roofMat } = FACADES[ftype];
      const styleDef = STYLE_DEFS[ftype];

      const mw = mergeGeometries(wallGeos);
      if (mw) {
        const m = new THREE.Mesh(mw, wallMat);
        m.castShadow = true; m.receiveShadow = true;
        m.name = `wall_${ftype}`;
        m.userData = {
          styleId: ftype,
          type: 'wall',
          roughness: styleDef?.roughness ?? 0.7,
          normalStrength: styleDef?.normalStrength ?? 5.0,
          wallColors: styleDef?.wallColors ?? ['#d0ccca'],
        };
        group.add(m);
      }

      const mr = mergeGeometries(roofGeos);
      if (mr) {
        const m = new THREE.Mesh(mr, roofMat);
        m.castShadow = true; m.receiveShadow = true;
        m.name = `roof_${ftype}`;
        m.userData = {
          styleId: ftype,
          type: 'roof',
          roofShape: styleDef?.roof?.shape ?? 'flat',
          roofColors: styleDef?.roof?.colors?.map(c => '#' + c.toString(16).padStart(6, '0')) ?? [],
        };
        group.add(m);
      }

      if (reliefGeos.length > 0) {
        const mr2 = mergeGeometries(reliefGeos);
        if (mr2) {
          const m = new THREE.Mesh(mr2, new THREE.MeshStandardMaterial({
            vertexColors: true, roughness: styleDef?.roughness ?? 0.7, metalness: 0.02, side: THREE.DoubleSide,
          }));
          m.castShadow = true; m.receiveShadow = true;
          m.name = `relief_${ftype}`;
          m.userData = {
            styleId: ftype, type: 'relief',
            roughness: styleDef?.roughness ?? 0.7,
            normalStrength: styleDef?.normalStrength ?? 5.0,
            wallColors: styleDef?.wallColors ?? ['#d0ccca'],
          };
          group.add(m);
        }
      }

      wallGeos.forEach(g => g.dispose());
      roofGeos.forEach(g => g.dispose());
      reliefGeos.forEach(g => g.dispose());
    });
  }

  if (includeRoadMeshes && roadsList.length > 0) {
    const geosByColor = {};
    roadsList.forEach((r) => {
      const geo = createRoadGeometry(data, r.points, r.width, 0);
      if (!geosByColor[r.colorHex]) geosByColor[r.colorHex] = [];
      geosByColor[r.colorHex].push(geo.index ? geo.toNonIndexed() : geo);
    });

    for (const [colorHex, geos] of Object.entries(geosByColor)) {
      const merged = mergeGeometries(geos);
      if (merged) {
        const roadMesh = new THREE.Mesh(
          merged,
          new THREE.MeshStandardMaterial({
            color: parseInt(colorHex),
            roughness: 0.9,
            side: THREE.DoubleSide,
          })
        );
        roadMesh.name = "osm_roads";
        group.add(roadMesh);
      }
      geos.forEach((g) => g.dispose());
    }
  }

  const matrix = new THREE.Matrix4(),
    quaternion = new THREE.Quaternion(),
    scale = new THREE.Vector3(1, 1, 1),
    position = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  // Optimized vegetation: pre-allocate combined buffer and stamp transforms
  // instead of cloning base geometry N times then merging
  const stampInstances = (baseGeo, instances, getMat) => {
    const basePos = baseGeo.attributes.position;
    const baseCol = baseGeo.attributes.color;
    const vertCount = basePos.count;
    const totalVerts = vertCount * instances.length;
    const combinedPos = new Float32Array(totalVerts * 3);
    const combinedCol = new Float32Array(totalVerts * 3);
    const tmpV = new THREE.Vector3();

    for (let i = 0; i < instances.length; i++) {
      const mat = getMat(instances[i]);
      const off = i * vertCount * 3;
      for (let v = 0; v < vertCount; v++) {
        tmpV.set(basePos.getX(v), basePos.getY(v), basePos.getZ(v));
        tmpV.applyMatrix4(mat);
        combinedPos[off + v * 3] = tmpV.x;
        combinedPos[off + v * 3 + 1] = tmpV.y;
        combinedPos[off + v * 3 + 2] = tmpV.z;
        combinedCol[off + v * 3] = baseCol.getX(v);
        combinedCol[off + v * 3 + 1] = baseCol.getY(v);
        combinedCol[off + v * 3 + 2] = baseCol.getZ(v);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(combinedPos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(combinedCol, 3));
    geo.computeVertexNormals();
    return geo;
  };

  if (treesList.length > 0) {
    const types = ["deciduous", "coniferous", "palm"];
    types.forEach((type) => {
      const list = treesList.filter((t) => t.type === type);
      if (list.length === 0) return;
      const baseGeo = createTreeMesh(type, unitsPerMeter, {
        lightweightVegetationMode,
      });
      if (!baseGeo) return;

      const combined = stampInstances(baseGeo, list, (tree) => {
        const seed = Math.abs((tree.pos.x * 123.45 + tree.pos.z * 678.9) % 1);
        const s = 0.95 + seed * 0.1;
        position.set(tree.pos.x, tree.pos.y, tree.pos.z);
        scale.set(s, s, s);
        quaternion.setFromAxisAngle(yAxis, seed * Math.PI * 2);
        return matrix.compose(position, quaternion, scale).clone();
      });

      if (combined) {
        const treeMesh = new THREE.Mesh(
          combined,
          new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8,
          }),
        );
        treeMesh.castShadow = true;
        treeMesh.receiveShadow = true;
        treeMesh.name = "vegetation";
        group.add(treeMesh);
      }
      baseGeo.dispose();
    });
  }

  if (bushesList.length > 0) {
    let baseB = new THREE.IcosahedronGeometry(1.2 * unitsPerMeter, 0);
    if (baseB.index) baseB = baseB.toNonIndexed();
    addColor(baseB, 0x166534);

    const combined = stampInstances(baseB, bushesList, (pos) => {
      const seed = (pos.x * 543.21 + pos.z * 123.4) % 1;
      const s = 0.7 + seed * 0.6;
      scale.set(s, s * 0.8, s);
      quaternion.setFromAxisAngle(yAxis, seed * Math.PI * 2);
      position.set(pos.x, pos.y + 0.5 * s * unitsPerMeter, pos.z);
      return matrix.compose(position, quaternion, scale).clone();
    });

    if (combined) {
      const bushMesh = new THREE.Mesh(
        combined,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
      );
      bushMesh.castShadow = true;
      bushMesh.receiveShadow = true;
      bushMesh.name = "vegetation";
      group.add(bushMesh);
    }
    baseB.dispose();
  }

  // === Street Furniture Rendering ===
  if (includeStreetFurniture && streetFurnitureList.length > 0) {
    if (Number.isFinite(maxStreetFurniture) && streetFurnitureList.length > maxStreetFurniture) {
      console.warn(`[OSM] Street furniture capped at ${maxStreetFurniture} (had ${streetFurnitureList.length})`);
      streetFurnitureList.length = maxStreetFurniture;
    }

    // Build base geometries for each subtype
    const baseGeos = {
      street_lamp: createStreetLampMesh(unitsPerMeter),
      bollard: createBollardMesh(unitsPerMeter),
      bench: createBenchMesh(unitsPerMeter),
      waste_basket: createWasteBasketMesh(unitsPerMeter),
      post_box: createPostBoxMesh(unitsPerMeter),
      fire_hydrant: createFireHydrantMesh(unitsPerMeter),
      give_way: createTrafficSignMesh("give_way", unitsPerMeter),
      generic: createTrafficSignMesh("generic", unitsPerMeter),
    };

    // Group furniture by subtype and stamp instances
    const subtypes = Object.keys(baseGeos);
    for (const st of subtypes) {
      const items = streetFurnitureList.filter((f) => f.subtype === st);
      if (items.length === 0) continue;
      const baseGeo = baseGeos[st];
      if (!baseGeo) continue;

      const combined = stampInstances(baseGeo, items, (item) => {
        // For traffic signals, offset the pole base to the roadside.
        // The arm extends along +Z in local space, so we move the base
        // backward (-Z local) so the pole sits at the road edge and
        // the arm hangs over the intersection center.
        let angle = 0;
        if (item.tags && item.tags.direction) {
          const deg = parseFloat(item.tags.direction);
          if (!isNaN(deg)) angle = (deg * Math.PI) / 180;
          else angle = Math.random() * Math.PI * 2;
        } else if ((st === "bench" || st === "street_lamp") && roadSegments.length >= 4) {
          // Orient benches/lamps to face the nearest road segment
          const px = item.pos.x, pz = item.pos.z;
          let bestDistSq = Infinity, bestAngle = 0;
          for (let si = 0; si < roadSegments.length; si += 4) {
            const ax = roadSegments[si], az = roadSegments[si + 1];
            const bx = roadSegments[si + 2], bz = roadSegments[si + 3];
            const abx = bx - ax, abz = bz - az;
            const lenSq = abx * abx + abz * abz;
            if (lenSq < 1e-8) continue;
            let t = ((px - ax) * abx + (pz - az) * abz) / lenSq;
            t = Math.max(0, Math.min(1, t));
            const cx = ax + t * abx - px, cz = az + t * abz - pz;
            const dSq = cx * cx + cz * cz;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              // Bench: back faces away from road → orient along the road
              // Street lamp: face the road
              bestAngle = Math.atan2(abx, abz);
            }
          }
          angle = bestAngle;
          if (st === "bench") {
            // Bench faces the road: rotate 90° so seat faces road
            angle += Math.PI / 2;
          }
        } else {
          angle = Math.random() * Math.PI * 2;
        }

        position.set(item.pos.x, item.pos.y, item.pos.z);
        quaternion.setFromAxisAngle(yAxis, angle);
        scale.set(1, 1, 1);
        return matrix.compose(position, quaternion, scale).clone();
      });

      if (combined) {
        const furnitureMesh = new THREE.Mesh(
          combined,
          new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.6,
            metalness: 0.3,
          }),
        );
        furnitureMesh.castShadow = true;
        furnitureMesh.receiveShadow = true;
        furnitureMesh.name = "street_furniture";
        group.add(furnitureMesh);
      }
    }

    // Dispose base geometries
    for (const geo of Object.values(baseGeos)) {
      if (geo) geo.dispose();
    }

    console.log(`[OSM] Rendered ${streetFurnitureList.length} street furniture items`);
  }

  return group;
};

const disposeScene = (scene) => {
  scene.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach(m => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
};

export const exportToGLB = async (data, options = {}) => {
  const {
    includeSurroundings,
    includeCenterTile,
    tileSelection,
    centerTextureType = 'osm',
    onProgress,
    maxMeshResolution = 1024,
    returnBlob = false,
    buildingStyleOverride = null,
  } = options;
  const resolvedIncludeCenterTile = typeof includeCenterTile === 'boolean'
    ? includeCenterTile
    : tileSelection !== 'surroundings-only';
  const resolvedIncludeSurroundings = typeof includeSurroundings === 'boolean'
    ? includeSurroundings
    : tileSelection === 'center-plus-surroundings' || tileSelection === 'surroundings-only';
  try {
    const scene = new THREE.Scene();

    if (resolvedIncludeCenterTile) {
      onProgress?.('Building terrain mesh...');
      const terrainMesh = await createTerrainMesh(data, maxMeshResolution, centerTextureType);
      const regionId = buildingStyleOverride ? null : await detectFrenchRegion(data.bounds).catch(() => null);
      const regionProfile = buildingStyleOverride
        ? {
          styles: buildingStyleOverride.styles || buildingStyleOverride,
          roofColors: buildingStyleOverride.roofColors || (REGION_PROFILES[regionId]?.roofColors || {})
        }
        : (REGION_PROFILES[regionId] || null);
      const osmGroup = createOSMGroup(data, {
        regionProfile,
      });
      osmGroup.name = 'osm_buildings';
      osmGroup.userData = { regionId: regionId ?? 'generic_france' };
      scene.add(terrainMesh);
      scene.add(osmGroup);
    }

    if (resolvedIncludeSurroundings) {
      onProgress?.('Fetching surrounding tiles for GLB...');
      const surroundingGroup = await createSurroundingMeshes(data, onProgress, maxMeshResolution);
      if (surroundingGroup) scene.add(surroundingGroup);
    }

    onProgress?.('Encoding GLB...');
    return new Promise((resolve, reject) => {
      const exporter = new GLTFExporter();
      exporter.parse(
        scene,
        (gltf) => {
          const blob = new Blob([gltf], { type: "model/gltf-binary" });
          disposeScene(scene);

          if (returnBlob) {
            onProgress?.('Done!');
            resolve(blob);
            return;
          }

          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          const date = new Date().toISOString().slice(0, 10);
          const lat = ((data.bounds.north + data.bounds.south) / 2).toFixed(4);
          const lng = ((data.bounds.east + data.bounds.west) / 2).toFixed(4);
          link.download = `RealScape_Model_${date}_${lat}_${lng}.glb`;
          link.click();
          URL.revokeObjectURL(link.href);
          onProgress?.('Done!');
          resolve();
        },
        (err) => { disposeScene(scene); reject(err); },
        { binary: true },
      );
    });
  } catch (err) {
    console.error("Export failed:", err);
    if (returnBlob) throw err;
  }
};

export const exportToDAE = async (data, options = {}) => {
  const {
    includeSurroundings,
    includeCenterTile,
    tileSelection,
    centerTextureType = 'osm',
    onProgress,
    maxMeshResolution = 1024,
    returnBlob = false,
    buildingStyleOverride = null,
  } = options;
  const resolvedIncludeCenterTile = typeof includeCenterTile === 'boolean'
    ? includeCenterTile
    : tileSelection !== 'surroundings-only';
  const resolvedIncludeSurroundings = typeof includeSurroundings === 'boolean'
    ? includeSurroundings
    : tileSelection === 'center-plus-surroundings' || tileSelection === 'surroundings-only';
  try {
    const scene = new THREE.Scene();

    if (resolvedIncludeCenterTile) {
      onProgress?.('Building terrain mesh...');
      const terrainMesh = await createTerrainMesh(data, maxMeshResolution, centerTextureType);
      const regionId = buildingStyleOverride ? null : await detectFrenchRegion(data.bounds).catch(() => null);
      const regionProfile = buildingStyleOverride
        ? {
          styles: buildingStyleOverride.styles || buildingStyleOverride,
          roofColors: buildingStyleOverride.roofColors || (REGION_PROFILES[regionId]?.roofColors || {})
        }
        : (REGION_PROFILES[regionId] || null);
      const osmGroup = createOSMGroup(data, {
        regionProfile,
      });
      scene.add(terrainMesh);
      scene.add(osmGroup);
    }

    if (resolvedIncludeSurroundings) {
      onProgress?.('Fetching surrounding tiles for DAE...');
      const surroundingGroup = await createSurroundingMeshes(data, onProgress, maxMeshResolution);
      if (surroundingGroup) {
        surroundingGroup.name = "surroundings";
        scene.add(surroundingGroup);
      }
    }

    let meshCount = 0;
    scene.traverse((node) => {
      if (node?.isMesh) meshCount += 1;
    });
    if (meshCount === 0) {
      throw new Error('No mesh data available for DAE export.');
    }

    // Ensure all matrix values are up to date throughout hierarchy
    scene.updateMatrixWorld(true);

    onProgress?.('Encoding Collada...');
    const exporter = new ColladaExporter();
    const result = exporter.parse(scene, undefined, {
      textureDirectory: 'textures',
      version: '1.4.1',
    });

    // We MUST process the result BEFORE disposing the scene,
    // just in case any textures need to be re-read (though parse is usually sync).
    const daeBlob = result?.data;
    if (!daeBlob) {
      throw new Error('Collada exporter returned no model data.');
    }

    onProgress?.('Packaging DAE archive...');
    const zip = new JSZip();
    zip.file('model.dae', daeBlob);

    if (result.textures && result.textures.length > 0) {
      for (const tex of result.textures) {
        // Ensure path alignment
        const relDir = tex.directory ? (tex.directory.endsWith('/') ? tex.directory : tex.directory + '/') : '';
        zip.file(`${relDir}${tex.name}.${tex.ext}`, tex.data);
      }
    }
    const finalBlob = await zip.generateAsync({ type: 'blob' });

    disposeScene(scene);

    if (returnBlob) {
      onProgress?.('Done!');
      return finalBlob;
    }

    const link = document.createElement('a');
    link.href = URL.createObjectURL(finalBlob);
    const date = new Date().toISOString().slice(0, 10);
    const lat = ((data.bounds.north + data.bounds.south) / 2).toFixed(4);
    const lng = ((data.bounds.east + data.bounds.west) / 2).toFixed(4);
    const ext = '.dae.zip';
    link.download = `RealScape_Model_${date}_${lat}_${lng}${ext}`;
    link.click();
    URL.revokeObjectURL(link.href);

    onProgress?.('Done!');
  } catch (err) {
    console.error("DAE Export failed:", err);
    throw err;
  }
};

// --- Surrounding Tiles for GLB ---

const SURROUND_OFFSETS = {
  NW: { x: -1, z: -1 },
  N: { x: 0, z: -1 },
  NE: { x: 1, z: -1 },
  W: { x: -1, z: 0 },
  E: { x: 1, z: 0 },
  SW: { x: -1, z: 1 },
  S: { x: 0, z: 1 },
  SE: { x: 1, z: 1 },
};

const GLB_SURROUND_SAT_ZOOM = 17;
const SEAM_BLEND_WIDTH_UNITS = SCENE_SIZE * 0.42;
const EXPORT_SURROUND_PROFILE = {
  fetchResolutionCap: 4096,
  seamEdgeResolution: 768,
  depthResolution: 128,
  cornerResolution: 256,
  anisotropy: 16,
};
const SURROUND_TILE_MAX_NODATA_RATIO = 0.25;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / Math.max(edge1 - edge0, 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

const getSeamContext = (data, globalX, globalZ) => {
  const half = SCENE_SIZE / 2;

  // Point on center tile boundary nearest to current vertex.
  const seamX = clamp(globalX, -half, half);
  const seamZ = clamp(globalZ, -half, half);

  // Euclidean distance from current point to center-tile seam.
  const dx = globalX - seamX;
  const dz = globalZ - seamZ;
  const distanceToSeam = Math.sqrt(dx * dx + dz * dz);

  // 11-tap filter along dominant seam tangent to stabilize seam elevation.
  const isHorizontalSeam = Math.abs(dz) > Math.abs(dx);
  const meshStep = SCENE_SIZE / EXPORT_SURROUND_PROFILE.seamEdgeResolution;
  const samples = 11;
  let totalH = 0;
  for (let s = 0; s < samples; s++) {
    const t = (s / (samples - 1)) - 0.5;
    const offX = isHorizontalSeam ? (t * meshStep * 2.0) : 0;
    const offZ = !isHorizontalSeam ? (t * meshStep * 2.0) : 0;
    totalH += getHeightAtScenePos(data, seamX + offX, seamZ + offZ);
  }

  return {
    seamX,
    seamZ,
    distanceToSeam,
    centerEdgeH: totalH / samples,
  };
};

const blendToCenterSeamHeight = (data, tileData, offset, globalX, globalZ, surroundingHeight, unitsPerMeter, exaggeration) => {
  const half = SCENE_SIZE / 2;
  const seam = getSeamContext(data, globalX, globalZ);

  if (seam.distanceToSeam > SEAM_BLEND_WIDTH_UNITS) return surroundingHeight;

  // Surround height at the corresponding boundary point in surrounding tile UV.
  const localX = seam.seamX - offset.x * SCENE_SIZE;
  const localZ = seam.seamZ - offset.z * SCENE_SIZE;
  const uEdge = (localX + half) / SCENE_SIZE;
  const vEdge = (localZ + half) / SCENE_SIZE;
  const surroundingRawH = sampleSurroundingHeight(tileData, uEdge, vEdge);
  const surroundingEdgeH = (surroundingRawH - data.minHeight) * unitsPerMeter * exaggeration;

  // Compute vertical correction at seam.
  const errorAtSeam = seam.centerEdgeH - surroundingEdgeH;

  // Taper correction to zero away from seam.
  const plateau = 0.5;
  const blend = smoothstep(plateau, SEAM_BLEND_WIDTH_UNITS, seam.distanceToSeam);

  return surroundingHeight + errorAtSeam * (1 - blend);
};

const buildFlatSeamedFallbackHeight = (data, globalX, globalZ, flatHeight = 0) => {
  const seam = getSeamContext(data, globalX, globalZ);
  // Keep the seam locked to center terrain and fade to flat across one tile depth.
  const fade = smoothstep(0, SCENE_SIZE, seam.distanceToSeam);
  return seam.centerEdgeH * (1 - fade) + flatHeight * fade;
};

const sampleSurroundingHeight = (tileData, u, v) => {
  const w = tileData.width;
  const h = tileData.height;
  const x = clamp(u * (w - 1), 0, Math.max(0, w - 1));
  const y = clamp(v * (h - 1), 0, Math.max(0, h - 1));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const dx = x - x0;
  const dy = y - y0;

  const index = (ix, iy) => iy * w + ix;
  const h00Raw = tileData.heightMap[index(x0, y0)];
  const h10Raw = tileData.heightMap[index(x1, y0)];
  const h01Raw = tileData.heightMap[index(x0, y1)];
  const h11Raw = tileData.heightMap[index(x1, y1)];

  const h00 = h00Raw < -10000 ? tileData.minHeight : h00Raw;
  const h10 = h10Raw < -10000 ? tileData.minHeight : h10Raw;
  const h01 = h01Raw < -10000 ? tileData.minHeight : h01Raw;
  const h11 = h11Raw < -10000 ? tileData.minHeight : h11Raw;

  const top = (1 - dx) * h00 + dx * h10;
  const bottom = (1 - dx) * h01 + dx * h11;
  return (1 - dy) * top + dy * bottom;
};

export const createSurroundingMeshes = async (data, onProgress, maxMeshResolution = 128, fetchOptions = {}) => {
  try {
    const allPositions = POSITIONS.map(p => p.key);
    const resolutionCap = fetchOptions.fetchResolutionCap ?? EXPORT_SURROUND_PROFILE.fetchResolutionCap;
    const surroundResolution = Math.min(
      Math.max(256, data.width || 1024),
      resolutionCap,
    );
    const tileOptions = { useNativeTerrainGrid: true };
    if (fetchOptions.includeSatellite !== undefined) tileOptions.includeSatellite = fetchOptions.includeSatellite;
    const satZoom = fetchOptions.satelliteZoom !== undefined ? fetchOptions.satelliteZoom : GLB_SURROUND_SAT_ZOOM;
    const results = await fetchSurroundingTiles(
      data.bounds,
      allPositions,
      surroundResolution,
      satZoom,
      onProgress,
      undefined,
      tileOptions,
    );

    const latRad = ((data.bounds.north + data.bounds.south) / 2 * Math.PI) / 180;
    const metersPerDegree = 111320 * Math.cos(latRad);
    const realWidthMeters = (data.bounds.east - data.bounds.west) * metersPerDegree;
    const unitsPerMeter = SCENE_SIZE / realWidthMeters;
    const EXAGGERATION = 1.0;

    const group = new THREE.Group();
    group.name = 'surrounding_terrain';

    const diagnosticsSummary = {
      requestedTiles: Object.keys(results || {}).length,
      builtTiles: 0,
      directTiles: 0,
      flatFallbackTiles: 0,
      skippedTiles: 0,
      maxNoDataRatio: SURROUND_TILE_MAX_NODATA_RATIO,
      tiles: {},
    };
    group.userData.surroundingDiagnostics = diagnosticsSummary;

    if (!results || Object.keys(results).length === 0) {
      console.warn('[DAE/GLB Surroundings] No results returned from fetch');
      return group;
    }

    for (const [pos, tileData] of Object.entries(results)) {
      const offset = SURROUND_OFFSETS[pos];
      if (!offset || !tileData) continue;

      const diagnostics = tileData.diagnostics || null;
      const noDataRatio = Number.isFinite(diagnostics?.noDataRatio) ? diagnostics.noDataRatio : 0;
      const useFlatFallback = diagnostics?.allInvalid || noDataRatio > SURROUND_TILE_MAX_NODATA_RATIO;
      diagnosticsSummary.tiles[pos] = {
        mode: useFlatFallback ? 'flat-fallback' : 'direct',
        validSamples: diagnostics?.validSamples ?? null,
        noDataSamples: diagnostics?.noDataSamples ?? null,
        totalSamples: diagnostics?.totalSamples ?? null,
        noDataRatio: Number.isFinite(noDataRatio) ? noDataRatio : null,
      };

      if (useFlatFallback) {
        diagnosticsSummary.flatFallbackTiles++;
        console.warn(
          `[GLB Surroundings] Tile ${pos}: using flat fallback (valid=${diagnostics?.validSamples ?? 'n/a'}, noData=${diagnostics?.noDataSamples ?? 'n/a'}, ratio=${diagnostics?.noDataRatio ?? 'n/a'})`
        );
      } else {
        diagnosticsSummary.directTiles++;
      }

      onProgress?.(`Building mesh for tile ${pos}...`);

      const w = tileData.width;
      const h = tileData.height;
      const maxSegX = Math.max(4, w - 1);
      const maxSegY = Math.max(4, h - 1);
      const isCornerTile = offset.x !== 0 && offset.z !== 0;
      const seamRunsAlongX = offset.x === 0 && offset.z !== 0;
      const seamRunsAlongY = offset.z === 0 && offset.x !== 0;

      let segsX;
      let segsY;

      if (isCornerTile) {
        segsX = Math.min(maxSegX, EXPORT_SURROUND_PROFILE.cornerResolution);
        segsY = Math.min(maxSegY, EXPORT_SURROUND_PROFILE.cornerResolution);
      } else if (seamRunsAlongX) {
        segsX = Math.min(maxSegX, EXPORT_SURROUND_PROFILE.seamEdgeResolution);
        segsY = Math.min(maxSegY, EXPORT_SURROUND_PROFILE.depthResolution);
      } else if (seamRunsAlongY) {
        segsX = Math.min(maxSegX, EXPORT_SURROUND_PROFILE.depthResolution);
        segsY = Math.min(maxSegY, EXPORT_SURROUND_PROFILE.seamEdgeResolution);
      } else {
        segsX = Math.min(maxSegX, EXPORT_SURROUND_PROFILE.depthResolution);
        segsY = Math.min(maxSegY, EXPORT_SURROUND_PROFILE.depthResolution);
      }

      segsX = Math.max(4, Math.floor(segsX));
      segsY = Math.max(4, Math.floor(segsY));

      const geo = new THREE.PlaneGeometry(SCENE_SIZE, SCENE_SIZE, segsX, segsY);
      const verts = geo.attributes.position.array;

      for (let i = 0; i < verts.length / 3; i++) {
        const col = i % (segsX + 1);
        const row = Math.floor(i / (segsX + 1));

        const u = col / segsX;
        const v = row / segsY;

        const elev = sampleSurroundingHeight(tileData, u, v);

        const localX = u * SCENE_SIZE - SCENE_SIZE / 2;
        const localZ = v * SCENE_SIZE - SCENE_SIZE / 2;
        const globalX = localX + offset.x * SCENE_SIZE;
        const globalZ = localZ + offset.z * SCENE_SIZE;
        let blendedHeight;
        if (useFlatFallback) {
          blendedHeight = buildFlatSeamedFallbackHeight(data, globalX, globalZ, 0);
        } else {
          const surroundingHeight = (elev - data.minHeight) * unitsPerMeter * EXAGGERATION;
          blendedHeight = blendToCenterSeamHeight(
            data,
            tileData,
            offset,
            globalX,
            globalZ,
            surroundingHeight,
            unitsPerMeter,
            EXAGGERATION,
          );
        }

        verts[i * 3] = localX;
        verts[i * 3 + 1] = -localZ;
        verts[i * 3 + 2] = blendedHeight;
      }

      geo.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide,
        color: 0xffffff,
      });

      // Load satellite texture
      if (tileData.satelliteDataUrl) {
        try {
          const tex = await new Promise((resolve, reject) => {
            new THREE.TextureLoader().load(
              tileData.satelliteDataUrl,
              (t) => {
                t.colorSpace = THREE.SRGBColorSpace;
                t.minFilter = THREE.LinearMipmapLinearFilter;
                t.magFilter = THREE.LinearFilter;
                t.anisotropy = EXPORT_SURROUND_PROFILE.anisotropy;
                resolve(t);
              },
              undefined,
              reject,
            );
          });
          mat.map = tex;
        } catch {
          // texture load failed, use solid color
        }
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(offset.x * SCENE_SIZE, 0, offset.z * SCENE_SIZE);
      mesh.updateMatrixWorld();
      mesh.name = `terrain_${pos}`;
      mesh.receiveShadow = true;
      group.add(mesh);
      diagnosticsSummary.builtTiles++;
    }

    return group;
  } catch (e) {
    console.error('[GLB Surroundings] Failed:', e);
    return null;
  }
};
