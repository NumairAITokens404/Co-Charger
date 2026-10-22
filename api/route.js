// Vercel server function. Configure ORS_API_KEY as a server-side environment variable.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const { from, to } = request.body || {}
  const valid = value => Array.isArray(value) && value.length === 2 &&
    Number.isFinite(value[0]) && Number.isFinite(value[1]) &&
    value[0] >= 6 && value[0] <= 37.6 && value[1] >= 68 && value[1] <= 97.5
  if (!valid(from) || !valid(to)) return response.status(400).json({ error: 'Invalid coordinates' })
  if (!process.env.ORS_API_KEY) return response.status(503).json({ error: 'Road-distance service is not configured' })
  try {
    const upstream = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: { Authorization: process.env.ORS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: [[from[1], from[0]], [to[1], to[0]]], instructions: false })
    })
    if (!upstream.ok) return response.status(502).json({ error: 'Road route unavailable' })
    const data = await upstream.json()
    const metres = data?.routes?.[0]?.summary?.distance
    if (!Number.isFinite(metres)) return response.status(502).json({ error: 'Road route unavailable' })
    return response.status(200).json({ km: Math.round(metres / 100) / 10 })
  } catch {
    return response.status(502).json({ error: 'Road route unavailable' })
  }
}
