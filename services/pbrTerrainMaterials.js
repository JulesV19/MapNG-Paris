import * as THREE from 'three';
import { createWGS84ToLocal } from './geoUtils.js';

// ── Local texture definitions ──────────────────────────────────────────────
// Paths under /public/textures/ — served at /textures/ by Vite.
// Four materials cover the main OSM surface types:
//   asphalt  → roads, parking lots, runways
//   concrete → sidewalks, pedestrian areas, plazas
//   grass    → parks, gardens, vegetation (normal/rough reuse rocky_terrain for canvas compat)
//   ground   → everything else (urban residential, default background)
const MATERIALS = {
  asphalt: {
    diff: '/textures/asphalt_02_4k/textures/asphalt_02_diff_4k.jpg',
    norm: '/textures/asphalt_02_4k/textures/asphalt_02_nor_gl_4k.jpg',
    rough: '/textures/asphalt_02_4k/textures/asphalt_02_rough_4k.jpg',
  },
  concrete: {
    diff: '/textures/gravel_concrete_4k/textures/gravel_concrete_diff_4k.jpg',
    norm: '/textures/asphalt_02_4k/textures/asphalt_02_nor_gl_4k.jpg',
    rough: '/textures/asphalt_02_4k/textures/asphalt_02_rough_4k.jpg',
  },
  grass: {
    diff: '/textures/leafy_grass_4k/textures/leafy_grass_diff_4k.jpg',
    norm: '/textures/rocky_terrain_02_4k/textures/rocky_terrain_02_nor_gl_4k.jpg',
    rough: '/textures/rocky_terrain_02_4k/textures/rocky_terrain_02_rough_4k.jpg',
  },
  ground: {
    diff: '/textures/ground_grey_4k/textures/ground_grey_diff_4k.jpg',
    norm: '/textures/ground_grey_4k/textures/ground_grey_nor_gl_4k.jpg',
    rough: '/textures/ground_grey_4k/textures/ground_grey_rough_4k.jpg',
  },
};

// ── Loaders & cache ────────────────────────────────────────────────────────
const _texLoader = new THREE.TextureLoader();
const _cache = new Map();

function loadTex(url, colorSpace) {
  const key = url + '|' + colorSpace;
  if (_cache.has(key)) return Promise.resolve(_cache.get(key));

  return new Promise((resolve, reject) => {
    _texLoader.load(url, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = colorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 16;
      _cache.set(key, tex);
      resolve(tex);
    }, undefined, (err) => {
      console.error('[PBR] Failed to load texture:', url, err);
      reject(err);
    });
  });
}

// ── Public: load all PBR maps ──────────────────────────────────────────────
export async function loadPbrTextures(onProgress) {
  const keys = Object.keys(MATERIALS);
  const total = keys.length * 3;
  let done = 0;
  const tick = () => { done++; onProgress?.(Math.round((done / total) * 100)); };

  const result = {};
  await Promise.all(keys.map(async (key) => {
    const { diff, norm, rough } = MATERIALS[key];
    const [d, n, r] = await Promise.all([
      loadTex(diff, THREE.SRGBColorSpace).then(t => { tick(); return t; }),
      loadTex(norm, THREE.LinearSRGBColorSpace).then(t => { tick(); return t; }),
      loadTex(rough, THREE.LinearSRGBColorSpace).then(t => { tick(); return t; }),
    ]);
    result[key] = { diff: d, norm: n, rough: r };
  }));

  return result; // { asphalt, concrete, grass, ground }
}

// ══════════════════════════════════════════════════════════════════════════════
// MATERIAL CLASSIFICATION — maps each OSM feature to a material type
// ══════════════════════════════════════════════════════════════════════════════

// Channel index in internal masked rendering:
//   0 = asphalt  (R) hard/paved road surfaces
//   1 = grass    (G) parks, vegetation, green areas
//   2 = concrete (B) sidewalks, pedestrian areas, plazas
//   implicit black = ground (neutral urban background)

/** Classify an OSM feature into 'asphalt', 'concrete', 'grass', or null (= ground default) */
function getFeatureMaterial(tags, featureType) {
  if (!tags) return null;

  // ── Explicit surface tag overrides everything ──────────────────────────
  const s = tags.surface;
  if (s) {
    if (['asphalt', 'paved', 'metal', 'tartan', 'acrylic'].includes(s)) return 'asphalt';
    if (['concrete', 'concrete:plates', 'concrete:lanes', 'paving_stones',
      'sett', 'cobblestone', 'unhewn_cobblestone'].includes(s)) return 'concrete';
    if (['grass', 'artificial_turf'].includes(s)) return 'grass';
    if (['unpaved', 'gravel', 'dirt', 'ground', 'earth', 'mud', 'sand',
      'fine_gravel', 'compacted', 'rock', 'pebblestone',
      'woodchips', 'wood', 'stepping_stones'].includes(s)) return null;
  }

  // ── Roads (type === 'road') ────────────────────────────────────────────
  if (featureType === 'road') {
    const hw = tags.highway;
    if (['track', 'path', 'bridleway'].includes(hw)) return null;
    if (['footway', 'cycleway', 'steps'].includes(hw)) return 'concrete';
    return 'asphalt';
  }

  // ── Water features — skip (rendered as 3D water) ───────────────────────
  if (featureType === 'water') return null;

  // ── Vegetation ─────────────────────────────────────────────────────────
  if (featureType === 'vegetation') return 'grass';

  // ── Buildings — skip (rendered as 3D geometry) ─────────────────────────
  if (featureType === 'building') return null;

  // ── Aeroway ────────────────────────────────────────────────────────────
  if (tags.aeroway) return 'asphalt';

  // ── Amenity ────────────────────────────────────────────────────────────
  if (tags.amenity) {
    if (['parking', 'parking_space', 'bicycle_parking', 'motorcycle_parking',
      'school', 'university', 'college', 'hospital', 'clinic',
      'fire_station', 'police', 'prison', 'courthouse',
      'townhall', 'community_centre', 'marketplace', 'bus_station',
      'fuel', 'car_wash', 'place_of_worship'].includes(tags.amenity)) return 'asphalt';
    if (['grave_yard'].includes(tags.amenity)) return 'grass';
    return null;
  }

  // ── Landuse ────────────────────────────────────────────────────────────
  if (tags.landuse) {
    if (['industrial', 'commercial', 'retail', 'railway',
      'construction', 'garages', 'depot'].includes(tags.landuse)) return 'asphalt';
    if (['forest', 'farmland', 'farmyard', 'meadow', 'grass',
      'orchard', 'vineyard', 'allotments', 'flowerbed',
      'plant_nursery', 'village_green', 'recreation_ground',
      'cemetery', 'brownfield', 'greenfield'].includes(tags.landuse)) return 'grass';
    return null;
  }

  // ── Natural ────────────────────────────────────────────────────────────
  if (tags.natural) {
    if (['wood', 'forest', 'scrub', 'heath', 'moor',
      'grassland', 'fell', 'wetland', 'marsh', 'tundra'].includes(tags.natural)) return 'grass';
    return null;
  }

  // ── Leisure ────────────────────────────────────────────────────────────
  if (tags.leisure) {
    if (['pitch', 'swimming_pool', 'sports_centre', 'stadium',
      'track', 'ice_rink'].includes(tags.leisure)) return 'asphalt';
    if (['playground'].includes(tags.leisure)) return 'concrete';
    if (['park', 'garden', 'nature_reserve', 'golf_course',
      'common', 'dog_park', 'campsite', 'miniature_golf'].includes(tags.leisure)) return 'grass';
    return null;
  }

  // ── Man-made ───────────────────────────────────────────────────────────
  if (tags.man_made) {
    if (['pier', 'bridge', 'breakwater', 'groyne', 'quay',
      'wastewater_plant', 'works'].includes(tags.man_made)) return 'asphalt';
    return null;
  }

  // ── Highway (area features like pedestrian plazas) ─────────────────────
  if (tags.highway) {
    if (['pedestrian', 'rest_area', 'services', 'platform'].includes(tags.highway)) return 'concrete';
    if (['footway', 'cycleway', 'steps'].includes(tags.highway)) return 'concrete';
    return null;
  }

  // ── Public transport ───────────────────────────────────────────────────
  if (tags.public_transport) return 'concrete';

  // ── Power ──────────────────────────────────────────────────────────────
  if (tags.power) return 'asphalt';

  // ── Military ───────────────────────────────────────────────────────────
  if (tags.military) {
    if (['barracks', 'naval_base', 'airfield', 'bunker'].includes(tags.military)) return 'asphalt';
    return null;
  }

  // ── Wetland ────────────────────────────────────────────────────────────
  if (tags.wetland) return 'grass';

  // ── Landcover ──────────────────────────────────────────────────────────
  if (tags.landcover) {
    if (['grass', 'trees', 'bushes', 'scrub', 'crop', 'flowerbed'].includes(tags.landcover)) return 'grass';
    return null;
  }

  // ── Tourism ────────────────────────────────────────────────────────────
  if (tags.tourism) {
    if (['theme_park', 'zoo', 'hotel'].includes(tags.tourism)) return 'asphalt';
    if (['camp_site', 'picnic_site', 'wilderness_hut'].includes(tags.tourism)) return 'grass';
    return null;
  }

  // ── Bridge infra ───────────────────────────────────────────────────────
  if (featureType === 'bridge_infra') return 'asphalt';

  // ── Barrier ────────────────────────────────────────────────────────────
  if (featureType === 'barrier') return null;

  return null; // → ground (default)
}


// ══════════════════════════════════════════════════════════════════════════════
// SPLATMAP GENERATION — Uses the same feature rendering as osmTexture.js
// but paints material IDs instead of colors
// ══════════════════════════════════════════════════════════════════════════════

/** Generate a splatmap from OSM features using the same rendering approach as
 *  the OSM texture mode. Each feature is classified and painted into the
 *  appropriate channel (R=asphalt, G=grass, B=concrete). Unpainted areas default to ground.
 *
 *  This reuses the exact same feature list, area sorting, and polygon rendering
 *  as osmTexture.js → same visual zoning as the OSM texture mode. */
export function generateSplatmap(terrainData) {
  const SIZE = 2048;

  if (!terrainData?.osmFeatures?.length || !terrainData?.bounds) {
    const c = document.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    return tex;
  }

  const { bounds } = terrainData;
  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLng = (bounds.east + bounds.west) / 2;
  const toMetric = createWGS84ToLocal(centerLat, centerLng);
  const halfW = terrainData.width / 2;
  const halfH = terrainData.height / 2;

  // Adaptation dynamique aux dimensions du terrain pour éviter le décalage (UV stretching)
  const SCALE = SIZE / Math.max(terrainData.width, terrainData.height);
  const canvasW = Math.max(1, Math.round(terrainData.width * SCALE));
  const canvasH = Math.max(1, Math.round(terrainData.height * SCALE));

  const toPixel = (lat, lng) => {
    const [lx, ly] = toMetric.forward([lng, lat]);
    return { x: (lx + halfW) * SCALE, y: (halfH - ly) * SCALE };
  };

  // ── Classify all features ──────────────────────────────────────────────
  // Same ordering as osmTexture.js:renderFeaturesToCanvas
  const features = terrainData.osmFeatures;

  // Sort landcover by area (largest first) like osmTexture.js
  const landcover = features.filter(f =>
    ['vegetation', 'water', 'landuse', 'bridge_infra'].includes(f.type)
  );
  const areaOf = (f) => {
    if (!f.geometry || f.geometry.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < f.geometry.length; i++) {
      const p1 = f.geometry[i];
      const p2 = f.geometry[(i + 1) % f.geometry.length];
      a += (p2.lng - p1.lng) * (p2.lat + p1.lat);
    }
    return Math.abs(a);
  };
  landcover.sort((a, b) => areaOf(b) - areaOf(a));

  // Roads sorted by layer then priority (like osmTexture.js)
  const roads = features.filter(f => f.type === 'road');
  const roadPriority = {
    motorway: 100, motorway_link: 100, trunk: 90, trunk_link: 90,
    primary: 80, primary_link: 80, secondary: 70, secondary_link: 70,
    tertiary: 60, tertiary_link: 60, residential: 50, unclassified: 40,
    service: 30, path: 20, footway: 20, cycleway: 20, pedestrian: 20,
    track: 15, steps: 10,
  };
  const getEffectiveLayer = (tags = {}) => {
    const explicit = Number.parseInt(tags.layer, 10);
    let layer = Number.isFinite(explicit) ? explicit : 0;
    if (!Number.isFinite(explicit)) {
      if (tags.bridge === 'yes' || tags.bridge === 'viaduct') layer += 1;
      if (tags.tunnel === 'yes' || tags.covered === 'yes') layer -= 1;
    }
    return layer;
  };
  roads.sort((a, b) => {
    const la = getEffectiveLayer(a.tags || {});
    const lb = getEffectiveLayer(b.tags || {});
    if (la !== lb) return la - lb;
    return (roadPriority[a.tags?.highway] || 10) - (roadPriority[b.tags?.highway] || 10);
  });

  // ── Create the splatmap canvas ─────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  // Default background = black (0,0,0) = ground
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // ── Helper: draw polygon (with holes support) ──────────────────────────
  const drawPolygon = (f) => {
    ctx.beginPath();
    const pts = f.geometry.map(p => toPixel(p.lat, p.lng));
    if (pts.length > 0) {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    if (f.holes) {
      for (const hole of f.holes) {
        const hp = hole.map(p => toPixel(p.lat, p.lng));
        if (hp.length > 0) {
          ctx.moveTo(hp[0].x, hp[0].y);
          for (let i = 1; i < hp.length; i++) ctx.lineTo(hp[i].x, hp[i].y);
        }
        ctx.closePath();
      }
    }
  };

  // Color encoding: R=255 → asphalt, G=255 → grass, B=255 → concrete, black → ground
  const MAT_COLORS = { asphalt: '#ff0000', grass: '#00ff00', concrete: '#0000ff' };

  // ── Pass 1: Draw landcover polygons (same order as osmTexture.js) ──────
  for (const f of landcover) {
    const mat = getFeatureMaterial(f.tags, f.type);
    if (!mat || mat === 'ground') continue;

    ctx.fillStyle = MAT_COLORS[mat];

    if (f.geometry.length === 1) {
      // Skip point vegetation (trees rendered as 3D)
      if (f.type === 'vegetation') continue;
      const p = toPixel(f.geometry[0].lat, f.geometry[0].lng);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5 * SCALE, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Linear waterway → draw as stroke
      const isLinearWater = f.tags?.waterway &&
        !['riverbank', 'dock', 'boatyard', 'dam'].includes(f.tags.waterway) &&
        f.tags?.area !== 'yes';
      const p1 = f.geometry[0];
      const p2 = f.geometry[f.geometry.length - 1];
      const isClosed = Math.abs(p1.lat - p2.lat) < 1e-9 && Math.abs(p1.lng - p2.lng) < 1e-9;

      if (isLinearWater && !isClosed) {
        const pts = f.geometry.map(p => toPixel(p.lat, p.lng));
        ctx.beginPath();
        if (pts.length > 0) {
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.strokeStyle = ctx.fillStyle;
        let w = 1.5;
        if (f.tags.width) w = parseFloat(f.tags.width);
        else if (f.tags.waterway === 'river') w = 6;
        else if (f.tags.waterway === 'canal') w = 4;
        ctx.lineWidth = w * SCALE;
        ctx.lineCap = 'round';
        ctx.stroke();
      } else {
        drawPolygon(f);
        ctx.fill('evenodd');
      }
    }
  }

  // ── Pass 2: Draw roads (same order as osmTexture.js) ───────────────────
  // Footways/paths first, then vehicle roads
  const footways = roads.filter(f =>
    ['footway', 'path', 'pedestrian', 'cycleway', 'steps', 'track'].includes(f.tags?.highway)
  );
  const vehicleRoads = roads.filter(f =>
    !['footway', 'path', 'pedestrian', 'cycleway', 'steps', 'track'].includes(f.tags?.highway)
  );

  // Draw footways
  for (const f of footways) {
    const mat = getFeatureMaterial(f.tags, f.type);
    if (!mat || mat === 'ground') continue;
    const pts = f.geometry.map(p => toPixel(p.lat, p.lng));
    ctx.beginPath();
    if (pts.length > 0) {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = MAT_COLORS[mat];
    ctx.lineWidth = 1.5 * SCALE;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // Draw vehicle roads
  for (const f of vehicleRoads) {
    const mat = getFeatureMaterial(f.tags, f.type);
    if (!mat || mat === 'ground') continue;
    const pts = f.geometry.map(p => toPixel(p.lat, p.lng));
    ctx.beginPath();
    if (pts.length > 0) {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = MAT_COLORS[mat];
    // Compute road width (same logic as osmTexture.js getLaneLayout)
    const width = _estimateRoadWidth(f.tags);
    ctx.lineWidth = width * SCALE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // ── Create Three.js texture ────────────────────────────────────────────
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.flipY = false; // terrain UVs use v=0=top (north), matching canvas y=0=top
  tex.needsUpdate = true;
  return tex;
}

/** Estimate total road width in meters (simplified from osmTexture.js getLaneLayout) */
function _estimateRoadWidth(tags) {
  if (!tags) return 6;
  // Explicit width tag
  if (tags.width) {
    const w = parseFloat(String(tags.width));
    if (Number.isFinite(w) && w > 0) return w;
  }
  const hw = tags.highway;
  const isOneWay = tags.oneway === 'yes' || tags.oneway === '1' || hw === 'motorway';
  const lanes = parseInt(tags.lanes) || null;

  // Default lane widths by classification
  const laneWidth = {
    motorway: 3.7, motorway_link: 3.5, trunk: 3.7, trunk_link: 3.5,
    primary: 3.5, primary_link: 3.25, secondary: 3.5, secondary_link: 3.25,
    tertiary: 3.25, tertiary_link: 3.0, residential: 3.0, unclassified: 3.0,
    living_street: 2.75, service: 2.75,
  }[hw] || 3.0;

  if (lanes) return lanes * laneWidth;

  // Default total widths
  const defaults = {
    motorway: 14.8, trunk: 14.0, primary: 13.0, secondary: 10.5,
    tertiary: 9.0, residential: 8.0, unclassified: 6.0,
    service: 4.0, living_street: 5.0,
    footway: 2.0, path: 1.5, cycleway: 2.0, pedestrian: 3.0,
    track: 3.0, steps: 2.0,
  };
  if (defaults[hw]) return isOneWay ? defaults[hw] * 0.6 : defaults[hw];
  return 6;
}


// ══════════════════════════════════════════════════════════════════════════════
// MATERIAL BUILDING — composites PBR textures using the splatmap
// ══════════════════════════════════════════════════════════════════════════════

export function buildPbrMaterial(pbrTextures, splatmapTex, tileScale) {
  const { asphalt, concrete, grass, ground } = pbrTextures;

  console.log('[PBR] Building GPU Splatmap material, tileScale=', tileScale);

  // Only set `map` to enable USE_MAP + vMapUv in the shader.
  // Do NOT set normalMap/roughnessMap to the splatmap: Three.js would use the raw
  // R/G/B channel values as normal vectors and roughness, producing mirror-like
  // artifacts and extreme specular highlights (fluorescent appearance).
  const mat = new THREE.MeshStandardMaterial({
    map: splatmapTex,
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  // CONTOURNEMENT TRESJS / VUE 3 : Empêche Vue de rendre ce matériau réactif
  mat.__v_skip = true;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tileScale = { value: tileScale };

    shader.uniforms.tAsphaltDiff = { value: asphalt.diff };
    shader.uniforms.tConcreteDiff = { value: concrete.diff };
    shader.uniforms.tGrassDiff = { value: grass.diff };
    shader.uniforms.tGroundDiff = { value: ground.diff };

    shader.uniforms.tAsphaltNorm = { value: asphalt.norm };
    shader.uniforms.tConcreteNorm = { value: concrete.norm };
    shader.uniforms.tGrassNorm = { value: grass.norm };
    shader.uniforms.tGroundNorm = { value: ground.norm };

    shader.uniforms.tAsphaltRough = { value: asphalt.rough };
    shader.uniforms.tConcreteRough = { value: concrete.rough };
    shader.uniforms.tGrassRough = { value: grass.rough };
    shader.uniforms.tGroundRough = { value: ground.rough };

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_pars_fragment>',
      `#include <map_pars_fragment>
      uniform float tileScale;

      uniform sampler2D tAsphaltDiff;
      uniform sampler2D tConcreteDiff;
      uniform sampler2D tGrassDiff;
      uniform sampler2D tGroundDiff;

      uniform sampler2D tAsphaltNorm;
      uniform sampler2D tConcreteNorm;
      uniform sampler2D tGrassNorm;
      uniform sampler2D tGroundNorm;

      uniform sampler2D tAsphaltRough;
      uniform sampler2D tConcreteRough;
      uniform sampler2D tGrassRough;
      uniform sampler2D tGroundRough;
      `
    );

    // Replace map_fragment: blend PBR diffuse textures by splatmap channel weights.
    // Runs unconditionally (USE_MAP is always defined since we set map: splatmapTex).
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      {
        vec4 splat = texture2D(map, vMapUv);
        float wA = splat.r;
        float wG = splat.g;
        float wC = splat.b;
        float wGr = max(0.0, 1.0 - (wA + wG + wC));

        vec2 tuv = vMapUv * tileScale;

        vec4 cA  = texture2D(tAsphaltDiff,  tuv);
        vec4 cC  = texture2D(tConcreteDiff, tuv);
        vec4 cG  = texture2D(tGrassDiff,    tuv);
        vec4 cGr = texture2D(tGroundDiff,   tuv);

        diffuseColor *= cA * wA + cC * wC + cG * wG + cGr * wGr;
      }
      `
    );

    // Replace roughnessmap_fragment unconditionally (no USE_ROUGHNESSMAP needed).
    // roughnessFactor must be declared here as the standard chunk declares it.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float roughnessFactor = roughness;
      {
        vec4 splat_r = texture2D(map, vMapUv);
        float wA_r  = splat_r.r;
        float wG_r  = splat_r.g;
        float wC_r  = splat_r.b;
        float wGr_r = max(0.0, 1.0 - (wA_r + wG_r + wC_r));

        vec2 tuv_r = vMapUv * tileScale;
        float rA  = texture2D(tAsphaltRough,  tuv_r).g;
        float rC  = texture2D(tConcreteRough, tuv_r).g;
        float rG  = texture2D(tGrassRough,    tuv_r).g;
        float rGr = texture2D(tGroundRough,   tuv_r).g;

        float mixedR = rA * wA_r + rC * wC_r + rG * wG_r + rGr * wGr_r;
        if (mixedR > 0.0) roughnessFactor *= mixedR;
      }
      `
    );

    // Replace normal_fragment_maps: blend PBR normal maps by splatmap weights.
    // Three.js r162 uses USE_NORMALMAP_TANGENTSPACE (no underscore).
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `
      #ifdef USE_NORMALMAP_TANGENTSPACE
        vec4 splat_n = texture2D(map, vMapUv);
        float wA_n  = splat_n.r;
        float wG_n  = splat_n.g;
        float wC_n  = splat_n.b;
        float wGr_n = max(0.0, 1.0 - (wA_n + wG_n + wC_n));

        vec2 tuv_n = vMapUv * tileScale;
        vec3 nA  = texture2D(tAsphaltNorm,  tuv_n).xyz;
        vec3 nC  = texture2D(tConcreteNorm, tuv_n).xyz;
        vec3 nG  = texture2D(tGrassNorm,    tuv_n).xyz;
        vec3 nGr = texture2D(tGroundNorm,   tuv_n).xyz;

        vec3 mixedN = nA * wA_n + nC * wC_n + nG * wG_n + nGr * wGr_n;
        vec3 mapN = mixedN * 2.0 - 1.0;
        mapN.xy *= normalScale;
        normal = perturbNormal2Arb( - vViewPosition, normal, mapN, faceDirection );
      #endif
      `
    );
  };

  // Use tileScale in the cache key so different terrain sizes get fresh programs.
  mat.customProgramCacheKey = () => `gpu_splatmap_v3_${tileScale}`;

  console.log('[PBR] GPU Material built successfully');
  return mat;
}

/** Compute tileScale from terrain bounds.
 *  metersPerRepeat controls how many meters each texture tile covers. */
export function computeTileScale(bounds, metersPerRepeat = 5) {
  const latRad = ((bounds.north + bounds.south) / 2) * Math.PI / 180;
  const widthM = (bounds.east - bounds.west) * 111320 * Math.cos(latRad);
  return Math.max(1, widthM / metersPerRepeat);
}
