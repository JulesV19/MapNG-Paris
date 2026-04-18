# PBR Terrain Textures — Mode "Matériaux"

> **Date** : 17 avril 2026
> **Fichiers principaux** : `services/pbrTerrainMaterials.js`, `components/three/TerrainMesh.vue`

---

## Objectif

Ajouter un mode de texture **"Matériaux"** qui affiche des textures de sol réalistes (PBR) sur le terrain 3D, en utilisant les données OSM pour déterminer quel matériau utiliser à quel endroit (asphalte sur les routes, herbe/terre dans les parcs, etc.).

---

## Architecture finale

### Pipeline de rendu

```
Textures PBR (2K JPG) ──┐
                         ├─→ Canvas 2D Compositing ──→ MeshStandardMaterial
Splatmap OSM (1024px) ───┘      (4096×4096)              map / roughnessMap / normalMap
```

### Pourquoi pas des shaders GPU ?

L'approche initiale utilisait `MeshStandardMaterial.onBeforeCompile()` pour injecter un fragment shader custom (splatmap + tiling GPU). **Cela n'a jamais fonctionné** car dans l'environnement TresJS + Three.js r162, `onBeforeCompile` n'est jamais appelé quand le matériau est assigné au mesh via un `watchEffect` Vue.

**Problèmes identifiés :**
1. `vUv` n'existe plus dans Three.js r162 (remplacé par `vNormalMapUv`, `vMapUv`, etc.)
2. `onBeforeCompile` ne se déclenche jamais — le shader custom ne compile jamais
3. Le matériau rend comme un `MeshStandardMaterial` blanc par défaut

**Solution adoptée** : composition CPU-side via Canvas 2D API, puis passage en `map` standard.

### Compositing Canvas 2D

L'approche finale utilise le Canvas 2D API du navigateur (GPU-accéléré) :

1. **`createPattern()`** — tuile les textures PBR à la bonne échelle
2. **`globalCompositeOperation = 'destination-in'`** — masque chaque couche par la splatmap
3. **3 passes** : ground (fond) → asphalt (par-dessus, masqué) → rocky (par-dessus, masqué)
4. Résultat : 3 canvases (albedo, roughness, normal) à 4096×4096

---

## Textures PBR

### Source
[Poly Haven](https://polyhaven.com/) — Licence CC0

| Matériau | Fichiers | Usage |
|---|---|---|
| `asphalt_02` | `asphalt_2k/diff.jpg`, `nor.jpg`, `rough.jpg` | Routes, parkings, zones industrielles |
| `rocky_terrain_02` | `rocky_2k/diff.jpg`, `nor.jpg`, `rough.jpg` | Forêts, parcs, prairies, terre |
| `ground_grey` | `ground_2k/diff.jpg`, `nor.jpg`, `rough.jpg` | Fond neutre (résidentiel, défaut) |

### Résolutions disponibles

| Résolution | Dossier | Taille totale | Usage |
|---|---|---|---|
| **4K** (4096×4096) | `*_4k/textures/` | ~75 Mo | Originaux, ne pas charger directement |
| **2K** (2048×2048) | `*_2k/` | ~19 Mo | ✅ **Utilisé actuellement** |
| **1K** (1024×1024) | `*_1k/` | ~4 Mo | Fallback si performance limitée |

### Paramètres de qualité

```javascript
// Dans buildPbrMaterial()
const SIZE = 4096;  // Résolution de sortie (canvas composité)

// Dans TerrainMesh.vue
const tileScale = computeTileScale(rawData.bounds, 15);
// metersPerRepeat=15 → ~35 tuiles pour 500m → ~117px/tuile à 4096 output

// Dans _compositeWithMasks()
const SRC = 2048;  // Résolution source (match 2K textures)
```

---

## Splatmap — Classification OSM

La splatmap est un canvas 1024×1024 avec :
- **Canal R** (rouge) = zones asphalte
- **Canal G** (vert) = zones nature/terre
- **Noir** (R=G=0) = ground neutre (défaut)

### Rendu identique au mode OSM

La génération de la splatmap **réplique exactement** le pipeline de `osmTexture.js` :
- Même tri des features (par surface, plus grand → plus petit)
- Même rendu des polygones (avec support des trous)
- Même ordre de dessin (footways → routes véhicules)
- Routes dessinées avec leurs vraies largeurs (`_estimateRoadWidth()`)

### Classification `getFeatureMaterial(tags, type)`

| Catégorie | → Asphalt | → Rocky | → Ground (défaut) |
|---|---|---|---|
| **surface=** | `asphalt`, `paved`, `concrete`, `sett`... | `unpaved`, `gravel`, `dirt`, `grass`... | — |
| **highway** | Toutes routes véhicules + footways | `track`, `path`, `bridleway` | — |
| **aeroway** | `runway`, `taxiway`, `apron`, `helipad` | — | — |
| **amenity** | `parking`, `school`, `hospital`, `fuel`... | `grave_yard` | — |
| **landuse** | `industrial`, `commercial`, `retail`... | `forest`, `farmland`, `meadow`, `grass`... | `residential` |
| **natural** | — | `wood`, `scrub`, `beach`, `sand`, `rock`... | — |
| **leisure** | `pitch`, `stadium`, `playground`... | `park`, `garden`, `golf_course`... | — |
| **man_made** | `pier`, `bridge`, `quay`... | — | — |
| **building** | — (rendu en 3D) | — | — |
| **water** | — (rendu en 3D) | — | — |

---

## Fichiers modifiés

### `services/pbrTerrainMaterials.js` (réécrit de zéro)
- `loadPbrTextures(onProgress)` — charge les 9 textures JPG (3 matériaux × 3 maps)
- `generateSplatmap(terrainData)` — génère la splatmap R/G depuis les features OSM
- `getFeatureMaterial(tags, type)` — classifie chaque feature en asphalt/rocky/ground
- `buildPbrMaterial(pbrTextures, splatmap, tileScale)` — compose les textures finales
- `computeTileScale(bounds, metersPerRepeat)` — calcule le nombre de répétitions
- Helpers internes : `_readSplatmapPixels`, `_channelToAlphaMask`, `_texToCanvas`, `_fillTiled`, `_compositeWithMasks`

### `components/three/TerrainMesh.vue`
- **watchEffect** (L352) — assigne le bon matériau au mesh selon `textureType`
- **watch PBR** (L369) — charge textures, génère splatmap, build material quand mode = `'pbr'`
- `metersPerRepeat` changé de `4` → `15` pour meilleure qualité canvas

---

## Problèmes résolus

### 1. Textures 4K trop lourdes (VRAM)
**Symptôme** : Terrain blanc, pas d'erreur console
**Cause** : 9 textures 4K = ~576 Mo VRAM, dépassement silencieux WebGL
**Solution** : Redimensionné en 2K (~19 Mo disque, ~48 Mo VRAM pour les sources)

### 2. `vUv` inexistant dans Three.js r162
**Symptôme** : Shader GLSL ne compile pas → blanc
**Cause** : `USE_UV` supprimé dans r162, `vUv` n'est plus défini
**Solution** : Remplacé par `vNormalMapUv` (défini quand `normalMap` est set)
**Note** : Ce fix n'a pas suffi car `onBeforeCompile` ne se déclenchait pas

### 3. `onBeforeCompile` jamais appelé
**Symptôme** : Le matériau s'assigne au mesh (logs OK) mais le shader custom ne compile jamais
**Cause probable** : Conflit TresJS — le framework intercepte ou réinitialise le matériau
**Solution** : Abandonné l'approche shader, passé au compositing CPU canvas

### 4. Splatmap trop simpliste
**Symptôme** : La plupart des zones OSM n'étaient pas couvertes par le splatmap
**Cause** : Seulement 5 tags OSM vérifiés (parking, runway, forest, etc.)
**Solution** : Classification exhaustive de ~100+ tags OSM via `getFeatureMaterial()`

### 5. Découpage différent du mode OSM
**Symptôme** : Les routes et zones ne correspondaient pas au mode OSM
**Cause** : Le splatmap utilisait une logique simple (polygones par taille) sans rendre les routes
**Solution** : Répliqué le pipeline exact de `osmTexture.js` — tri par area, routes en stroke avec largeurs réelles, même ordre de dessin

---

## Performance

| Étape | Temps approx. |
|---|---|
| Chargement 9 textures 2K | ~1-2s |
| Génération splatmap 1024px | ~100ms |
| Composition 3× canvases 4096px | ~2-3s |
| Upload GPU (3 textures 4096) | ~200ms |
| **Total** | **~4-5s** |

VRAM utilisée : 3 × 4096² × 4 bytes = **~192 Mo** (raisonnable pour un GPU moderne)

---

## Axes d'amélioration futurs

1. **Web Workers** — déporter la composition canvas dans un worker pour ne pas bloquer le thread UI
2. **Shader GPU** — résoudre le problème `onBeforeCompile` / TresJS pour revenir au tiling GPU (qualité infinie)
3. **Plus de matériaux** — ajouter herbe, pavés, béton (nécessite 4+ canaux de splatmap)
4. **Textures procédurales** — mélanger les tuiles avec du bruit Perlin pour casser la répétition
5. **LOD** — composer à 2048 par défaut, 4096 si l'utilisateur zoome
