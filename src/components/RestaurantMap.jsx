import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { SPONSORED_LABEL } from '../constants/monetization'
import { boundsFromPlaces, BRNO_MAP_CENTER, BRNO_MAP_DEFAULT_ZOOM, placesForMap } from '../utils/mapPlaces'
import { resolveMapTileConfig } from '../utils/mapTiles'

// Vite bundluje ikony; default Leaflet cesty by v production selhaly.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
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
  return `
    <div class="map-popup">
      ${badge}
      <strong class="map-popup-title">${escapeHtml(place.name)}</strong>
      ${address}
      <a class="map-popup-link" href="/restaurant/${encodeURIComponent(place.id)}">Otevřít detail</a>
    </div>
  `
}

export default function RestaurantMap({ restaurants = [], selectedId = '', onSelect }) {
  const mapId = useId().replace(/:/g, '')
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const clusterRef = useRef(null)
  const markersRef = useRef(new Map())
  const [ready, setReady] = useState(false)
  const places = useMemo(() => placesForMap(restaurants), [restaurants])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined
    const tiles = resolveMapTileConfig()
    const map = L.map(containerRef.current, {
      center: [BRNO_MAP_CENTER.lat, BRNO_MAP_CENTER.lon],
      zoom: BRNO_MAP_DEFAULT_ZOOM,
      scrollWheelZoom: true,
      attributionControl: true,
    })
    L.tileLayer(tiles.url, {
      attribution: tiles.attribution,
      subdomains: tiles.subdomains,
      maxZoom: 19,
    }).addTo(map)

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17,
    })
    map.addLayer(cluster)
    mapRef.current = map
    clusterRef.current = cluster
    setReady(true)

    return () => {
      map.remove()
      mapRef.current = null
      clusterRef.current = null
      markersRef.current = new Map()
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
      })
      marker.bindPopup(popupHtml(place), { maxWidth: 260 })
      marker.on('click', () => {
        onSelect?.(place.id)
      })
      cluster.addLayer(marker)
      markersRef.current.set(place.id, marker)
    }

    const bounds = boundsFromPlaces(places)
    if (bounds) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 })
    } else {
      map.setView([BRNO_MAP_CENTER.lat, BRNO_MAP_CENTER.lon], BRNO_MAP_DEFAULT_ZOOM)
    }
  }, [places, ready, onSelect])

  useEffect(() => {
    if (!selectedId || !ready) return
    const marker = markersRef.current.get(selectedId)
    if (!marker || !mapRef.current) return
    const latLng = marker.getLatLng()
    mapRef.current.setView(latLng, Math.max(mapRef.current.getZoom(), 15), { animate: true })
    marker.openPopup()
  }, [selectedId, ready])

  return (
    <section className="restaurant-map" aria-label="Mapa restaurací v Brně">
      <div className="restaurant-map-toolbar">
        <p className="restaurant-map-count">
          {places.length === 0
            ? 'Žádný podnik s platnými souřadnicemi v aktuálních filtrech.'
            : `${places.length} ${places.length === 1 ? 'bod' : places.length < 5 ? 'body' : 'bodů'} na mapě`}
        </p>
        <p className="restaurant-map-hint">
          Klikni na bod pro kartu. Filtry a hledání řídí stejný seznam jako výpis.
        </p>
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
