import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export const INDIA = [22.5, 80.5]
export const HYDERABAD = [17.385, 78.4867]
// Broad map coverage, including Indian islands; not a political boundary test.
export const inIndiaCoverage = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 37.6 && lng >= 68 && lng <= 97.5

export default function ChargerMap({ spots, selectedId, onSelect, userLocation, locationSource, pickMode, onPick, onBoundsChange }) {
  const container = useRef(null)
  const map = useRef(null)
  const markers = useRef(null)
  const userMarker = useRef(null)
  const pickCallback = useRef(onPick)
  pickCallback.current = onPick
  const boundsCallback = useRef(onBoundsChange)
  boundsCallback.current = onBoundsChange

  useEffect(() => {
    if (!container.current || map.current) return
    const instance = L.map(container.current, { zoomControl: false, scrollWheelZoom: false }).setView(HYDERABAD, 11)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(instance)
    L.control.zoom({ position: 'bottomright' }).addTo(instance)
    markers.current = L.layerGroup().addTo(instance)
    instance.on('click', event => pickCallback.current?.(event.latlng))
    instance.on('moveend', () => {
      const b = instance.getBounds()
      boundsCallback.current?.({ south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() })
    })
    map.current = instance
    const b = instance.getBounds()
    boundsCallback.current?.({ south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() })
    const timer = window.setTimeout(() => instance.invalidateSize(), 150)
    return () => { window.clearTimeout(timer); instance.remove(); map.current = null }
  }, [])

  useEffect(() => {
    if (!map.current || !markers.current) return
    markers.current.clearLayers()
    const zoom = map.current.getZoom()
    const groups = new Map()
    spots.filter(spot => Number.isFinite(Number(spot.latitude)) && Number.isFinite(Number(spot.longitude)) && spot.id !== selectedId).forEach(spot => {
      const point = map.current.project([Number(spot.latitude), Number(spot.longitude)], zoom)
      const cell = zoom < 14 ? 76 : zoom < 17 ? 56 : 36
      const key = `${Math.floor(point.x / cell)}:${Math.floor(point.y / cell)}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(spot)
    })
    const addSpot = spot => {
      const active = selectedId === spot.id
      const marker = L.marker([Number(spot.latitude), Number(spot.longitude)], {
        title: spot.name || spot.title || 'Charging place',
        zIndexOffset: active ? 1000 : 0,
        icon: L.divIcon({
          className: 'spot-marker-shell',
          html: `<span class="spot-marker ${spot.kind === 'public' ? 'public-marker' : spot.is_demo ? 'demo-marker' : 'home-marker'} ${active ? 'selected' : ''}" aria-hidden="true">${spot.kind === 'public' ? '⚡' : '⌂'}</span>`,
          iconSize: [28, 28], iconAnchor: [14, 14]
        })
      }).addTo(markers.current)
      marker.on('click', event => {
        if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent)
        if (pickMode) onPick({ lat: Number(spot.latitude), lng: Number(spot.longitude) })
        else onSelect(spot.id)
      })
    }
    groups.forEach(group => {
      if (group.length > 1) {
        const lat = group.reduce((sum, s) => sum + Number(s.latitude), 0) / group.length
        const lng = group.reduce((sum, s) => sum + Number(s.longitude), 0) / group.length
        const marker = L.marker([lat, lng], { icon: L.divIcon({
          className: 'spot-marker-shell',
          html: `<span class="spot-cluster">${group.length}</span>`,
          iconSize: [32, 32], iconAnchor: [16, 16]
        }), title: `${group.length} charging places; click to zoom in` }).addTo(markers.current)
        marker.on('click', event => {
          if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent)
          if (pickMode) onPick({ lat, lng })
          else if (zoom >= 18) onSelect(group[0].id)
          else map.current.setView([lat, lng], Math.min(zoom + 2, 18), { animate: true })
        })
        return
      }
      addSpot(group[0])
    })
    const selectedSpot = spots.find(spot => spot.id === selectedId)
    if (selectedSpot) addSpot(selectedSpot)
  }, [spots, selectedId, onSelect, onPick, pickMode])

  useEffect(() => {
    if (!map.current) return
    if (userMarker.current) { userMarker.current.remove(); userMarker.current = null }
    if (userLocation && inIndiaCoverage(userLocation[0], userLocation[1])) {
      userMarker.current = L.circleMarker(userLocation, {
        radius: 9, color: '#fff', weight: 3, fillColor: '#d42d60', fillOpacity: 1
      }).addTo(map.current)
      userMarker.current.bindTooltip(locationSource === 'map' ? 'Chosen point' : 'You are here', { direction: 'top' })
      map.current.setView(userLocation, 13, { animate: true })
    } else { map.current.setView(HYDERABAD, 11) }
  }, [userLocation, locationSource])

  useEffect(() => {
    if (!map.current || !selectedId) return
    const spot = spots.find(item => item.id === selectedId)
    if (spot) map.current.flyTo([Number(spot.latitude), Number(spot.longitude)], Math.max(map.current.getZoom(), 13), { duration: .45 })
  }, [selectedId])

  return <div className={`real-map ${pickMode ? 'picking' : ''}`} ref={container} aria-label="Interactive map of charger spots across India" />
}
