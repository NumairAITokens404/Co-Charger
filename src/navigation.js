export function googleMapsDirections(spot, exactAddress) {
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  url.searchParams.set('destination', exactAddress || `${Number(spot.latitude)},${Number(spot.longitude)}`)
  url.searchParams.set('travelmode', 'driving')
  url.searchParams.set('dir_action', 'navigate')
  return url.toString()
}
