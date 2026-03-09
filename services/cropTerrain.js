/**
 * Crops a terrainData object to its center exportCropSize × exportCropSize area.
 * Returns the original terrainData unchanged if exportCropSize is not set.
 *
 * Textures (URL strings) are cropped via an offscreen canvas.
 */

async function cropTextureUrl(url, origWidth, origHeight, startX, startY, cropSize) {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = cropSize;
      canvas.height = cropSize;
      const ctx = canvas.getContext('2d');
      // Scale the source rect from heightmap pixel space to image pixel space
      const sx = startX * (img.naturalWidth  / origWidth);
      const sy = startY * (img.naturalHeight / origHeight);
      const sw = cropSize * (img.naturalWidth  / origWidth);
      const sh = cropSize * (img.naturalHeight / origHeight);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cropSize, cropSize);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

function cropHeightmap(heightMap, origWidth, origHeight, startX, startY, cropSize) {
  const out = new Float32Array(cropSize * cropSize);
  for (let row = 0; row < cropSize; row++) {
    const srcRow = startY + row;
    for (let col = 0; col < cropSize; col++) {
      out[row * cropSize + col] = heightMap[(srcRow * origWidth) + (startX + col)];
    }
  }
  return out;
}

function adjustBounds(bounds, origWidth, origHeight, startX, startY, cropSize) {
  const lngPerPx = (bounds.east  - bounds.west)  / origWidth;
  const latPerPx = (bounds.north - bounds.south) / origHeight;
  return {
    west:  bounds.west  + startX          * lngPerPx,
    east:  bounds.west  + (startX + cropSize) * lngPerPx,
    north: bounds.north - startY          * latPerPx,
    south: bounds.north - (startY + cropSize) * latPerPx,
  };
}

export async function prepareCroppedTerrainData(terrainData) {
  const cropSize = terrainData?.exportCropSize;
  if (!cropSize) return terrainData;

  const origWidth  = terrainData.width;
  const origHeight = terrainData.height;

  // Center the crop
  const startX = Math.floor((origWidth  - cropSize) / 2);
  const startY = Math.floor((origHeight - cropSize) / 2);

  // Crop heightmap
  const croppedHeightMap = cropHeightmap(
    terrainData.heightMap, origWidth, origHeight, startX, startY, cropSize
  );

  // Recalculate min/max from cropped data
  let minHeight = Infinity, maxHeight = -Infinity;
  for (let i = 0; i < croppedHeightMap.length; i++) {
    const h = croppedHeightMap[i];
    if (h < -10000) continue; // skip NO_DATA
    if (h < minHeight) minHeight = h;
    if (h > maxHeight) maxHeight = h;
  }
  if (minHeight === Infinity) minHeight = terrainData.minHeight;
  if (maxHeight === -Infinity) maxHeight = terrainData.maxHeight;

  // Adjust geographic bounds
  const croppedBounds = adjustBounds(
    terrainData.bounds, origWidth, origHeight, startX, startY, cropSize
  );

  // Crop all texture URLs in parallel
  const urlFields = [
    'satelliteTextureUrl',
    'osmTextureUrl',
    'hybridTextureUrl',
    'segmentedTextureUrl',
    'segmentedHybridTextureUrl',
  ];
  const croppedUrls = {};
  await Promise.all(
    urlFields.map(async (field) => {
      const url = terrainData[field];
      if (url) {
        croppedUrls[field] = await cropTextureUrl(
          url, origWidth, origHeight, startX, startY, cropSize
        );
      }
    })
  );

  return {
    ...terrainData,
    width:     cropSize,
    height:    cropSize,
    heightMap: croppedHeightMap,
    minHeight,
    maxHeight,
    bounds:    croppedBounds,
    // exportCropSize cleared so downstream doesn't try to crop again
    exportCropSize: null,
    ...croppedUrls,
    // Canvas refs are invalidated after crop; clear them
    hybridTextureCanvas: null,
  };
}
