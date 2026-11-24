/**
 * Ručně ověřené souřadnice z OpenStreetMap (ODbL).
 * Nevznikají regenerací `npm run data:coordinates` z dumpů, které podnik
 * nespárovaly. Přepisují chybějící body v placeCoordinates.
 *
 * osm-poi = pojmenovaný objekt OSM
 * osm-address = adresa z katalogu nalezená v OSM (bez jména podniku)
 */
export const coordinateOverrides = Object.freeze({
  'cukrarna-vetrnik-lidicka': Object.freeze({
    lat: 49.2032489,
    lon: 16.607232,
    coordSource: 'osm-poi',
    osmName: 'Větrník',
    osmId: 'node/1489453228',
  }),
  'cukrarstvi-martinak': Object.freeze({
    lat: 49.1995832,
    lon: 16.6023833,
    coordSource: 'osm-poi',
    osmName: 'Cukrářství Martinák',
    osmId: 'node/3157685888',
  }),
  'mamas-burger': Object.freeze({
    lat: 49.2035436,
    lon: 16.6308415,
    coordSource: 'osm-address',
    osmName: '',
    note: 'OSM adresa Lazaretní 1/7 (katalog + web mamasburgerbrno.cz). Pojmenovaný POI Mama’s Burger v OSM chybí.',
  }),
  'chicken-inn-svobody': Object.freeze({
    lat: 49.1955443,
    lon: 16.6074637,
    coordSource: 'osm-address',
    osmName: '',
    note: 'OSM adresa náměstí Svobody 97/3. Pojmenovaný POI Chicken Inn v OSM/Nominatim nenalezen — poloha budovy, provoz ověřit ručně.',
  }),
})
