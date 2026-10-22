import { useEffect, useMemo, useState } from 'react'
import { Check, CircleHelp, ExternalLink, Home, LocateFixed, MapPin, Navigation, Search, ShieldCheck, Zap } from 'lucide-react'
import ChargerMap, { inIndiaCoverage } from './Map'
import { supabase } from './supabase'
import { googleMapsDirections } from './navigation'

const sourcePage = 'https://www.beeindia.gov.in/show_content.php?lang=1&level=2&lid=67&ls_id=345'
// Lower-capacity variants from manufacturer material. Apply a conservative 70% factor.
const carModels = [
  { name: 'Tata Nexon EV', certifiedKm: 275 },
  { name: 'Tata Punch EV', certifiedKm: 315 },
  { name: 'MG ZS EV', certifiedKm: 461 },
  { name: 'Mahindra BE 6', certifiedKm: 557 },
  { name: 'Hyundai Creta Electric', certifiedKm: 420 },
  { name: 'Other EV', certifiedKm: null }
]
const kmBetween = (a, b, c, d) => {
  const rad = Math.PI / 180
  const x = Math.sin((c - a) * rad / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin((d - b) * rad / 2) ** 2
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 10) / 10
}
const dateText = value => value ? new Date(`${value}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'unknown date'
const sourceIsStale = value => !value || Date.now() - new Date(`${value}T00:00:00Z`).getTime() > 180 * 86400000
const inputTime = () => {
  const date = new Date(Date.now() + 20 * 60 * 1000)
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function Discovery({ hostSpots, user, profile, onHostsChanged, onLogin, initialLocation, parentNotice, onClearParentNotice }) {
  const [publicStations, setPublicStations] = useState([])
  const [reviews, setReviews] = useState({})
  const [bounds, setBounds] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [showCount, setShowCount] = useState(20)
  const [kind, setKind] = useState('all')
  const [connector, setConnector] = useState('all')
  const [speed, setSpeed] = useState('all')
  const [location, setLocation] = useState(null)
  const [locationSource, setLocationSource] = useState(null)
  const [pickMode, setPickMode] = useState(null)
  const [notice, setNotice] = useState('')
  const [model, setModel] = useState(carModels[0].name)
  const [battery, setBattery] = useState('')
  const [fullRange, setFullRange] = useState('')
  const [displayedRange, setDisplayedRange] = useState('')
  const [road, setRoad] = useState({ status: 'idle' })
  const [start, setStart] = useState(inputTime)
  const [duration, setDuration] = useState('1')
  const [note, setNote] = useState('')
  const [bookings, setBookings] = useState([])
  const [privateDetails, setPrivateDetails] = useState({})
  const [ownDetails, setOwnDetails] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (initialLocation) { setLocation(initialLocation); setLocationSource('gps') }
  }, [initialLocation?.[0], initialLocation?.[1]])

  useEffect(() => {
    if (!supabase) return
    supabase.from('host_reviews').select('spot_id,status').then(({ data }) =>
      setReviews(Object.fromEntries((data || []).map(row => [row.spot_id, row.status]))))
  }, [hostSpots])

  useEffect(() => {
    if (!supabase || !bounds) return
    let active = true
    const timer = setTimeout(async () => {
      let query = supabase.from('public_stations')
        .select('id,operator_name,station_name,address,city,state,latitude,longitude,connector_types,max_power_kw,source_url,source_published_at,review_status,imported_at')
        .limit(500)
      if (search.trim().length >= 3) {
        const term = search.trim().replace(/[%(),]/g, '')
        query = query.or(`city.ilike.%${term}%,station_name.ilike.%${term}%,operator_name.ilike.%${term}%`)
      } else {
        query = query.gte('latitude', Math.max(6, bounds.south)).lte('latitude', Math.min(37.6, bounds.north))
          .gte('longitude', Math.max(68, bounds.west)).lte('longitude', Math.min(97.5, bounds.east))
      }
      const { data, error } = await query
      if (!active) return
      if (error) setNotice(`Could not load public stations: ${error.message}`)
      else setPublicStations(data || [])
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [bounds?.south, bounds?.north, bounds?.west, bounds?.east, search])

  const loadBookings = async () => {
    if (!supabase || !user) { setBookings([]); return }
    const { data, error } = await supabase.from('host_bookings')
      .select('id,spot_id,host_id,driver_id,starts_at,ends_at,status,driver_note,expires_at,created_at')
      .order('created_at', { ascending: false }).limit(50)
    if (error) setNotice(`Could not load bookings: ${error.message}`)
    else setBookings(data || [])
  }
  useEffect(() => { loadBookings() }, [user?.id])
  useEffect(() => {
    if (!user) return
    const timer = setInterval(loadBookings, 20000)
    return () => clearInterval(timer)
  }, [user?.id])
  useEffect(() => {
    if (!supabase || !user) { setPrivateDetails({}); return }
    const ids = bookings.filter(b => b.status === 'accepted' && b.driver_id === user.id && new Date(b.ends_at) > new Date()).map(b => b.spot_id)
    if (!ids.length) { setPrivateDetails({}); return }
    supabase.from('host_private').select('spot_id,exact_address,access_notes,phone_number').in('spot_id', ids)
      .then(({ data }) => setPrivateDetails(Object.fromEntries((data || []).map(row => [row.spot_id, row]))))
  }, [bookings, user?.id])
  useEffect(() => {
    if (!selectedId?.startsWith('home:') || !user) { setOwnDetails(null); return }
    const id = selectedId.slice(5)
    if (!hostSpots.some(s => s.id === id && s.owner_id === user.id)) { setOwnDetails(null); return }
    supabase.from('host_private').select('spot_id,exact_address,access_notes,phone_number').eq('spot_id', id).maybeSingle()
      .then(({ data }) => setOwnDetails(data || null))
  }, [selectedId, user?.id, hostSpots])

  const spots = useMemo(() => [
    ...hostSpots.map(s => ({ ...s, kind: 'home', name: s.title, connectors: [s.plug_type], power: null,
      review: reviews[s.id] || 'pending', key: `home:${s.id}` })),
    ...publicStations.map(s => ({ ...s, kind: 'public', name: s.station_name, connectors: s.connector_types || [],
      power: Number(s.max_power_kw) || null, review: s.review_status, key: `public:${s.id}` }))
  ], [hostSpots, publicStations, reviews])
  const visible = useMemo(() => spots.map(s => ({ ...s, distance: location ? kmBetween(...location, Number(s.latitude), Number(s.longitude)) : null }))
    .filter(s => search.trim().length >= 3 || !bounds || (Number(s.latitude) >= bounds.south && Number(s.latitude) <= bounds.north && Number(s.longitude) >= bounds.west && Number(s.longitude) <= bounds.east))
    .filter(s => kind === 'all' || s.kind === kind)
    .filter(s => connector === 'all' || s.connectors.some(c => c.toLowerCase().includes(connector.toLowerCase())))
    .filter(s => speed === 'all' || (s.power != null && (speed === 'fast' ? s.power >= 22 : s.power < 22)))
    .filter(s => `${s.name} ${s.area || ''} ${s.city} ${s.operator_name || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)), [spots, location, kind, connector, speed, search, bounds])
  useEffect(() => setShowCount(20), [search, kind, connector, speed, bounds?.south, bounds?.north, bounds?.west, bounds?.east])
  const selected = visible.find(s => s.key === selectedId)
  const modelRange = carModels.find(m => m.name === model)?.certifiedKm
  const validBattery = battery !== '' && Number(battery) >= 0 && Number(battery) <= 100
  const rangeSource = displayedRange !== '' && Number(displayedRange) >= 0 ? 'car display'
    : validBattery && fullRange !== '' && Number(fullRange) > 0 ? 'your full-charge range'
      : validBattery && modelRange ? 'conservative model estimate' : null
  const range = rangeSource === 'car display' ? Number(displayedRange)
    : rangeSource === 'your full-charge range' ? Math.round(Number(fullRange) * Number(battery) / 100)
      : rangeSource === 'conservative model estimate' ? Math.round(modelRange * 0.7 * Number(battery) / 100) : null
  const reach = road.status !== 'ok' || range == null ? 'unknown'
    : range >= road.km + Math.max(5, road.km * 0.2) ? 'likely reachable' : 'tight'

  useEffect(() => {
    if (!selected || !location) { setRoad({ status: 'idle' }); return }
    let active = true
    setRoad({ status: 'loading' })
    fetch('/api/route', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: location, to: [Number(selected.latitude), Number(selected.longitude)] }) })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Road distance unavailable')))
      .then(data => { if (active) setRoad({ status: 'ok', km: data.km }) })
      .catch(() => { if (active) setRoad({ status: 'unavailable' }) })
    return () => { active = false }
  }, [selected?.key, location?.[0], location?.[1]])

  const findMe = () => {
    if (!navigator.geolocation) { setNotice('Location is unavailable. Choose a point on the map.'); return }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (!inIndiaCoverage(coords.latitude, coords.longitude)) { setNotice('Choose a point in India.'); return }
      setLocation([coords.latitude, coords.longitude]); setLocationSource('gps'); setNotice('Showing road distance for the selected charger.')
    }, () => setNotice('Location was unavailable. Choose a point on the map.'), { timeout: 15000, maximumAge: 300000 })
  }
  const pickPoint = latlng => {
    if (!inIndiaCoverage(latlng.lat, latlng.lng)) { setNotice('Choose a point in India.'); return }
    setLocation([latlng.lat, latlng.lng]); setLocationSource('map'); setPickMode(null)
  }
  const requestBooking = async event => {
    event.preventDefault()
    if (!user) { onLogin(); return }
    if (!profile) { setNotice('Complete your profile before requesting a booking.'); onLogin(); return }
    const startDate = new Date(start)
    const endDate = new Date(startDate.getTime() + Number(duration) * 3600000)
    setBusy(true)
    const { error } = await supabase.rpc('request_host_booking', { p_spot_id: selected.id,
      p_starts_at: startDate.toISOString(), p_ends_at: endDate.toISOString(), p_note: `${model}${note.trim() ? ` · ${note.trim()}` : ''}`.slice(0, 300) })
    setBusy(false)
    setNotice(error ? error.message : 'Request sent. The host has 30 minutes to respond. Check Bookings for an update.')
    if (!error) { setNote(''); loadBookings() }
  }
  const respond = async (id, accept) => {
    setBusy(true)
    const { error } = await supabase.rpc('respond_host_booking', { p_booking_id: id, p_accept: accept })
    setBusy(false)
    setNotice(error ? error.message : 'Booking response saved. The latest status is shown below.')
    await loadBookings()
  }
  const cancel = async id => {
    setBusy(true)
    const { error } = await supabase.rpc('cancel_host_booking', { p_booking_id: id })
    setBusy(false)
    setNotice(error ? error.message : 'Booking cancelled.')
    loadBookings()
  }
  const toggleAvailability = async spot => {
    const { error } = await supabase.from('charger_spots').update({ available_now: !spot.available_now }).eq('id', spot.id)
    setNotice(error ? error.message : `Your spot is now ${spot.available_now ? 'unavailable' : 'available'} for requests.`)
    if (!error) onHostsChanged()
  }
  const saveOwnDetails = async event => {
    event.preventDefault()
    if (!selected || selected.owner_id !== user?.id || !ownDetails) return
    setBusy(true)
    const { error } = await supabase.from('host_private').update({
      exact_address: ownDetails.exact_address.trim(), access_notes: ownDetails.access_notes.trim(),
      phone_number: ownDetails.phone_number.trim(), updated_at: new Date().toISOString()
    }).eq('spot_id', selected.id)
    setBusy(false)
    setNotice(error ? error.message : 'Private booking details saved.')
  }

  return <section id="map-section" className="finder discovery">
    <div className="finder-header"><div><span className="eyebrow">HYDERABAD PILOT · INDIA DIRECTORY</span><h2>Find a charge you can reach.</h2><p>Compare neighbourhood hosts and official public-station listings. Confirm access and availability before you travel.</p></div></div>
    <div className="finder-tools discovery-tools">
      <div className="search-box"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, operator or city" aria-label="Search charging places" /></div>
      <select aria-label="Place type" value={kind} onChange={e => setKind(e.target.value)}><option value="all">All places</option><option value="home">Home hosts</option><option value="public">Public stations</option></select>
      <button className="location-quick" onClick={findMe}><LocateFixed size={16}/> Near me</button>
    </div>
    <details className="discovery-options"><summary>More filters and route estimate{connector !== 'all' || speed !== 'all' ? ' · filters on' : ''}</summary><div className="discovery-options-grid">
      <label>Connector<select value={connector} onChange={e => setConnector(e.target.value)}><option value="all">All connectors</option><option value="CCS">CCS2</option><option value="Type 2">Type 2</option><option value="CHAdeMO">CHAdeMO</option><option value="15A">15A socket</option></select></label>
      <label>Charging speed<select value={speed} onChange={e => setSpeed(e.target.value)}><option value="all">Any speed</option><option value="fast">Fast · 22 kW+</option><option value="slow">Standard · below 22 kW</option></select></label>
      <label>Car model<select value={model} onChange={e => setModel(e.target.value)}>{carModels.map(m => <option key={m.name}>{m.name}</option>)}</select></label>
      <label>Battery %<input type="number" min="0" max="100" value={battery} onChange={e => setBattery(e.target.value)} placeholder="Optional" /></label>
      <label>Range at 100% · km<input type="number" min="1" max="1500" value={fullRange} onChange={e => setFullRange(e.target.value)} placeholder="Optional" /></label>
      <label>Car displays · km<input type="number" min="0" max="1500" value={displayedRange} onChange={e => setDisplayedRange(e.target.value)} placeholder="Best estimate" /></label>
    </div><small>For reachability, your car’s displayed remaining range is best. Otherwise, enter battery % for a rough estimate.</small></details>
    {(notice || parentNotice) && <div className="notice"><CircleHelp size={16}/>{notice || parentNotice}<button aria-label="Dismiss" onClick={() => { setNotice(''); onClearParentNotice?.() }}>×</button></div>}
    <div className="finder-grid"><div className="map-wrap"><ChargerMap spots={visible.map(s => ({ ...s, id: s.key }))} selectedId={selectedId} onSelect={setSelectedId} userLocation={location} locationSource={locationSource} pickMode={pickMode} onPick={pickPoint} onBoundsChange={setBounds}/>
      {pickMode && <div className="pick-banner">Tap the map to choose a starting point <button onClick={() => setPickMode(null)}>Cancel</button></div>}
      <div className="map-legend"><span className="legend-home"/> Home <span className="legend-demo"/> Demo <span className="legend-public"/> Public <span className="legend-user"/> You</div><button className="map-choose" onClick={() => setPickMode('browse')}><MapPin size={14}/> Choose starting point</button></div>
      <aside className="spot-panel"><div className="panel-heading"><div><strong>{visible.length} places in view</strong><small>Zoom or move the map for more. Hyderabad is the first review area.</small></div></div>
        <div className="spots-scroll">{visible.length ? visible.slice(0, showCount).map(s => <button key={s.key} className={`spot-card ${selectedId === s.key ? 'selected' : ''}`} onClick={() => setSelectedId(s.key)}>
          <span className="spot-card-top"><span className={`spot-symbol ${s.kind}`}>{s.kind === 'public' ? <Zap size={18}/> : <Home size={18}/>}</span><span className="spot-info"><strong>{s.name}</strong><small><MapPin size={13}/>{s.kind === 'public' ? s.operator_name : `${s.area}, ${s.city}`}</small></span></span>
          <span className="spot-card-bottom"><span className={`tag ${s.kind === 'public' ? 'public-tag' : s.is_demo ? 'demo' : 'live'}`}>{s.kind === 'public' ? 'Public station' : s.is_demo ? 'Demo home' : 'Home host'}</span><span className="plug-label">{s.connectors.join(', ')}</span>{s.distance != null && <span className="distance">{s.distance} km direct</span>}</span>
        </button>) : <div className="empty"><Search size={25}/><strong>No places in view</strong><p>Move the map, change filters, or try another city.</p></div>}{visible.length > showCount && <button className="show-more" onClick={() => setShowCount(count => count + 20)}>Show 20 more places</button>}</div>
        {selected && <div className="selected-detail discovery-detail"><div><span className={`tag ${selected.kind === 'public' ? 'public-tag' : selected.is_demo ? 'demo' : 'live'}`}>{selected.kind === 'public' ? 'Public station' : selected.is_demo ? 'Demo home' : 'Home host'}</span><strong>{selected.name}</strong>
          <p>{selected.kind === 'public' ? `${selected.operator_name} · ${selected.address}` : `${selected.area}, ${selected.city} · ₹${selected.hourly_rate}/hr`}</p>
          <small>{selected.connectors.join(', ')}{selected.power ? ` · up to ${selected.power} kW` : ''}</small>
          {selected.kind === 'public' ? <small>{selected.review === 'access_checked' ? 'Co-Charger access checked' : selected.review === 'location_checked' ? 'Location checked, access unconfirmed' : 'Official directory, access unconfirmed'} · published {dateText(selected.source_published_at)}. {sourceIsStale(selected.source_published_at) ? 'This source is over 6 months old. ' : ''}Live availability is unknown. <a href={selected.source_url || sourcePage} target="_blank" rel="noreferrer">BEE source</a></small>
            : <small>{selected.is_demo ? 'Sample only. This home cannot receive bookings.' : selected.review === 'verified' ? 'Host reviewed by Co-Charger.' : 'Host not yet verified.'}</small>}
          {location && <small className={`reach ${reach.replace(' ', '-')}`}>{road.status === 'loading' ? 'Checking road distance…' : road.status === 'ok' ? `${road.km} km by road · ${reach}${range != null ? ` · ${range} km remaining (${rangeSource})` : ''}` : 'Road distance and reachability unknown'}</small>}
          <small>Range is an estimate. Roads, traffic, terrain and weather can change what your car can reach.</small>
          <div className="detail-actions"><a className="solid" href={googleMapsDirections(selected, selected.kind === 'home' ? privateDetails[selected.id]?.exact_address : undefined)} target="_blank" rel="noopener noreferrer" aria-label={`Navigate to ${selected.name} with Google Maps`}><Navigation size={16}/> Open Google Maps <ExternalLink size={14}/></a></div>
          {selected.kind === 'home' && !privateDetails[selected.id]?.exact_address && <small>Directions use the approximate pin. The exact address is shared after an accepted booking.</small>}
          {selected.kind === 'home' && !selected.is_demo && selected.owner_id !== user?.id && <>{selected.available_now ? <form className="booking-form" onSubmit={requestBooking}><strong>Request a charging slot</strong><label>Arrival<input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)}/></label><label>Duration<select value={duration} onChange={e => setDuration(e.target.value)}><option value="0.5">30 min</option><option value="1">1 hour</option><option value="2">2 hours</option><option value="4">4 hours</option><option value="8">8 hours</option></select></label><label>Note to host<textarea maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="Car and charger details"/></label><button className="solid" disabled={busy}>{busy ? 'Sending…' : 'Request booking'}</button><small>Address and phone are shared only if the host accepts. No payment in this pilot.</small></form> : <small>This host is not taking requests now.</small>}</>}
          {selected.kind === 'home' && selected.owner_id === user?.id && <><button className="ghost" onClick={() => toggleAvailability(selected)}>{selected.available_now ? 'Pause requests' : 'Accept requests'}</button>{ownDetails && <form className="booking-form" onSubmit={saveOwnDetails}><strong>Private booking details</strong><label>Exact address<input required minLength={8} maxLength={300} value={ownDetails.exact_address} onChange={e => setOwnDetails({ ...ownDetails, exact_address: e.target.value })}/></label><label>Contact phone<input required pattern="\+91[0-9]{10}" value={ownDetails.phone_number} onChange={e => setOwnDetails({ ...ownDetails, phone_number: e.target.value })}/></label><label>Access notes<textarea maxLength={500} value={ownDetails.access_notes} onChange={e => setOwnDetails({ ...ownDetails, access_notes: e.target.value })}/></label><button className="solid" disabled={busy}>Save details</button><small>Drivers see this only after you accept their booking.</small></form>}</>}
        </div></div>}</aside></div>
    {user && <div className="booking-dashboard"><div className="booking-heading"><h3>Bookings</h3><button className="ghost" onClick={loadBookings}>Refresh</button></div>{bookings.length ? bookings.map(b => {
      const host = b.host_id === user.id
      const spot = hostSpots.find(s => s.id === b.spot_id)
      const details = privateDetails[b.spot_id]
      const expired = b.status === 'pending' && new Date(b.expires_at) <= new Date()
      const status = expired ? 'expired' : b.status
      return <div className="booking-row" key={b.id}><div><strong>{spot?.title || 'Home charger'}</strong><span>{new Date(b.starts_at).toLocaleString('en-IN')} · {Math.round((new Date(b.ends_at) - new Date(b.starts_at)) / 3600000 * 10) / 10} hr · {status}</span>{b.driver_note && <small>Note: {b.driver_note}</small>}{!host && status === 'accepted' && new Date(b.ends_at) > new Date() && details && <small><ShieldCheck size={14}/> {details.exact_address} · {details.phone_number} {details.access_notes && `· ${details.access_notes}`}</small>}</div><div className="booking-actions">{host && status === 'pending' && <><button disabled={busy} onClick={() => respond(b.id, true)}><Check size={15}/> Accept</button><button disabled={busy} onClick={() => respond(b.id, false)}>Decline</button></>}{!host && ['pending','accepted'].includes(status) && new Date(b.starts_at) > new Date() && <button disabled={busy} onClick={() => cancel(b.id)}>Cancel</button>}</div></div>
    }) : <p>No bookings yet.</p>}</div>}
    <p className="source-footer">Public station data: <a href={sourcePage} target="_blank" rel="noreferrer">Bureau of Energy Efficiency, Ministry of Power</a>. Station records are a directory, not a live status feed.</p>
  </section>
}
