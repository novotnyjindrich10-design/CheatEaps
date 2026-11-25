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
import { hasFiniteLatLon } from '../utils/geo'
import {
  boundsAroundPoint,
  boundsFromPlaces,
  BRNO_MAP_CENTER,
  BRNO_MAP_DEFAULT_ZOOM,
  BRNO_MAP_MAX_BOUNDS,
  placesFingerprint,
  placesForMap,
  pickVisibleLabels,
  MAP_LABEL_MIN_ZOOM,
  escapeMapLabel,
} from '../utils/mapPlaces'
import { resolveMapTileConfig } from '../utils/mapTiles'
import { ensureMaplibreWorker } from '../utils/maplibreWorker'

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

const MARKER_TONES = Object.freeze({
  pizza: 'pizza',
  burger: 'burger',
  asijske: 'asia',
  ceske: 'czech',
  vegetarianske: 'green',
  veganske: 'green',
  kebab: 'kebab',
  cina: 'asia',
  mexiko: 'mex',
  kava: 'coffee',
  fastfood: 'fast',
  sladke: 'sweet',
  zdrave: 'green',
})

const MARKER_GLYPH = Object.freeze({
  pizza: 'P',
  burger: 'B',
  asia: 'A',
  czech: 'Č',
  green: 'V',
  kebab: 'K',
  mex: 'M',
  coffee: 'C',
  fast: 'F',
  sweet: 'S',
  sponsored: '★',
  default: '•',
})

/** Poloměr výchozího viewportu kolem polohy — průměr cca 2 km. */
const AREA_RADIUS_M = 1000
const GPS_DOT = '#2563eb'
const GPS_RING = '#3b82f6'

function markerIconFor(place, selected) {
  const tone = place.sponsored ? 'sponsored' : MARKER_TONES[place.category] || 'default'
  const glyph = MARKER_GLYPH[tone] || MARKER_GLYPH.default
  const selectedClass = selected ? ' is-selected' : ''
  return L.divIcon({
    className: `fg-map-marker fg-map-marker--${tone}${selectedClass}`,
    html: `<span class="fg-map-marker-pin" aria-hidden="true"><span class="fg-map-marker-glyph">${glyph}</span></span>`,
    iconSize: selected ? [32, 40] : [28, 36],
    iconAnchor: selected ? [16, 38] : [14, 34],
    popupAnchor: [0, -28],
  })
}

async function addBasemap(map, tiles) {
  if (tiles.mode === 'vector-style') {
    ensureMaplibreWorker()
    const { maplibreGL } = await import('@maplibre/maplibre-gl-leaflet')
    // Styl MapLibre má vlastní atribuci, ale do Leaflet ovládacího prvku ji nepředá.
    // Jedna věta patří sem; vlastní prvek MapLibre schová CSS, ať se text neopakuje.
    const layer = maplibreGL({
      style: tiles.styleUrl,
      interactive: false,
      attributionControl: false,
    })
    layer.addTo(map)
    if (tiles.attribution) map.attributionControl?.addAttribution(tiles.attribution)
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

function orderedPlaces(places) {
  const ranked = places.map((place, index) => ({ place, index }))
  const hasDistance = ranked.some((item) => typeof item.place.distanceKm === 'number')
  if (!hasDistance) return places
  ranked.sort((a, b) => {
    const left = typeof a.place.distanceKm === 'number' ? a.place.distanceKm : Number.POSITIVE_INFINITY
    const right = typeof b.place.distanceKm === 'number' ? b.place.distanceKm : Number.POSITIVE_INFINITY
    if (left !== right) return left - right
    return a.index - b.index
  })
  return ranked.map((item) => item.place)
}

function originKey(origin) {
  if (!hasFiniteLatLon(origin?.lat, origin?.lon)) return ''
  return `${origin.type || 'x'}:${origin.lat.toFixed(5)},${origin.lon.toFixed(5)}`
}

function PlaceCard({ place, onClose, compact = false }) {
  if (!place) return null
  return (
    <article className={`map-place-card${compact ? ' map-place-card--sheet' : ''}`} aria-live="polite">
      {compact ? (
        <button type="button" className="map-place-sheet-dismiss" onClick={onClose} aria-label="Zavřít kartu">
          <span aria-hidden="true" />
        </button>
      ) : null}
      {!compact && place.photoUrl ? (
        <img className="map-place-photo" src={place.photoUrl} alt={place.photoAlt || ''} loading="lazy" decoding="async" />
      ) : null}
      <div className="map-place-copy">
        {place.sponsored ? <p className="map-place-sponsored">{SPONSORED_LABEL}</p> : null}
        <h2 className="map-place-title">{place.name}</h2>
        {place.cuisineLabel ? <p className="map-place-meta">{place.cuisineLabel}</p> : null}
        {!compact && place.address ? <p className="map-place-meta">{place.address}</p> : null}
        {place.priceLabel ? (
          <p className="map-place-meta">
            {place.priceLabel}
            {place.priceStatus ? ` · ${place.priceStatus}` : ''}
          </p>
        ) : null}
        {!compact && place.ratingLabel ? <p className="map-place-meta">{place.ratingLabel}</p> : null}
        {place.distanceLabel ? <p className="map-place-meta">{place.distanceLabel}</p> : null}
        <div className="map-place-actions">
          <Link className="btn btn-primary" to={place.detailPath}>
            Zobrazit detail
          </Link>
          <a className="btn btn-secondary" href={place.navigateUrl} target="_blank" rel="noreferrer">
            Navigovat
          </a>
        </div>
      </div>
    </article>
  )
}

export default function RestaurantMap({
  restaurants = [],
  selectedId = '',
  onSelect,
  userOrigin = null,
  onLocate,
  locating = false,
  locationError = '',
  onForget,
  focusToken = 0,
  onReady,
}) {
  const mapId = useId().replace(/:/g, '')
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const clusterRef = useRef(null)
  const markersRef = useRef(new Map())
  const userLayerRef = useRef(null)
  const fittedFingerprintRef = useRef('')
  const builtFingerprintRef = useRef('')
  const selectedMarkerRef = useRef('')
  const flownFocusRef = useRef(0)
  const userAdjustedRef = useRef(false)
  const programmaticMoveRef = useRef(false)
  const centeredOriginKeyRef = useRef('')
  const readyNotifiedRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  const onReadyRef = useRef(onReady)
  const pickRef = useRef(() => {})
  const [ready, setReady] = useState(false)
  const [basemapError, setBasemapError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [pickedId, setPickedId] = useState(selectedId || '')
  const [trackedSelected, setTrackedSelected] = useState(selectedId || '')
  const [panToken, setPanToken] = useState(0)
  if (selectedId !== trackedSelected) {
    setTrackedSelected(selectedId || '')
    setPickedId(selectedId || '')
  }
  const places = useMemo(() => placesForMap(restaurants), [restaurants])
  const fingerprint = useMemo(() => placesFingerprint(places), [places])
  const ordered = useMemo(() => orderedPlaces(places), [places])
  const visibleId = places.some((place) => place.id === pickedId) ? pickedId : ''
  const picked = places.find((place) => place.id === visibleId) || null
  const sheetPlaces = useMemo(() => {
    const head = ordered.slice(0, 30)
    if (picked && !head.some((place) => place.id === picked.id)) return [picked, ...head]
    return head
  }, [ordered, picked])
  const hasOrigin = hasFiniteLatLon(userOrigin?.lat, userOrigin?.lon)

  const pickPlace = (id) => pickRef.current(id)

  const runProgrammatic = (fn) => {
    const map = mapRef.current
    if (!map) return
    programmaticMoveRef.current = true
    fn(map)
    map.once('moveend', () => {
      programmaticMoveRef.current = false
    })
  }

  const flyToArea = (lat, lon) => {
    const bounds = boundsAroundPoint(lat, lon, AREA_RADIUS_M)
    if (!bounds) return
    runProgrammatic((map) => {
      map.fitBounds(bounds, {
        padding: [28, 28],
        maxZoom: 16,
        animate: true,
        duration: 0.55,
      })
    })
  }

  const fitAllPlaces = () => {
    const bounds = boundsFromPlaces(places)
    userAdjustedRef.current = false
    runProgrammatic((map) => {
      if (bounds) {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15, animate: true, duration: 0.45 })
      } else {
        map.setView([BRNO_MAP_CENTER.lat, BRNO_MAP_CENTER.lon], BRNO_MAP_DEFAULT_ZOOM, { animate: true })
      }
    })
    fittedFingerprintRef.current = fingerprint
  }

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined
    let cancelled = false
    const map = L.map(containerRef.current, {
      center: [BRNO_MAP_CENTER.lat, BRNO_MAP_CENTER.lon],
      zoom: BRNO_MAP_DEFAULT_ZOOM,
      minZoom: 10,
      zoomControl: false,
      maxZoom: 19,
      maxBounds: BRNO_MAP_MAX_BOUNDS,
      maxBoundsViscosity: 0.65,
      scrollWheelZoom: true,
      attributionControl: true,
    })
    mapRef.current = map
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const markUserAdjust = () => {
      if (!programmaticMoveRef.current) userAdjustedRef.current = true
    }
    map.on('dragstart', markUserAdjust)
    map.on('zoomstart', markUserAdjust)

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
      map.off('dragstart', markUserAdjust)
      map.off('zoomstart', markUserAdjust)
      map.remove()
      mapRef.current = null
      clusterRef.current = null
      markersRef.current = new Map()
      userLayerRef.current = null
      fittedFingerprintRef.current = ''
      builtFingerprintRef.current = ''
      selectedMarkerRef.current = ''
      readyNotifiedRef.current = false
      centeredOriginKeyRef.current = ''
      userAdjustedRef.current = false
      setReady(false)
    }
  }, [])

  useEffect(() => {
    onSelectRef.current = onSelect
    pickRef.current = (id) => {
      setPickedId(id)
      setPanToken((token) => token + 1)
      onSelectRef.current?.(id)
    }
  }, [onSelect])

  useEffect(() => {
    if (!ready || readyNotifiedRef.current) return
    readyNotifiedRef.current = true
    onReadyRef.current?.()
  }, [ready])

  useEffect(() => {
    const map = mapRef.current
    const cluster = clusterRef.current
    if (!map || !cluster || !ready) return

    if (builtFingerprintRef.current !== fingerprint) {
      cluster.clearLayers()
      markersRef.current = new Map()

      for (const place of places) {
        const selected = place.id === visibleId
        const marker = L.marker([place.lat, place.lon], {
          title: place.name,
          riseOnHover: true,
          zIndexOffset: selected ? 800 : place.sponsored ? 200 : 0,
          icon: markerIconFor(place, selected),
        })
        marker.on('click', () => {
          pickRef.current(place.id)
        })
        cluster.addLayer(marker)
        markersRef.current.set(place.id, marker)
      }
      builtFingerprintRef.current = fingerprint
      selectedMarkerRef.current = visibleId
    }

    // Viewport řídí poloha / Brno / tlačítko Všechny body — ne automatický fit při každém filtru.
    fittedFingerprintRef.current = fingerprint
    requestAnimationFrame(() => map.invalidateSize())
  }, [places, fingerprint, ready, visibleId])

  useEffect(() => {
    if (!ready) return
    const previousId = selectedMarkerRef.current
    if (previousId && previousId !== visibleId) {
      const previous = places.find((place) => place.id === previousId)
      const marker = markersRef.current.get(previousId)
      if (previous && marker) {
        marker.setIcon(markerIconFor(previous, false))
        marker.setZIndexOffset(previous.sponsored ? 200 : 0)
      }
    }
    if (visibleId) {
      const current = places.find((place) => place.id === visibleId)
      const marker = markersRef.current.get(visibleId)
      if (current && marker) {
        marker.setIcon(markerIconFor(current, true))
        marker.setZIndexOffset(800)
      }
    }
    selectedMarkerRef.current = visibleId
  }, [places, ready, visibleId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return undefined
    const frame = requestAnimationFrame(() => map.invalidateSize())
    return () => cancelAnimationFrame(frame)
  }, [expanded, ready])

  useEffect(() => {
    if (!expanded) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [expanded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return undefined

    const syncLabels = () => {
      const show = map.getZoom() >= MAP_LABEL_MIN_ZOOM
      const points = []
      for (const place of places) {
        const marker = markersRef.current.get(place.id)
        if (!marker) continue
        marker.unbindTooltip()
        if (!show) continue
        const point = map.latLngToContainerPoint(marker.getLatLng())
        points.push({
          id: place.id,
          x: point.x,
          y: point.y,
          priority: place.id === visibleId ? 3 : place.sponsored ? 2 : 1,
          name: place.name,
        })
      }
      if (!show) return
      const visible = new Set(pickVisibleLabels(points))
      for (const point of points) {
        if (!visible.has(point.id)) continue
        const marker = markersRef.current.get(point.id)
        marker?.bindTooltip(escapeMapLabel(point.name), {
          permanent: true,
          direction: 'top',
          offset: [0, -30],
          className: 'fg-map-label',
          opacity: 1,
        })
      }
    }

    syncLabels()
    map.on('zoomend moveend', syncLabels)
    return () => {
      map.off('zoomend moveend', syncLabels)
    }
  }, [places, ready, visibleId])

  useEffect(() => {
    if (!panToken || !visibleId || !ready) return
    const marker = markersRef.current.get(visibleId)
    if (!marker || !mapRef.current) return
    const latLng = marker.getLatLng()
    runProgrammatic((map) => {
      map.setView(latLng, Math.max(map.getZoom(), 15), { animate: true })
    })
  }, [panToken, visibleId, ready])

  // Explicitní „Moje poloha“ (focusToken) vždy vycentruje — i po ručním posunu.
  useEffect(() => {
    if (!ready || !focusToken || flownFocusRef.current === focusToken) return
    if (!hasFiniteLatLon(userOrigin?.lat, userOrigin?.lon) || !mapRef.current) return
    flownFocusRef.current = focusToken
    userAdjustedRef.current = false
    centeredOriginKeyRef.current = originKey(userOrigin)
    flyToArea(userOrigin.lat, userOrigin.lon)
  }, [focusToken, ready, userOrigin])

  // První / nová známá poloha (GPS nebo ruční) — bez opakování po ručním pohybu.
  useEffect(() => {
    if (!ready || !hasOrigin || userAdjustedRef.current) return
    const key = originKey(userOrigin)
    if (!key || centeredOriginKeyRef.current === key) return
    centeredOriginKeyRef.current = key
    flyToArea(userOrigin.lat, userOrigin.lon)
  }, [ready, userOrigin, hasOrigin])

  // Bez polohy: výchozí oblast Brna (~2 km), jen jednou.
  useEffect(() => {
    if (!ready || hasOrigin || centeredOriginKeyRef.current || userAdjustedRef.current) return
    centeredOriginKeyRef.current = 'brno'
    flyToArea(BRNO_MAP_CENTER.lat, BRNO_MAP_CENTER.lon)
  }, [ready, hasOrigin])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    if (userLayerRef.current) {
      map.removeLayer(userLayerRef.current)
      userLayerRef.current = null
    }

    if (!hasFiniteLatLon(userOrigin?.lat, userOrigin?.lon)) return
    // Modrá tečka jen u skutečné GPS — ruční lokalita není „tvoje poloha“.
    if (userOrigin.type !== 'gps') return

    const group = L.layerGroup()
    const accuracy =
      typeof userOrigin.accuracy === 'number' && Number.isFinite(userOrigin.accuracy)
        ? Math.min(Math.max(userOrigin.accuracy, 40), 400)
        : 80
    L.circle([userOrigin.lat, userOrigin.lon], {
      radius: accuracy,
      color: GPS_RING,
      weight: 1,
      fillColor: GPS_RING,
      fillOpacity: 0.12,
      interactive: false,
      className: 'fg-user-location-accuracy',
    }).addTo(group)
    L.circleMarker([userOrigin.lat, userOrigin.lon], {
      radius: 8,
      color: '#fff',
      weight: 2.5,
      fillColor: GPS_DOT,
      fillOpacity: 1,
      className: 'fg-user-location',
      title: 'Tvoje poloha',
    }).addTo(group)
    group.addTo(map)
    userLayerRef.current = group
  }, [userOrigin, ready])

  return (
    <section className={expanded ? 'restaurant-map is-expanded' : 'restaurant-map'} aria-label="Mapa restaurací v Brně">
      <div className="restaurant-map-toolbar">
        <p className="restaurant-map-count">
          {places.length === 0
            ? 'Žádný podnik s platnými souřadnicemi v aktuálních filtrech.'
            : `${places.length} ${places.length === 1 ? 'bod' : places.length < 5 ? 'body' : 'bodů'} na mapě`}
        </p>
        <p className="restaurant-map-hint">
          Klikni na bod pro kartu. Při přiblížení se ukážou názvy, které se vejdou vedle sebe.
        </p>
        <div className="restaurant-map-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onLocate?.()}
            disabled={locating || !onLocate}
            aria-busy={locating}
          >
            {locating ? 'Zjišťuji polohu…' : 'Moje poloha'}
          </button>
          {places.length > 0 ? (
            <button type="button" className="btn btn-secondary restaurant-map-fit" onClick={fitAllPlaces}>
              Všechny body
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            aria-pressed={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Zmenšit' : 'Zvětšit'}
          </button>
          {hasOrigin && onForget ? (
            <button type="button" className="btn btn-secondary" onClick={onForget}>
              Zapomenout polohu
            </button>
          ) : null}
        </div>
        {locationError ? (
          <p className="restaurant-map-hint" role="status">
            {locationError} Mapa Brna funguje dál.
          </p>
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
      {picked ? (
        <div className="map-place-sheet-host">
          <PlaceCard
            place={picked}
            compact
            onClose={() => {
              setPickedId('')
              onSelectRef.current?.('')
            }}
          />
        </div>
      ) : null}
      {places.length === 0 ? (
        <p className="restaurant-map-empty" role="status">
          Zkus uvolnit filtry, nebo přepni zpět na seznam.{' '}
          <Link to="/results">Otevřít výsledky</Link>
        </p>
      ) : (
        <div className="map-place-sheet">
          <p className="map-place-sheet-title">{hasOrigin ? 'Nejbližší podniky' : 'Podniky v aktuálním filtru'}</p>
          <ul className="map-place-sheet-list">
            {sheetPlaces.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  className={`map-place-sheet-item${place.id === visibleId ? ' is-active' : ''}`}
                  aria-current={place.id === visibleId ? 'true' : undefined}
                  onClick={() => pickPlace(place.id)}
                >
                  <span>{place.name}</span>
                  <span className="map-place-sheet-meta">
                    {[place.sponsored ? SPONSORED_LABEL : '', place.cuisineLabel, place.priceLabel, place.distanceLabel]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
