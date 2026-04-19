// ─────────────────────────────────────────────────────────────────────────────
// REGION_PROFILES — configurable style mix per French region.
// Weights must sum to 1.0.
// ─────────────────────────────────────────────────────────────────────────────
export const REGION_PROFILES = {
  paris_intramuros: {
    styles: [
      { id: 'haussmannien', weight: 0.65 },
      { id: 'art_deco',     weight: 0.15 },
      { id: 'classique',    weight: 0.12 },
      { id: 'moderne',      weight: 0.08 },
    ],
    // Tout en zinc/ardoise, signature parisienne
    roofColors: {
      classique:  [0x5a646a, 0x4a5460, 0x3e484e, 0x6a747a],
      art_deco:   [0x3c3c38, 0x2e2e2c, 0x484840],
      moderne:    [0x4a5460, 0x3e484e, 0x585e66],
    },
  },
  ile_de_france: {
    styles: [
      { id: 'classique',    weight: 0.28 },
      { id: 'annees60',     weight: 0.28 },
      { id: 'moderne',      weight: 0.18 },
      { id: 'contemporain', weight: 0.14 },
      { id: 'art_deco',     weight: 0.12 },
    ],
    // Ardoise sombre, héritage parisien dilué
    roofColors: {
      classique:    [0x545e62, 0x46505a, 0x606870],
      art_deco:     [0x3c3c38, 0x2e2e2c, 0x484840],
      moderne:      [0x484840, 0x3a3a38, 0x545450],
      contemporain: [0xb0b8c0, 0xa8b0b8, 0xbcc4cc],
      annees60:     [0x3a3a38, 0x2e2e2c, 0x484840],
    },
  },
  normandie: {
    styles: [
      { id: 'normand',   weight: 0.45 },
      { id: 'classique', weight: 0.25 },
      { id: 'medieval',  weight: 0.15 },
      { id: 'moderne',   weight: 0.15 },
    ],
    // Ardoise normande (gris foncé chaud) + tuiles rouges
    roofColors: {
      classique: [0x45484a, 0x3c3e40, 0x7a3030, 0x6a2828, 0x52484a],
      moderne:   [0x45484a, 0x3c3e40, 0x404244],
      medieval:  [0x7a3030, 0x6a2828, 0x8a3838],
    },
  },
  alsace: {
    styles: [
      { id: 'alsacien',  weight: 0.50 },
      { id: 'classique', weight: 0.20 },
      { id: 'medieval',  weight: 0.15 },
      { id: 'moderne',   weight: 0.15 },
    ],
    // Tuiles rouges omniprésentes en Alsace
    roofColors: {
      classique: [0xa03828, 0x8a3020, 0xb04030, 0x903020],
      moderne:   [0x983020, 0x883020, 0xa03828],
      medieval:  [0xa03828, 0x8a3020, 0x903020],
    },
  },
  bretagne: {
    styles: [
      { id: 'breton',    weight: 0.45 },
      { id: 'classique', weight: 0.20 },
      { id: 'medieval',  weight: 0.20 },
      { id: 'moderne',   weight: 0.15 },
    ],
    // Ardoise gris bleuté, caractéristique bretonne
    roofColors: {
      classique: [0x3a3e45, 0x454950, 0x2e3238, 0x40444a],
      moderne:   [0x3a3e45, 0x454950, 0x40444a],
      medieval:  [0x3a3e45, 0x2e3238, 0x404448],
    },
  },
  paca: {
    styles: [
      { id: 'provencal',    weight: 0.45 },
      { id: 'classique',    weight: 0.25 },
      { id: 'contemporain', weight: 0.15 },
      { id: 'moderne',      weight: 0.15 },
    ],
    // Tuiles canal orangées partout, membrane blanche pour le contemporain
    roofColors: {
      classique:    [0xc06030, 0xb05828, 0xd07040, 0xb86838, 0xc87848],
      moderne:      [0xb85e30, 0xa85828, 0xc06030],
      contemporain: [0xd8d0c8, 0xc8c0b8, 0xe0d8d0],
    },
  },
  generic_france: {
    styles: [
      { id: 'classique',    weight: 0.35 },
      { id: 'annees60',     weight: 0.22 },
      { id: 'moderne',      weight: 0.20 },
      { id: 'contemporain', weight: 0.13 },
      { id: 'annees80',     weight: 0.10 },
    ],
    // Ardoise moyenne + tuiles selon les quartiers
    roofColors: {
      classique:    [0x58626a, 0x4a5460, 0x78503a, 0x6a4430, 0x505a60],
      moderne:      [0x484840, 0x3c3c38, 0x545450],
      contemporain: [0xb8c0c8, 0xaab2ba, 0xc0c8d0],
      annees60:     [0x3a3a38, 0x2e2e2c, 0x484840],
      annees80:     [0x505050, 0x444444, 0x5c5c5c],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLE_DEFS — per-style: canvas draw fn, facade tile dimensions,
//              material params, wall color palettes, and 3-D relief config.
//
// Canvas draw functions receive (ctx, W, H, PPM) where PPM = pixels per meter.
// ─────────────────────────────────────────────────────────────────────────────
export const STYLE_DEFS = {

  // ── Haussmannien ─────────────────────────────────────────────────────────
  haussmannien: {
    floorW: 3.5, floorH: 3.5,
    roughness: 0.65, normalStrength: 8.0,
    wallColors: ['#e6decb', '#ded8c5', '#eae2cf'],
    hasShop: true,
    roof: { shape: 'mansard', colors: [0x6c767e, 0x58626a, 0x7b858f, 0x4a545c, 0x606a73] },
    relief: {
      hasCornicheTop: true, cornicheDepth: 0.6, cornicheHeight: 0.5,
      hasCornicheGround: true,
      balconyFloors: [1, 'last'], balconyEveryFloor: false,
      balconyType: 'fer_forge', balconySlabDepth: 0.8,
      hasTimberFrame: false,
      hasFloorBands: true, hasCornerPillars: true,
    },
    draw(ctx, W, H, PPM) {
      // Pierre de taille
      ctx.fillStyle = '#e6decb'; ctx.fillRect(0, 0, W, H);
      // Joints de pierres
      ctx.fillStyle = '#d1c8b4';
      for (let y = 0; y < H; y += PPM * 0.6 | 0) ctx.fillRect(0, y, W, 2);
      for (let x = 0; x < W; x += W / 2 | 0)     ctx.fillRect(x, 0, 2, H);
      // Corniche supérieure
      ctx.fillStyle = '#f2ece1'; ctx.fillRect(0, H - PPM * 0.3, W, PPM * 0.3);
      ctx.fillStyle = '#a8a090'; ctx.fillRect(0, H - PPM * 0.3, W, 2);
      // Porte-fenêtre
      const wW = PPM * 1.6 | 0, wH = PPM * 2.6 | 0,
        wx = (W - wW) / 2 | 0, wy = PPM * 0.3 | 0;
      ctx.fillStyle = '#f5efe6';
      ctx.fillRect(wx - PPM * 0.2, wy - PPM * 0.2, wW + PPM * 0.4, wH + PPM * 0.2);
      ctx.fillStyle = '#b8b0a1';
      ctx.fillRect(wx - PPM * 0.2, wy - PPM * 0.2, wW + PPM * 0.4, 2);
      ctx.fillRect(wx - PPM * 0.2, wy - PPM * 0.2, 2, wH + PPM * 0.2);
      ctx.fillStyle = '#fcfcfc'; ctx.fillRect(wx - 4, wy - 4, wW + 8, wH + 4);
      ctx.fillStyle = '#212529'; ctx.fillRect(wx, wy, wW, wH);
      ctx.fillStyle = '#fcfcfc';
      ctx.fillRect(wx + wW / 2 - 2, wy, 4, wH);
      for (let i = 1; i <= 4; i++) ctx.fillRect(wx, wy + (wH / 5) * i - 2, wW, 4);
      // Consoles et rebord de balcon
      const balFloor = wy + wH;
      ctx.fillStyle = '#b5b0a6';
      ctx.fillRect(wx - PPM * 0.2, balFloor, PPM * 0.3, PPM * 0.5);
      ctx.fillRect(wx + wW - PPM * 0.1, balFloor, PPM * 0.3, PPM * 0.5);
      ctx.fillStyle = '#dcd4c6';
      ctx.fillRect(wx - PPM * 0.3, balFloor, wW + PPM * 0.6, PPM * 0.1);
      ctx.fillStyle = '#8a857d';
      ctx.fillRect(wx - PPM * 0.3, balFloor + PPM * 0.1, wW + PPM * 0.6, 2);
    },
  },

  // ── Classique bourgeois ───────────────────────────────────────────────────
  classique: {
    floorW: 4.0, floorH: 3.5,
    roughness: 0.68, normalStrength: 5.0,
    wallColors: ['#d8d2c2', '#d4ceba', '#ddd8c8'],
    hasShop: true,
    roof: { shape: 'mansard', colors: [0x5a646a, 0x4a5460, 0x3e484e, 0x6a747a] },
    relief: {
      hasCornicheTop: true, cornicheDepth: 0.4, cornicheHeight: 0.4,
      hasCornicheGround: true,
      balconyFloors: [1], balconyEveryFloor: false,
      balconyType: 'beton', balconySlabDepth: 0.6,
      hasTimberFrame: false,
      hasFloorBands: true, hasCornerPillars: true,
    },
    draw(ctx, W, H, PPM) {
      ctx.fillStyle = '#d6cfbd'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#c4bcab';
      for (let y = 0; y < H; y += PPM * 0.6 | 0) ctx.fillRect(0, y, W, 2);
      ctx.fillStyle = '#eae4d3'; ctx.fillRect(0, H - PPM * 0.3, W, PPM * 0.3);
      ctx.fillStyle = '#9e9787'; ctx.fillRect(0, H - PPM * 0.3, W, 2);
      const wW = PPM * 1.5 | 0, wH = PPM * 2.2 | 0,
        wx = (W - wW) / 2 | 0, wy = PPM * 0.5 | 0;
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(wx - 5, wy - 5, wW + 10, wH + 5);
      ctx.fillStyle = '#1a1f24'; ctx.fillRect(wx, wy, wW, wH);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(wx + wW / 2 - 2, wy, 4, wH);
      ctx.fillRect(wx, wy + wH / 2 - 2, wW, 4);
      ctx.fillStyle = '#a6a195';
      ctx.fillRect(wx - PPM * 0.2, wy + wH, wW + PPM * 0.4, PPM * 0.1);
    },
  },

  // ── Art Déco (années 1925-1940) ───────────────────────────────────────────
  art_deco: {
    floorW: 4.0, floorH: 3.8,
    roughness: 0.58, normalStrength: 7.0,
    wallColors: ['#e8e0d0', '#e2daca', '#ddd5c5', '#ece4d4'],
    hasShop: true,
    roof: { shape: 'flat', colors: [0x3c3c38, 0x2e2e2c, 0x484840, 0x424240] },
    relief: {
      hasCornicheTop: true, cornicheDepth: 0.5, cornicheHeight: 0.4,
      hasCornicheGround: true,
      balconyFloors: [2], balconyEveryFloor: false,
      balconyType: 'beton', balconySlabDepth: 0.5,
      hasTimberFrame: false,
      hasFloorBands: true, hasCornerPillars: false,
    },
    draw(ctx, W, H, PPM) {
      // Fond calcaire clair
      ctx.fillStyle = '#e8e0d0'; ctx.fillRect(0, 0, W, H);
      // Rayures verticales géométriques en retrait
      ctx.fillStyle = '#d8d0c0';
      const strW = PPM * 0.28 | 0, strStep = PPM * 0.7 | 0;
      for (let x = strStep; x < W; x += strStep) ctx.fillRect(x, 0, strW, H);
      // Bandeau doré en haut (corniche décorée)
      const bH = PPM * 0.22 | 0;
      ctx.fillStyle = '#c8a050'; ctx.fillRect(0, 0, W, bH);
      ctx.fillStyle = '#b89040'; ctx.fillRect(0, bH, W, 3);
      // Motifs géométriques dans le bandeau (dents de scie)
      ctx.fillStyle = '#d4b060';
      const toothW = PPM * 0.18 | 0;
      for (let x = 0; x < W; x += toothW * 2) ctx.fillRect(x, 2, toothW, bH - 4);
      // Bandeau bas
      ctx.fillStyle = '#c8a050'; ctx.fillRect(0, H - bH, W, bH);
      ctx.fillStyle = '#b89040'; ctx.fillRect(0, H - bH - 3, W, 3);
      // Fenêtre haute et étroite avec encadrement géométrique
      const wW = PPM * 1.25 | 0, wH = PPM * 2.3 | 0;
      const wx = (W - wW) / 2 | 0, wy = bH + PPM * 0.15 | 0;
      // Encadrement à gradins (effet 3D)
      ctx.fillStyle = '#d4c8a8'; ctx.fillRect(wx - 10, wy - 6, wW + 20, wH + 10);
      ctx.fillStyle = '#c8bca0'; ctx.fillRect(wx - 6, wy - 3, wW + 12, wH + 6);
      // Liseré doré sur l'encadrement
      ctx.fillStyle = '#c8a050';
      ctx.fillRect(wx - 10, wy - 6, wW + 20, 3);
      ctx.fillRect(wx - 10, wy + wH + 4, wW + 20, 3);
      // Vitrage
      ctx.fillStyle = '#101820'; ctx.fillRect(wx, wy, wW, wH);
      // Petits bois fins
      ctx.fillStyle = '#c8bca0';
      ctx.fillRect(wx + wW / 2 - 2, wy, 4, wH);
      for (let i = 1; i < 4; i++) ctx.fillRect(wx, wy + (wH / 4) * i - 1, wW, 2);
    },
  },

  // ── Années 60 (HLM / Brutalism) ───────────────────────────────────────────
  annees60: {
    floorW: 6.0, floorH: 2.7,
    roughness: 0.88, normalStrength: 6.5,
    wallColors: ['#c8c4be', '#c0bbb5', '#b8b3ad', '#d0ccc6'],
    hasShop: false,
    roof: { shape: 'flat', colors: [0x3a3a38, 0x2e2e2c, 0x484840, 0x323230] },
    relief: {
      hasCornicheTop: false, hasCornicheGround: false,
      balconyFloors: [], balconyEveryFloor: true,
      balconyType: 'beton', balconySlabDepth: 0.4,
      hasTimberFrame: false,
      hasFloorBands: true, hasCornerPillars: false,
    },
    draw(ctx, W, H, PPM) {
      // Béton brut grisâtre
      ctx.fillStyle = '#c8c4be'; ctx.fillRect(0, 0, W, H);
      // Texture coffrage : stries horizontales fines
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      const stripe = PPM * 0.07 | 0;
      for (let y = 0; y < H; y += stripe * 2) ctx.fillRect(0, y, W, stripe);
      // Traces de décoffrage verticales légères
      ctx.fillStyle = 'rgba(0,0,0,0.03)';
      for (let x = PPM * 0.4 | 0; x < W; x += PPM * 0.8 | 0) ctx.fillRect(x, 0, 2, H);
      // Bandeau plancher (dalle béton visible)
      ctx.fillStyle = '#a8a49e';
      ctx.fillRect(0, 0, W, PPM * 0.16 | 0);
      ctx.fillRect(0, H - PPM * 0.16 | 0, W, PPM * 0.16 | 0);
      // Fenêtre bandeau large et basse
      const wW = PPM * 3.2 | 0, wH = PPM * 1.1 | 0;
      const wx = (W - wW) / 2 | 0, wy = (H - wH) / 2 | 0;
      // Appui béton
      ctx.fillStyle = '#b0aca6'; ctx.fillRect(wx - 5, wy - 3, wW + 10, wH + 8);
      ctx.fillStyle = '#a0a09a'; ctx.fillRect(wx - 5, wy + wH + 3, wW + 10, 4);
      // Vitrage bleu-gris
      ctx.fillStyle = '#2a3540'; ctx.fillRect(wx, wy, wW, wH);
      // Menuiserie aluminium anodisé
      ctx.fillStyle = '#b8b5b0';
      ctx.fillRect(wx + (wW / 3 | 0) - 2, wy, 4, wH);
      ctx.fillRect(wx + (2 * wW / 3 | 0) - 2, wy, 4, wH);
      ctx.fillRect(wx, wy + wH / 2 - 1, wW, 2);
    },
  },

  // ── Années 80 (Postmoderne) ────────────────────────────────────────────────
  annees80: {
    floorW: 5.0, floorH: 2.85,
    roughness: 0.72, normalStrength: 3.5,
    wallColors: ['#e8cfc0', '#d8bfb0', '#e0c8b8', '#e4caba'],
    hasShop: false,
    roof: { shape: 'flat', colors: [0x505050, 0x444444, 0x5c5c5c, 0x383838] },
    relief: {
      hasCornicheTop: false, hasCornicheGround: false,
      balconyFloors: [], balconyEveryFloor: true,
      balconyType: 'beton', balconySlabDepth: 0.45,
      hasTimberFrame: false,
      hasFloorBands: false, hasCornerPillars: false,
    },
    draw(ctx, W, H, PPM) {
      // Enduit saumon / terra cotta
      ctx.fillStyle = '#e8cfc0'; ctx.fillRect(0, 0, W, H);
      // Liseré de couleur vive (typique postmoderne)
      const accent = '#b03828';
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, W, PPM * 0.1 | 0);
      ctx.fillRect(0, H - PPM * 0.1 | 0, W, PPM * 0.1 | 0);
      // Bow-window simulé : panneau central légèrement plus foncé avec angles
      const bwW = PPM * 2.0 | 0, bwH = PPM * 2.2 | 0;
      const bwX = (W - bwW) / 2 | 0, bwY = (H - bwH) / 2 | 0;
      // Joues latérales du bow-window
      ctx.fillStyle = '#d4bba8';
      ctx.beginPath();
      ctx.moveTo(bwX - (PPM * 0.25 | 0), bwY);
      ctx.lineTo(bwX, bwY);
      ctx.lineTo(bwX, bwY + bwH);
      ctx.lineTo(bwX - (PPM * 0.25 | 0), bwY + bwH);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bwX + bwW + (PPM * 0.25 | 0), bwY);
      ctx.lineTo(bwX + bwW, bwY);
      ctx.lineTo(bwX + bwW, bwY + bwH);
      ctx.lineTo(bwX + bwW + (PPM * 0.25 | 0), bwY + bwH);
      ctx.closePath(); ctx.fill();
      // Vitrage principal
      ctx.fillStyle = '#18283a'; ctx.fillRect(bwX, bwY, bwW, bwH);
      // Traverse
      ctx.fillStyle = '#d0b8a8'; ctx.fillRect(bwX, bwY + bwH / 2 - 2, bwW, 4);
      // Montants PVC blanc
      ctx.fillStyle = '#eae6e2';
      ctx.fillRect(bwX + bwW / 2 - 3, bwY, 6, bwH);
      // Appui de fenêtre carrelé (détail typique années 80)
      ctx.fillStyle = accent;
      ctx.fillRect(bwX - (PPM * 0.25 | 0), bwY + bwH, bwW + (PPM * 0.5 | 0), PPM * 0.08 | 0);
    },
  },

  // ── Contemporain (verre et acier, post-2000) ─────────────────────────────
  contemporain: {
    floorW: 6.0, floorH: 3.5,
    roughness: 0.12, normalStrength: 1.5,
    wallColors: ['#d8dde2', '#d0d5da', '#ccd1d6', '#dce1e6'],
    hasShop: true,
    roof: { shape: 'flat', colors: [0xb8c0c8, 0xaab2ba, 0xc8d0d8, 0xa0a8b0] },
    relief: {
      hasCornicheTop: false, hasCornicheGround: false,
      balconyFloors: [], balconyEveryFloor: false,
      balconyType: null, balconySlabDepth: 0,
      hasTimberFrame: false,
      hasFloorBands: false, hasCornerPillars: false,
    },
    draw(ctx, W, H, PPM) {
      // Fond aluminium brossé
      ctx.fillStyle = '#d0d5d8'; ctx.fillRect(0, 0, W, H);
      // Montants verticaux aluminium
      const panW = PPM * 1.6 | 0;
      ctx.fillStyle = '#b0b8be';
      for (let x = panW; x < W; x += panW) ctx.fillRect(x - 3, 0, 6, H);
      // Traverse centrale
      ctx.fillRect(0, H / 2 - 3, W, 6);
      // Panneaux : alternance verre sombre / panneau opaque
      const nPans = Math.max(1, Math.floor(W / panW));
      for (let i = 0; i < nPans; i++) {
        const px = i * panW + 5;
        const pw = panW - 10;
        if (pw < 4) continue;
        // Panneau supérieur vitré
        ctx.fillStyle = i % 3 === 1 ? '#1e2c3e' : '#243444';
        ctx.fillRect(px, 5, pw, H / 2 - 11);
        // Reflet diagonal caractéristique du double vitrage
        ctx.fillStyle = 'rgba(200,225,255,0.14)';
        ctx.beginPath();
        ctx.moveTo(px, 5);
        ctx.lineTo(px + pw * 0.45, 5);
        ctx.lineTo(px, H / 2 - 11);
        ctx.closePath(); ctx.fill();
        // Panneau inférieur (parfois opaque ou spandrel)
        ctx.fillStyle = i % 3 === 0 ? '#c8cdd0' : '#202e3c';
        ctx.fillRect(px, H / 2 + 5, pw, H / 2 - 10);
        if (i % 3 === 0) {
          // Panneau spandrel opaque (typique façade rideau)
          ctx.fillStyle = '#b8bec2'; ctx.fillRect(px + 2, H / 2 + 7, pw - 4, H / 2 - 14);
        }
      }
    },
  },

  // ── Médiéval (vieilles villes, XIII-XVe siècle) ──────────────────────────
  medieval: {
    floorW: 3.0, floorH: 3.2,
    roughness: 0.92, normalStrength: 10.0,
    wallColors: ['#c8b898', '#c0b090', '#bca888', '#c4b098'],
    hasShop: false,
    roof: { shape: 'hip', height: 4.0, colors: [0x8a4028, 0x783820, 0x9a4830, 0x703018] },
    relief: {
      hasCornicheTop: false, hasCornicheGround: false,
      balconyFloors: [], balconyEveryFloor: false,
      balconyType: null,
      hasTimberFrame: false,
      hasFloorBands: false, hasCornerPillars: false,
    },
    draw(ctx, W, H, PPM) {
      // Pierre de taille médiévale - appareillement irrégulier
      ctx.fillStyle = '#c8b898'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#a89878';
      // Assises de hauteurs variables
      let y = 0, row = 0;
      while (y < H) {
        const bH = (PPM * (0.28 + ((row * 11 + 3) % 5) * 0.06)) | 0;
        ctx.fillRect(0, y, W, 1); // joint horizontal
        let x = row % 2 === 0 ? 0 : (PPM * 0.22 | 0);
        while (x < W) {
          const bW = (PPM * (0.45 + ((x * 13 + row * 7) % 9) * 0.07)) | 0;
          ctx.fillRect(x, y, 1, bH); // joint vertical
          // Légères variations de teinte par bloc (pierre non uniforme)
          if ((x * 7 + row * 13) % 8 < 2) {
            ctx.fillStyle = 'rgba(0,0,0,0.04)';
            ctx.fillRect(x + 1, y + 1, bW - 2, bH - 2);
            ctx.fillStyle = '#a89878';
          }
          x += bW;
        }
        y += bH; row++;
      }
      // Petite fenêtre à arc en plein cintre
      const wW = PPM * 0.95 | 0, rectH = PPM * 0.85 | 0;
      const archR = wW / 2;
      const wx = (W - wW) / 2 | 0, wy = PPM * 0.3 | 0;
      // Encadrement pierre taillée plus claire
      ctx.fillStyle = '#ddd0b4';
      const archTopY = wy + archR;
      ctx.beginPath();
      ctx.arc(wx + wW / 2, archTopY, archR + 8, Math.PI, 0);
      ctx.lineTo(wx + wW + 8, archTopY + rectH + 6);
      ctx.lineTo(wx - 8, archTopY + rectH + 6);
      ctx.closePath(); ctx.fill();
      // Voussures (claveaux)
      ctx.fillStyle = '#c8ba9c';
      for (let a = 0; a <= 6; a++) {
        const angle = Math.PI + (a * Math.PI / 6);
        const r1 = archR + 4, r2 = archR + 8;
        if (a % 2 === 0) {
          ctx.beginPath();
          ctx.arc(wx + wW / 2, archTopY, r1, angle, angle + Math.PI / 6);
          ctx.arc(wx + wW / 2, archTopY, r2, angle + Math.PI / 6, angle, true);
          ctx.closePath(); ctx.fill();
        }
      }
      // Vitrage sombre
      ctx.fillStyle = '#0c1520';
      ctx.beginPath();
      ctx.arc(wx + wW / 2, archTopY, archR, Math.PI, 0);
      ctx.lineTo(wx + wW, archTopY + rectH);
      ctx.lineTo(wx, archTopY + rectH);
      ctx.closePath(); ctx.fill();
      // Meneau de pierre central
      ctx.fillStyle = '#ddd0b4';
      ctx.fillRect(wx + wW / 2 - 3, archTopY, 6, rectH);
    },
  },

  // ── Normand (colombages) ──────────────────────────────────────────────────
  normand: {
    floorW: 4.0, floorH: 3.0,
    roughness: 0.75, normalStrength: 4.0,
    wallColors: ['#f0ebe0', '#f2ede3', '#ece7dc'],
    hasShop: false,
    roof: { shape: 'hip', height: 3.5, colors: [0x45484a, 0x3c3e40, 0x7a3030, 0x6a2828, 0x52484a] },
    relief: {
      hasCornicheTop: false, hasCornicheGround: false,
      balconyFloors: [], balconyEveryFloor: false, balconyType: null,
      hasTimberFrame: true, timberColor: 0x4a3728,
      hasFloorBands: false, hasCornerPillars: false,
    },
    draw(ctx, W, H, PPM) {
      const bw = PPM * 0.12 | 0, tc = '#4a3728';
      ctx.fillStyle = '#f0ebe0'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = tc;
      ctx.fillRect(0, 0, W, bw);
      ctx.fillRect(0, H - bw, W, bw);
      ctx.fillRect(0, 0, bw, H);
      ctx.fillRect(W - bw, 0, bw, H);
      ctx.fillRect((W - bw) / 2 | 0, 0, bw, H);
      ctx.beginPath(); ctx.lineWidth = bw * 0.7; ctx.strokeStyle = tc;
      ctx.moveTo(bw, bw); ctx.lineTo((W - bw) / 2, H - bw);
      ctx.moveTo((W - bw) / 2, bw); ctx.lineTo(bw, H - bw);
      ctx.moveTo((W - bw) / 2 + bw, bw); ctx.lineTo(W - bw, H - bw);
      ctx.moveTo(W - bw, bw); ctx.lineTo((W - bw) / 2 + bw, H - bw);
      ctx.stroke();
      const wW = PPM * 1.1 | 0, wH = PPM * 1.5 | 0,
        wx = (W - wW) / 2 | 0, wy = (H - wH) / 2 | 0;
      ctx.fillStyle = '#e0d8c8'; ctx.fillRect(wx - 6, wy - 6, wW + 12, wH + 12);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(wx - 3, wy - 3, wW + 6, wH + 6);
      ctx.fillStyle = '#1a2530'; ctx.fillRect(wx, wy, wW, wH);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(wx + wW / 2 - 2, wy, 4, wH);
      ctx.fillRect(wx, wy + wH / 2 - 2, wW, 4);
    },
  },

  // ── Alsacien (colombages colorés) ─────────────────────────────────────────
  alsacien: {
    floorW: 4.0, floorH: 3.0,
    roughness: 0.70, normalStrength: 3.5,
    wallColors: ['#f1efd7ff', '#f0c090', '#c8dc98', '#f5e8b8'],
    hasShop: false,
    roof: { shape: 'hip', height: 4.5, colors: [0xa03828, 0x8a3020, 0xb04030, 0x903020, 0xb83828] },
    relief: {
      hasCornicheTop: false, hasCornicheGround: false,
      balconyFloors: [], balconyEveryFloor: false, balconyType: null,
      hasTimberFrame: true, timberColor: 0x5c3d1e,
      hasFloorBands: false, hasCornerPillars: false,
    },
    draw(ctx, W, H, PPM) {
      const bw = PPM * 0.14 | 0, tc = '#5c3d1e';
      ctx.fillStyle = '#f1efd7ff'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = tc;
      ctx.fillRect(0, 0, W, bw);
      ctx.fillRect(0, H - bw, W, bw);
      ctx.fillRect(0, 0, bw, H);
      ctx.fillRect(W - bw, 0, bw, H);
      ctx.fillRect((W / 3) | 0, 0, bw, H);
      ctx.fillRect((2 * W / 3) | 0, 0, bw, H);
      ctx.beginPath(); ctx.lineWidth = bw * 0.65; ctx.strokeStyle = tc;
      ctx.moveTo(bw, bw); ctx.lineTo((W / 3) | 0, H - bw);
      ctx.moveTo((W / 3) | 0, bw); ctx.lineTo(bw, H - bw);
      ctx.stroke();
      const wW = PPM * 1.0 | 0, wH = PPM * 1.4 | 0,
        wx = (W - wW) / 2 | 0, wy = (H - wH) / 2 | 0;
      ctx.fillStyle = '#6b4c30'; ctx.fillRect(wx - 5, wy - 5, wW + 10, wH + 10);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(wx - 2, wy - 2, wW + 4, wH + 4);
      ctx.fillStyle = '#182030'; ctx.fillRect(wx, wy, wW, wH);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(wx + wW / 2 - 2, wy, 4, wH);
      ctx.fillRect(wx, wy + wH / 2 - 2, wW, 4);
    },
  },

  // ── Breton (granit) ───────────────────────────────────────────────────────
  breton: {
    floorW: 4.0, floorH: 3.0,
    roughness: 0.85, normalStrength: 7.0,
    wallColors: ['#9a9590', '#908a85', '#9e9893', '#a5a09b'],
    hasShop: false,
    roof: { shape: 'hip', height: 3.0, colors: [0x3a3e45, 0x454950, 0x2e3238, 0x40444a] },
    relief: {
      hasCornicheTop: false, hasCornicheGround: false,
      balconyFloors: [], balconyEveryFloor: false, balconyType: null,
      hasTimberFrame: false,
      hasFloorBands: false, hasCornerPillars: false,
    },
    draw(ctx, W, H, PPM) {
      ctx.fillStyle = '#9a9590'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#7a7570';
      const bH = PPM * 0.45 | 0;
      for (let y = 0; y < H; y += bH) {
        ctx.fillRect(0, y, W, 1);
        const off = (Math.floor(y / bH) % 2 === 0) ? 0 : PPM * 0.45 | 0;
        for (let x = off; x < W; x += PPM * 0.9 | 0) ctx.fillRect(x, y, 1, bH);
      }
      const wW = PPM * 1.0 | 0, wH = PPM * 1.5 | 0,
        wx = (W - wW) / 2 | 0, wy = (H - wH) / 2 | 0;
      ctx.fillStyle = '#b0aaa5'; ctx.fillRect(wx - 6, wy - 6, wW + 12, wH + 12);
      ctx.fillStyle = '#7a7570';
      ctx.fillRect(wx - 6, wy - 6, wW + 12, 2);
      ctx.fillRect(wx - 6, wy - 6, 2, wH + 12);
      ctx.fillRect(wx + wW + 4, wy - 6, 2, wH + 12);
      ctx.fillRect(wx - 6, wy + wH + 4, wW + 12, 2);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(wx, wy, wW, wH);
      ctx.fillStyle = '#b0aaa5';
      ctx.fillRect(wx + wW / 2 - 2, wy, 4, wH);
    },
  },

  // ── Provençal (crépi + volets) ────────────────────────────────────────────
  provencal: {
    floorW: 4.5, floorH: 3.0,
    roughness: 0.80, normalStrength: 5.5,
    wallColors: ['#e8c87a', '#e8b090', '#f0d8a0', '#e8a888', '#f5d890'],
    hasShop: false,
    roof: { shape: 'hip', height: 2.0, colors: [0xc06030, 0xb05828, 0xd07040, 0xb86838, 0xc87848] },
    relief: {
      hasCornicheTop: false, hasCornicheGround: false,
      balconyFloors: [], balconyEveryFloor: false, balconyType: null,
      hasTimberFrame: false,
      hasFloorBands: false, hasCornerPillars: false,
    },
    draw(ctx, W, H, PPM) {
      ctx.fillStyle = '#e8c87a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      for (let y = 0; y < H; y += 5) {
        for (let x = 0; x < W; x += 5) {
          if ((x * 7 + y * 13) % 12 < 2) ctx.fillRect(x, y, 3, 2);
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      for (let y = 2; y < H; y += 7) {
        for (let x = 3; x < W; x += 7) {
          if ((x * 11 + y * 5) % 10 < 2) ctx.fillRect(x, y, 4, 3);
        }
      }
      const wW = PPM * 1.1 | 0, wH = PPM * 1.6 | 0,
        wx = (W - wW) / 2 | 0, wy = (H - wH) / 2 | 0;
      ctx.fillStyle = '#c8a860';
      ctx.fillRect(wx - 8, wy - 12, wW + 16, 6);
      ctx.fillStyle = '#d4b070'; ctx.fillRect(wx - 5, wy - 5, wW + 10, wH + 10);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(wx, wy, wW, wH);
      const sW = wW * 0.55 | 0, sH = wH + 10;
      ctx.fillStyle = '#2d6a2d';
      ctx.fillRect(wx - sW - 3, wy - 5, sW, sH);
      ctx.fillRect(wx + wW + 3, wy - 5, sW, sH);
      ctx.fillStyle = '#245a24';
      for (let i = 1; i < 5; i++) {
        const ly = wy - 5 + (sH / 5) * i;
        ctx.fillRect(wx - sW - 3, ly, sW, 1);
        ctx.fillRect(wx + wW + 3, ly, sW, 1);
      }
    },
  },

  // ── Moderne générique ─────────────────────────────────────────────────────
  moderne: {
    floorW: 5.0, floorH: 3.0,
    roughness: 0.50, normalStrength: 2.0,
    wallColors: ['#d0ccca', '#d4d0cc', '#c8c4c0', '#ccc8c4'],
    hasShop: true,
    roof: { shape: 'flat', colors: [0x484840, 0x3c3c38, 0x545450, 0x3e3e3c] },
    relief: {
      hasCornicheTop: false, hasCornicheGround: false,
      balconyFloors: [], balconyEveryFloor: true,
      balconyType: 'beton', balconySlabDepth: 0.5,
      hasTimberFrame: false,
      hasFloorBands: false, hasCornerPillars: false,
    },
    draw(ctx, W, H, PPM) {
      ctx.fillStyle = '#d0ccca'; ctx.fillRect(0, 0, W, H);
      const wW = PPM * 2.4 | 0, wH = PPM * 1.3 | 0,
        wx = (W - wW) / 2 | 0, wy = (H - wH) / 2 - (PPM * 0.2 | 0);
      ctx.fillStyle = '#b8b4b0'; ctx.fillRect(wx - 4, wy - 4, wW + 8, wH + 8);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(wx, wy, wW, wH);
      ctx.fillStyle = '#b8b4b0';
      ctx.fillRect(wx + (wW / 3 | 0) - 2, wy, 4, wH);
      ctx.fillRect(wx + (2 * wW / 3 | 0) - 2, wy, 4, wH);
      ctx.fillRect(wx, wy + wH / 2 - 1, wW, 2);
    },
  },
};
