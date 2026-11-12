/**
 * MapLibre GL JS v6 + Vite: worker se musí nastavit přes ?worker&url,
 * jinak zůstane prázdná mapa („Worker failed to load“).
 */
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

let ready = false

export function ensureMaplibreWorker() {
  if (ready) return
  setWorkerUrl(workerUrl)
  ready = true
}
