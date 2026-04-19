const _cache = new Map();

// Paris intramuros (périphérique) approximate bounding box
const PARIS_INTRAMUROS = { minLat: 48.815, maxLat: 48.902, minLng: 2.224, maxLng: 2.416 };

const isParisIntramuros = (lat, lng) =>
  lat >= PARIS_INTRAMUROS.minLat && lat <= PARIS_INTRAMUROS.maxLat &&
  lng >= PARIS_INTRAMUROS.minLng && lng <= PARIS_INTRAMUROS.maxLng;

const REGION_PATTERNS = [
  [/île-de-france|paris/i,                                  'ile_de_france'],
  [/normandie/i,                                            'normandie'],
  [/grand[ -]est|alsace|bas-rhin|haut-rhin/i,               'alsace'],
  [/bretagne/i,                                             'bretagne'],
  [/provence|côte.d.azur|alpes-maritimes|var\b|bouches/i,   'paca'],
];

export async function detectFrenchRegion(bounds) {
  const lat = (bounds.north + bounds.south) / 2;
  const lng  = (bounds.east  + bounds.west)  / 2;
  const key  = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (_cache.has(key)) return _cache.get(key);

  if (isParisIntramuros(lat, lng)) {
    _cache.set(key, 'paris_intramuros');
    return 'paris_intramuros';
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=6`,
      { headers: { 'Accept-Language': 'fr' } }
    );
    const { address } = await res.json();
    const haystack = [address.state, address.region, address.county].filter(Boolean).join(' ');
    const match  = REGION_PATTERNS.find(([re]) => re.test(haystack));
    const region = match ? match[1] : 'generic_france';
    _cache.set(key, region);
    return region;
  } catch {
    return 'generic_france';
  }
}
