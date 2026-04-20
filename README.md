# 🌍 MapNG (Édition France / Europe)

> **Générateur de terrains réels et d'environnements 3D**
> *Il s'agit d'une extension du projet original [MapNG](https://github.com/nikkiluzader/mapng), spécialement axée sur l'architecture et les environnements de France et d'Europe.*
> 
> **Note :** Contrairement au projet d'origine qui est très centré sur la création de niveaux pour le jeu **BeamNG.drive**, ce fork se concentre sur la **génération de cartes 3D en général** (pour Blender, d'autres moteurs de jeu, l'architecture, le SIG, etc.). Les exports BeamNG restent possibles mais ne sont plus la finalité unique.

MapNG France est une application web qui transforme des lieux du monde réel en terrains, textures, données SIG et maillages 3D complets. 

Conçu pour les artistes 3D, les développeurs, les architectes et les créateurs d'environnements, MapNG embarque un aperçu 3D complet in-browser et de multiples pipelines d'exportation.

---

## 📸 Aperçu

<!-- 1. Screen du choix de la zone sur la carte 2D -->
### 📍 Sélection de la zone
![Sélection de la zone sur la carte 2D](images/zone_selection.png)
*Sélection précise de la carte avec recherche Nominatim et paramètres de résolution.*

<!-- 2. Screen de la génération dans le navigateur -->
### 💻 Génération 3D temps réel
![Aperçu 3D du terrain généré dans le navigateur](images/mapNG_preview.png)
*Aperçu 3D en direct généré via Three.js/TresJS, incluant les bâtiments OSM, les textures hybrides et les arbres.*

<!-- 3. Screen dans Blender (1) -->
### 🎨 Importation dans Blender
![Importation dans Blender](images/blender.png)
*Le terrain et les bâtiments importés et texturés automatiquement dans Blender.*

<!-- 4. Screen dans Blender (2) -->
### 🔍 Rendu dans Blender
![Rendu dans Blender](images/blender_render.png)
*Détails des façades procédurales, des toits et de l'éclairage générés par le script Python inclus.*

---

## ✨ Fonctionnalités Principales

- **Sources d'élévation multiples** : Support natif d'AWS Terrarium (Standard 30m), de l'USGS DEM 1m (USA) et de l'API GPXZ Premium pour une précision maximale.
- **Aperçu 3D Interactif** : Rendu des textures satellites, de la géométrie des bâtiments OSM avec **styles architecturaux régionaux français** (Haussmannien, Normand, Breton, etc.), de la végétation et des ombres.
- **Exports exhaustifs** :
  - **2D** : Heightmaps PNG 16 bits, Textures Satellites, OSM et Hybrides (jusqu'à 8192x8192), Masques routiers.
  - **3D** : Modèles GLB et Collada DAE.
  - **SIG** : GeoTIFF et GeoJSON.
  - **BeamNG** : Fichier `.ter` ou package ZIP expérimental de niveau complet jouable.
- **Traitement par Lot (Batch Job)** : Générez des terrains immenses via un système de grille allant jusqu'à 20x20 tuiles, avec calcul global des hauteurs minimales et maximales.
- **Tuiles Environnantes (Surroundings)** : Téléchargez le terrain lointain (8 directions) de manière adaptative pour créer des horizons réalistes hors limite.

## 🛠 Utilisation avec Blender (Script automatique)

Le projet inclut un script Python (`blender_materials.py`) pour transformer votre export brut en un rendu Cycles :

1. Exportez votre scène depuis MapNG au format **GLB** ou **Collada DAE**.
2. Dans Blender, importez le fichier (File > Import > glTF 2.0 / Collada).
3. Allez dans l'espace de travail **Scripting**.
4. Ouvrez le fichier `blender_materials.py` situé à la racine de MapNG.
5. Cliquez sur **Run Script**. 

Le script va automatiquement texturer les murs selon leur style architectural, créer des matériaux de toiture (zinc, ardoise, tuiles) avec le bon niveau de "roughness", et configurer l'éclairage de la scène (Sky Texture Nishita) ainsi que la caméra.

## 🚀 Installation & Développement

```bash
# 1. Installer les dépendances
npm install
# ou pnpm install

# 2. Lancer le serveur de développement local
npm run dev
```

## ⚠️ Avertissement

Toutes les données de terrain, de hauteur et modèles 3D sont des estimations basées sur les jeux de données satellites et vectoriels disponibles. Cet outil est destiné au **modding** et à la création artistique. Il ne doit pas être utilisé pour l'ingénierie ou la navigation dans le monde réel.

**En cours de développement :** Ce projet est actuellement en plein développement. Veuillez noter que les rendus 3D exacts de certains bâtiments complexes, **notamment les monuments historiques**, ne sont pas encore possibles à ce stade.

---

*Créé par l'auteur de MapNG. Les données cartographiques proviennent d'OpenStreetMap, de l'USGS, de GPXZ et de l'imagerie mondiale Esri.*