import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { SPONSORED_LABEL } from '../constants/monetization'
import {
  boundsFromPlaces,
  BRNO_MAP_CENTER,
  BRNO_MAP_DEFAULT_ZOOM,
  BRNO_MAP_MAX_BOUNDS,
  placesFingerprint,
  placesForMap,
} from '../utils/mapPlaces'
import { resolveMapTileConfig } from '../utils/mapTiles'
import { ensureMaplibreWorker } from '../utils/maplibreWorker'
import { hasFiniteLatLon } from '../utils/geo'

function assetUrl(value) {
  if (typeof value === 'string' && value) return value
  if (value && typeof value === 'object' && typeof value.default === 'string') return value.default
  return ''
}

const placeIcon = L.icon({
  iconUrl: assetUrl(markerIcon) || markerIcon,
  iconRetinaUrl: assetUrl(markerIcon2x) || markerIcon2x,
  shadowUrl: assetUrl(markerShadow) || markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
})

// Vite bundluje ikony; default Leaflet cesty by v production selhaly.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: placeIcon.options.iconRetinaUrl,
  iconUrl: placeIcon.options.iconUrl,
  shadowUrl: placeIcon.options.shadowUrl,
})

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function popupHtml(place) {
  const badge = place.sponsored
    ? `<p class="map-popup-sponsored">${escapeHtml(SPONSORED_LABEL)}</p>`
    : ''
  const address = place.address ? `<p class="map-popup-address">${escapeHtml(place.address)}</p>` : ''
  const price =
    place.priceLabel
      ? `<p class="map-popup-price">${escapeHtml(place.priceLabel)}${
          place.priceStatus ? ` · ${escapeHtml(place.priceStatus)}` : ''
        }</p>`
      : ''
  return `
    <div class="map-popup">
      ${badge}
      <strong class="map-popup-title">${escapeHtml(place.name)}</strong>
      ${address}
      ${price}
      <a class="map-popup-link" href="/restaurant/${encodeURIComponent(place.id)}">Otevřít detail</a>
    </div>
  `
}

const sponsoredIcon = L.divIcon({
  className: 'fg-map-marker fg-map-marker--sponsored',
  html: `<span class="fg-map-marker-pin" aria-hidden="true"></span>`,
  iconSize: [28, 36],
  iconAnchor: [14, 34],
  popupAnchor: [0, -28],
})

async function addBasemap(map, tiles) {
  if (tiles.mode === 'vector-style') {
    ensureMaplibreWorker()
    const { maplibreGL } = await import('@maplibre/maplibre-gl-leaflet')
    if (tiles.attribution) {
      map.attributionControl?.addAttribution(tiles.attribution)
    }
    const layer = maplibreGL({
      style: tiles.styleUrl,
      interactive: false,
    })
    layer.addTo(map)
    // Skryj POI symboly z podkladu — jinak se pletou s našimi značkami podniků.
    const hidePoi = () => {
      const gl = typeof layer.getMaplibreMap === 'function' ? layer.getMaplibreMap() : null
      if (!gl?.getStyle) return
      const style = gl.getStyle()
      for (const lyr of style?.layers || []) {
        if (lyr.type !== 'symbol') continue
        const id = String(lyr.id || '')
        if (/poi|place_label|housenumber|transit/i.test(id)) {
          try {
            gl.setLayoutProperty(id, 'visibility', 'none')
          } catch {
            /* vrstva nemusí existovat */
          }
        }
      }
    }
    const glMap = typeof layer.getMaplibreMap === 'function' ? layer.getMaplibreMap() : null
    if (glMap) {
      if (glMap.isStyleLoaded?.()) hidePoi()
      else glMap.once?.('load', hidePoi)
      glMap.on?.('styledata', hidePoi)
    }
    return layer
  }

  return L.tileLayer(tiles.url, {
    attribution: tiles.attribution,
    subdomains: tiles.subdomains || 'abcd',
    maxZoom: 19,
  }).addTo(map)
}

export default function RestaurantMap({ restaurants = [], selectedId = '', onSelect, userOrigin = null }) {
  const mapId = useId().replace(/:/g, '')
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const clusterRef = useRef(null)
  const markersRef = useRef(new Map())
  const userLayerRef = useRef(null)
  const fittedFingerprintRef = useRef('')
  const [ready, setReady] = useState(false)
  const [basemapError, setBasemapError] = useState('')
  const places = useMemo(() => placesForMap(restaurants), [restaurants])
  const fingerprint = useMemo(() => placesFingerprint(places), [places])

  const fitAllPlaces = () => {
    const map = mapRef.current
    if (!map) return
    const bounds = boundsFromPlaces(places)
    if (bounds) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 })
    } else {
      map.setView([BRNO_MAP_CENTER.lat, BRNO_MAP_CENTER.lon], BRNO_MAP_DEFAULT_ZOOM)
    }
    fittedFingerprintRef.current = fingerprint
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined
    let cancelled = false
    const map = L.map(containerRef.current, {
      center: [BRNO_MAP_CENTER.lat, BRNO_MAP_CENTER.lon],
      zoom: BRNO_MAP_DEFAULT_ZOOM,
      minZoom: 10,
      // MapLibre GL Leaflet vyžaduje maxZoom na L.map (jinak: "Map has no maxZoom specified").
      maxZoom: 19,
      maxBounds: BRNO_MAP_MAX_BOUNDS,
      maxBoundsViscosity: 0.65,
      scrollWheelZoom: true,
      attributionControl: true,
    })
    mapRef.current = map

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17,
    })
    map.addLayer(cluster)
    clusterRef.current = cluster

    const tiles = resolveMapTileConfig()
    addBasemap(map, tiles)
      .then(() => {
        if (cancelled) return
        setBasemapError('')
        setReady(true)
        requestAnimationFrame(() => map.invalidateSize())
      })
      .catch((error) => {
        if (cancelled) return
        console.error('FoodGo map basemap', error)
        setBasemapError('Podklad mapy se nepodařilo načíst. Značky podniků zůstávají.')
        setReady(true)
        requestAnimationFrame(() => map.invalidateSize())
      })

    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)
    const ro =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            map.invalidateSize()
          })
        : null
    if (ro && containerRef.current) ro.observe(containerRef.current)

    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
      map.remove()
      mapRef.current = null
      clusterRef.current = null
      markersRef.current = new Map()
      userLayerRef.current = null
      fittedFingerprintRef.current = ''
      setReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const cluster = clusterRef.current
    if (!map || !cluster || !ready) return

    cluster.clearLayers()
    markersRef.current = new Map()

    for (const place of places) {
      const marker = L.marker([place.lat, place.lon], {
        title: place.name,
        riseOnHover: true,
        icon: place.sponsored ? sponsoredIcon : placeIcon,
      })
      marker.bindPopup(popupHtml(place), { maxWidth: 260 })
      marker.on('click', () => {
        onSelect?.(place.id)
      })
      cluster.addLayer(marker)
      markersRef.current.set(place.id, marker)
    }

    // FitBounds jen při změně množiny bodů — ne při každém re-renderu / psaní do hledání se stejným výsledkem.
    if (fittedFingerprintRef.current !== fingerprint) {
      const bounds = boundsFromPlaces(places)
      if (bounds) {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 })
      } else {
        map.setView([BRNO_MAP_CENTER.lat, BRNO_MAP_CENTER.lon], BRNO_MAP_DEFAULT_ZOOM)
      }
      fittedFingerprintRef.current = fingerprint
    }
    requestAnimationFrame(() => map.invalidateSize())
  }, [places, fingerprint, ready, onSelect])

  useEffect(() => {
    if (!selectedId || !ready) return
    const marker = markersRef.current.get(selectedId)
    if (!marker || !mapRef.current) return
    const latLng = marker.getLatLng()
    mapRef.current.setView(latLng, Math.max(mapRef.current.getZoom(), 15), { animate: true })
    marker.openPopup()
  }, [selectedId, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    if (userLayerRef.current) {
      map.removeLayer(userLayerRef.current)
      userLayerRef.current = null
    }

    if (!hasFiniteLatLon(userOrigin?.lat, userOrigin?.lon)) return

    const group = L.layerGroup()
    const accuracy =
      typeof userOrigin.accuracy === 'number' && Number.isFinite(userOrigin.accuracy)
        ? Math.min(Math.max(userOrigin.accuracy, 40), 400)
        : 80
    L.circle([userOrigin.lat, userOrigin.lon], {
      radius: accuracy,
      color: '#1d6b4f',
      weight: 1,
      fillColor: '#2f9e73',
      fillOpacity: 0.15,
      interactive: false,
      className: 'fg-user-location-accuracy',
    }).addTo(group)
    L.circleMarker([userOrigin.lat, userOrigin.lon], {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: '#1d6b4f',
      fillOpacity: 1,
      className: 'fg-user-location',
      title: 'Tvoje poloha',
    }).addTo(group)
    group.addTo(map)
    userLayerRef.current = group
  }, [userOrigin, ready])

  return (
    <section className="restaurant-map" aria-label="Mapa restaurací v Brně">
      <div className="restaurant-map-toolbar">
        <p className="restaurant-map-count">
          {places.length === 0
            ? 'Žádný podnik s platnými souřadnicemi v aktuálních filtrech.'
            : `${places.length} ${places.length === 1 ? 'bod' : places.length < 5 ? 'body' : 'bodů'} na mapě`}
        </p>
        <p className="restaurant-map-hint">
          Klikni na bod pro kartu. Filtry a hledání řídí stejný seznam jako výpis. Podklad OpenFreeMap — bez API
          klíče.
        </p>
        {places.length > 0 ? (
          <button type="button" className="btn btn-secondary restaurant-map-fit" onClick={fitAllPlaces}>
            Zobrazit všechny body
          </button>
        ) : null}
        {basemapError ? (
          <p className="restaurant-map-hint" role="status">
            {basemapError}
          </p>
        ) : null}
      </div>
      <div
        id={`map-${mapId}`}
        ref={containerRef}
        className="restaurant-map-canvas"
        role="application"
        aria-label="Interaktivní mapa Brna"
      />
      {places.length === 0 ? (
        <p className="restaurant-map-empty" role="status">
          Zkus uvolnit filtry, nebo přepni zpět na seznam.{' '}
          <Link to="/results">Otevřít výsledky</Link>
        </p>
      ) : null}
    </section>
  )
}
