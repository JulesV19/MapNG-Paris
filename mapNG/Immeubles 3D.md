# Immeubles 3D — Façades texturées + Toitures OSM

> **Date** : 17 avril 2026
> **Fichier principal** : `services/export3d.js` — fonction `createOSMGroup()`

---

## Objectif

Remplacer les blocs `ExtrudeGeometry` uniformes par un système de bâtiments avec :
- **Façades texturées** par type de bâtiment (fenêtres, meneaux, détails)
- **Normal maps procédurales** pour simuler la profondeur des fenêtres sans géométrie
- **Toitures OSM** en forme réelle (pignon, croupe, pyramide)

---

## Architecture

### Pipeline par bâtiment

```
OSM tags
  │
  ├─→ getBuildingConfig()
  │     ├── height / levels / minHeight
  │     ├── wallColor / roofColor (OSM2World)
  │     ├── roofShape / roofHeight
  │     └── buildingType ← nouveau
  │
  └─→ Rendu (createOSMGroup)
        ├─→ _buildWall()   → BufferGeometry (quads manuels, UV métriques)
        └─→ _*Roof()       → BufferGeometry (selon roofShape)
```

### Deux meshes séparés par groupe

Tous les bâtiments d'un même type sont mergés en **deux meshes** :

| Mesh | Matériau | Attributs |
|---|---|---|
| `buildings` | `MeshStandardMaterial` + `map` + `normalMap` | position, uv, color, normal |
| `roofs` | `MeshStandardMaterial` vertex colors | position, color, normal |

### Pourquoi des quads manuels (pas ExtrudeGeometry) ?

`ExtrudeGeometry` génère des UVs qui mappent le périmètre entier de 0 à 1 — la texture ne peut pas se répéter à échelle physique. Les quads manuels permettent d'affecter `u = longueur_arête / tileWidth` et `v = hauteur / tileHeight`, ce qui tire la texture à la bonne échelle métrique quelle que soit la taille du bâtiment.

---

## Types de façades

5 types dérivés du tag `building=*` OSM :

| Type | Tags OSM | Tile (m) | Roughness | Pattern |
|---|---|---|---|---|
| `residential` | `apartments`, `residential`, `dormitory` | 4 × 3 | 0.82 | 2 fenêtres 4-carreaux + bandeau dalle |
| `office` | `office`, `commercial`, `retail`, `hotel` | 3 × 3 | 0.25 | Mur-rideau quasi-intégral, meneaux fins |
| `house` | `house`, `detached`, `terrace`, `bungalow` | 5 × 2.8 | 0.88 | 2 fenêtres domestiques avec appui/linteau |
| `industrial` | `industrial`, `warehouse`, `factory`, `barn` | 6 × 4 | 0.92 | Bandes nervurées + imposte haute |
| `default` | tout le reste | 4 × 3 | 0.82 | 2 fenêtres génériques |

### Couleur wall × texture

Le matériau utilise `vertexColors: true` + `map` simultanément. Three.js **multiplie** les deux dans le shader : `diffuse = texture × vertexColor`.

- Fond texture blanc (`#fff`) → couleur OSM du bâtiment passe à 100%
- Vitres sombres (`#1e1e1e`) → fenêtres foncées quelle que soit la couleur du mur
- Bandes intermédiaires (`#ccc`) → détails légèrement plus sombres que le mur

---

## Normal maps procédurales

### Génération via filtre Sobel

```javascript
sobelNormalMap(albedoCtx, W, H, strength)
```

1. Lit les pixels du canvas albedo (niveaux de gris)
2. Applique le filtre Sobel (gradient horizontal dX + vertical dY)
3. Convertit en vecteur normal tangent `(nx, ny, nz)` normalisé
4. Encode en RGB : `(nx*0.5+0.5, ny*0.5+0.5, nz*0.5+0.5)`

**Résultat** : les arêtes des fenêtres (transition blanc→sombre) génèrent des normales obliques qui captent la lumière de manière directionnelle → illusion de profondeur sans géométrie.

`normalScale` réglé à `(1.2, 1.2)` dans le matériau. L'office utilise `strength=6.0` pour des reflets plus marqués sur le verre.

---

## Toitures OSM

Le tag `roof:shape` est lu depuis OSM depuis le début mais était ignoré. Implémentation de 4 formes :

### `flat` (défaut)
`ShapeGeometry` → triangulation du polygone emprise → calotte à `y = wallTop`.

### `pyramidal`
Centroïde du polygone → apex. Chaque arête génère un triangle vers l'apex.
```
apex = moyenne des sommets footprint
pour chaque arête (a, b) : triangle (apex, a, b)
```

### `gabled` (pignon)
AABB du footprint. Le faîtage court selon le grand axe.
- Si largeur X ≥ profondeur Z : faîtage le long de X, 2 versants + 2 pignons triangulaires
- Sinon : faîtage le long de Z

### `hipped` (croupe)
Même logique que gabled mais le faîtage est raccourci de `offset = petitCôté/2`. Si le faîtage dégénère (carré) → fallback pyramidal.

### Fallback
Tout `roofShape` non reconnu → `flat`.

---

## UV métriques

Les UVs des murs sont exprimées en **unités de tile** (pas en 0-1 normalisé) :

```javascript
uE = longueur_arête_mètres / tileWidth   // répétitions horizontales
vH = hauteur_mur_mètres / tileHeight      // répétitions verticales
```

`texture.wrapS = texture.wrapT = RepeatWrapping` → la texture se répète automatiquement.

Pour un mur de 12m de large avec `tileWidth=4m` : `uE=3` → 3 répétitions = 6 fenêtres.

---

## Winding et DoubleSide

Les polygones OSM arrivent sans garantie d'orientation (CW ou CCW). La normale d'un quad mural dépend du sens de parcours :

```
normale ∝ (-dz, 0, dx)   ← outward pour CCW
```

**Fix** : `side: THREE.DoubleSide` sur le matériau mur. Le matériau toit utilise aussi DoubleSide car les toitures AABB ont un winding non contrôlé.

---

## Fichiers modifiés

### `services/export3d.js`

**`getBuildingConfig(tags, areaMeters)`** (L.732)
- Ajoute la classification `buildingType` dans le return

**`createOSMGroup()`** — bloc bâtiments (L.~1095)
- `sobelNormalMap()` — génération normal map par Sobel
- `buildFacadeMat()` — crée wall/roofMat depuis une draw function
- `FACADES` — définitions des 5 types
- `_buildWall()` — quads manuels avec UV métriques
- `_flatRoof()`, `_pyramidalRoof()`, `_gabledRoof()`, `_hippedRoof()` — géométries de toitures
- Groupement par `buildingType`, merge + emit par type

---

## Axes d'amélioration futurs

1. **Rez-de-chaussée distinct** — vitrine/commerces en bas, fenêtres standards en haut (UV offset selon étage)
2. **Variation aléatoire** — décaler légèrement les UVs par bâtiment pour casser la répétition en vue rasante
3. **Façade haute résolution** — 512×384 (16×12 px/m) pour les bâtiments proches de la caméra
4. **Orientation du faîtage** — utiliser le tag `roof:direction` OSM au lieu du grand axe de l'AABB
5. **Toitures mansardées** — geometry en deux pentes (steep + shallow) pour les immeubles haussmanniens
6. **Cheminées** — cylindres/boîtes sur les toits pour les maisons (tag `building:chimney`)
7. **Émissivité fenêtres** — légère émission bleue/chaude sur les vitres pour simuler un éclairage nocturne
