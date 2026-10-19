import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export const HYD = [17.430, 78.420]
export const inHyderabad = (lat, lng) => lat >= 17.15 && lat <= 17.65 && lng >= 78.20 && lng <= 78.75

export default function ChargerMap({ spots, selectedId, onSelect, userLocation, pickMode, onPick }) {
  const container = useRef(null)
  const map = useRef(null)
  const markers = useRef(null)
  const userMarker = useRef(null)
  const pickCallback = useRef(onPick)
  pickCallback.current = onPick

  useEffect(() => {
    if (!container.current || map.current) return
    const instance = L.map(container.current, { zoomControl: false, scrollWheelZoom: false }).setView(HYD, 12)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(instance)
    L.control.zoom({ position: 'bottomright' }).addTo(instance)
    markers.current = L.layerGroup().addTo(instance)
    instance.on('click', event => pickCallback.current?.(event.latlng))
    map.current = instance
    const timer = window.setTimeout(() => instance.invalidateSize(), 150)
    return () => { window.clearTimeout(timer); instance.remove(); map.current = null }
  }, [])

  useEffect(() => {
    if (!map.current || !markers.current) return
    markers.current.clearLayers()
    spots.forEach(spot => {
      const active = selectedId === spot.id
      const marker = L.marker([Number(spot.latitude), Number(spot.longitude)], {
        icon: L.divIcon({
          className: 'spot-marker-shell',
          html: `<span class="spot-marker ${active ? 'selected' : ''}">₹${Number(spot.hourly_rate)}</span>`,
          iconSize: [57, 35], iconAnchor: [28, 35]
        })
      }).addTo(markers.current)
      marker.on('click', () => onSelect(spot.id))
    })
  }, [spots, selectedId, onSelect])

  useEffect(() => {
    if (!map.current) return
    if (userMarker.current) { userMarker.current.remove(); userMarker.current = null }
    if (userLocation && inHyderabad(userLocation[0], userLocation[1])) {
      userMarker.current = L.circleMarker(userLocation, {
        radius: 9, color: '#fff', weight: 3, fillColor: '#d42d60', fillOpacity: 1
      }).addTo(map.current)
      userMarker.current.bindTooltip('You are here', { direction: 'top' })
      map.current.setView(userLocation, 13, { animate: true })
    }
  }, [userLocation])

  useEffect(() => {
    if (!map.current || !selectedId) return
    const spot = spots.find(item => item.id === selectedId)
    if (spot) map.current.flyTo([Number(spot.latitude), Number(spot.longitude)], Math.max(map.current.getZoom(), 13), { duration: .45 })
  }, [selectedId])

  return <div className={`real-map ${pickMode ? 'picking' : ''}`} ref={container} aria-label="Interactive map of charger spots in Hyderabad" />
}
