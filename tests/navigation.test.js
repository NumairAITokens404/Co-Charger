import assert from 'node:assert/strict'
import test from 'node:test'
import { googleMapsDirections } from '../src/navigation.js'

test('Google Maps opens driving navigation from the device location to a station pin', () => {
  const url = new URL(googleMapsDirections({ latitude: '17.385', longitude: '78.4867' }))
  assert.equal(`${url.origin}${url.pathname}`, 'https://www.google.com/maps/dir/')
  assert.equal(url.searchParams.get('api'), '1')
  assert.equal(url.searchParams.get('destination'), '17.385,78.4867')
  assert.equal(url.searchParams.get('travelmode'), 'driving')
  assert.equal(url.searchParams.get('dir_action'), 'navigate')
  assert.equal(url.searchParams.has('origin'), false)
})

test('an accepted host address takes priority over its approximate map pin', () => {
  const url = new URL(googleMapsDirections({ latitude: 17.385, longitude: 78.4867 }, '12 Main Road, Hyderabad'))
  assert.equal(url.searchParams.get('destination'), '12 Main Road, Hyderabad')
})
