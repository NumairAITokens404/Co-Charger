import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, BatteryCharging, Check, CircleHelp, Crosshair, LocateFixed, MapPin, Navigation, Plus, Search, ShieldCheck, Trash2, X, Zap } from 'lucide-react'
import ChargerMap, { inHyderabad } from './Map'
import { supabase } from './supabase'
import './style.css'

const kmBetween = (a, b, c, d) => {
  const rad = Math.PI / 180
  const x = Math.sin((c-a)*rad/2)**2 + Math.cos(a*rad)*Math.cos(c*rad)*Math.sin((d-b)*rad/2)**2
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)) * 10) / 10
}
const money = value => `₹${Number(value).toLocaleString('en-IN')}`
const initialForm = { title: '', area: '', plug_type: '15A socket', hourly_rate: '80' }

function App() {
  const [user, setUser] = useState(null)
  const [spots, setSpots] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [plug, setPlug] = useState('All plugs')
  const [location, setLocation] = useState(null)
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(null)
  const [email, setEmail] = useState('')
  const [form, setForm] = useState(initialForm)
  const [pin, setPin] = useState(null)
  const [pickMode, setPickMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formMessage, setFormMessage] = useState('')

  const loadSpots = async () => {
    if (!supabase) { setLoading(false); setNotice('Supabase is not configured.'); return }
    const { data, error } = await supabase.from('charger_spots')
      .select('id,owner_id,title,area,city,latitude,longitude,plug_type,hourly_rate,is_demo')
      .eq('city', 'Hyderabad')
    if (error) setNotice(`Could not load spots: ${error.message}`)
    else setSpots(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadSpots()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null))
    return () => subscription.unsubscribe()
  }, [])

  const sorted = useMemo(() => spots.map(spot => ({
    ...spot,
    distance: location ? kmBetween(location[0], location[1], Number(spot.latitude), Number(spot.longitude)) : null
  })).filter(spot => {
    const text = `${spot.title} ${spot.area}`.toLowerCase()
    return text.includes(search.toLowerCase()) && (plug === 'All plugs' || spot.plug_type === plug)
  }).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.area.localeCompare(b.area)), [spots, location, search, plug])

  const visible = location ? sorted.filter(spot => spot.distance <= 15) : sorted
  const selected = visible.find(spot => spot.id === selectedId) || null
  const realCount = spots.filter(spot => !spot.is_demo).length

  const findMe = () => {
    if (!navigator.geolocation) { setNotice('Your browser cannot provide a location. Browse Hyderabad on the map instead.'); return }
    setNotice('Finding your location…')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (!inHyderabad(coords.latitude, coords.longitude)) {
        setLocation(null)
        setNotice('Your current location is outside Hyderabad. This project shows Hyderabad spots for now.')
        return
      }
      setLocation([coords.latitude, coords.longitude])
      setNotice('Showing spots within 15 km of you in Hyderabad.')
    }, () => setNotice('Location access was unavailable. You can still explore Hyderabad on the map.'),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 })
  }

  const useMyPin = () => {
    if (!navigator.geolocation) { setFormMessage('Location is unavailable. Pick a point on the map instead.'); return }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (!inHyderabad(coords.latitude, coords.longitude)) { setFormMessage('Only Hyderabad spots can be added for now.'); return }
      setPin([Math.round(coords.latitude * 1000) / 1000, Math.round(coords.longitude * 1000) / 1000])
      setFormMessage('Approximate pin added. Coordinates are rounded for privacy.')
    }, () => setFormMessage('Location access was unavailable. Pick a point on the map instead.'),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 })
  }

  const openAdd = () => {
    setFormMessage('')
    if (!user) { setModal('login'); return }
    setModal('add')
  }

  const handleMapPick = latlng => {
    if (!pickMode) return
    if (!inHyderabad(latlng.lat, latlng.lng)) { setNotice('Please choose a point within Hyderabad.'); return }
    setPin([Math.round(latlng.lat * 1000) / 1000, Math.round(latlng.lng * 1000) / 1000])
    setPickMode(false)
    setFormMessage('Approximate pin selected on the map.')
    setModal('add')
  }

  const signIn = async event => {
    event.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    setFormMessage(error ? error.message : 'Check your email for your sign-in link.')
  }

  const addSpot = async event => {
    event.preventDefault()
    if (!pin) { setFormMessage('Choose an approximate location first.'); return }
    setBusy(true)
    const { error } = await supabase.from('charger_spots').insert({
      owner_id: user.id,
      title: form.title.trim(),
      area: form.area.trim(),
      city: 'Hyderabad',
      latitude: pin[0], longitude: pin[1],
      plug_type: form.plug_type,
      hourly_rate: Number(form.hourly_rate)
    })
    setBusy(false)
    if (error) { setFormMessage(error.message); return }
    setModal(null)
    setForm(initialForm)
    setPin(null)
    setNotice('Your spot was saved to the Hyderabad map.')
    loadSpots()
  }

  const removeSpot = async () => {
    if (!selected || selected.owner_id !== user?.id) return
    const { error } = await supabase.from('charger_spots').delete().eq('id', selected.id)
    if (error) setNotice(error.message)
    else { setSelectedId(null); setNotice('Your spot was removed.'); loadSpots() }
  }

  return <>
    <header className="header"><div className="nav container"><a href="#top" className="brand"><span className="brand-icon"><Zap size={19} fill="currentColor" /></span><span>co<span className="brand-dot">.</span>charger</span></a><div className="nav-middle"><span className="city-dot" /> Hyderabad</div><div className="nav-actions"><button className="nav-login" onClick={() => { setFormMessage(''); setModal('login') }}>{user ? 'My account' : 'Log in'}</button><button className="solid small" onClick={openAdd}><Plus size={17}/> Add a spot</button></div></div></header>
    <main id="top" className="container">
      <section className="intro"><div className="intro-copy"><div className="eyebrow"><span/> HYDERABAD PROJECT DEMO</div><h1>Power nearby,<br/><em>when you need it.</em></h1><p>Explore neighbourhood charging cables on a real map. Try your current location to see which spots are closest.</p><div className="intro-actions"><button className="solid" onClick={findMe}><LocateFixed size={18}/> Use my location <ArrowRight size={18}/></button><button className="ghost" onClick={() => document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' })}>Explore the map <Navigation size={17}/></button></div></div><div className="intro-card"><span className="intro-card-spark">✳</span><div className="intro-card-icon"><BatteryCharging size={30}/></div><span className="intro-card-label">CITY IN FOCUS</span><strong>Hyderabad</strong><p>{spots.length} spots on the map <span>•</span> {realCount} community {realCount === 1 ? 'spot' : 'spots'}</p><div className="intro-card-bottom"><span className="pulse"/> Sample hosts are marked as demo</div></div></section>
      <section id="map-section" className="finder"><div className="finder-header"><div><div className="eyebrow"><span/> EXPLORE CHARGERS</div><h2>Find a plug close to you.</h2></div><div className="finder-city"><MapPin size={16}/> Hyderabad only, for now</div></div><div className="finder-tools"><div className="search-box"><Search size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search an area, like Gachibowli" aria-label="Search charger spots"/></div><div className="filter-pills">{['All plugs','Type 2','15A socket','Portable EVSE'].map(option => <button key={option} className={plug === option ? 'pill active' : 'pill'} onClick={() => setPlug(option)}>{option}</button>)}</div><button className="location-quick" onClick={findMe}><Crosshair size={17}/> Near me</button></div>
        {notice && <div className="notice"><CircleHelp size={16}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={14}/></button></div>}
        <div className="finder-grid"><div className="map-wrap"><ChargerMap spots={visible} selectedId={selectedId} onSelect={setSelectedId} userLocation={location} pickMode={pickMode} onPick={handleMapPick}/>{pickMode && <div className="pick-banner"><MapPin size={18}/> Tap the map to place your approximate pin <button onClick={() => { setPickMode(false); setModal('add') }}>Cancel</button></div>}<div className="map-legend"><span className="legend-user"/> You <span className="legend-spot"/> Charger spot</div></div><aside className="spot-panel"><div className="panel-heading"><div><strong>{loading ? 'Loading…' : `${visible.length} ${location ? 'spots nearby' : 'spots in Hyderabad'}`}</strong><small>{location ? 'Sorted by distance from you' : 'Hyderabad neighbourhoods'}</small></div><button onClick={() => { setLocation(null); setSearch(''); setPlug('All plugs'); setSelectedId(null); setNotice('Showing all Hyderabad spots.') }}>Reset</button></div><div className="spots-scroll">{visible.length ? visible.map(spot => <button className={selectedId === spot.id ? 'spot-card selected' : 'spot-card'} key={spot.id} onClick={() => setSelectedId(spot.id)}><span className="spot-card-top"><span className="spot-symbol"><Zap size={18} fill="currentColor" /></span><span className="spot-info"><strong>{spot.title}</strong><small><MapPin size={13}/>{spot.area}, Hyderabad</small></span><span className="spot-rate"><b>{money(spot.hourly_rate)}</b><small>/hr</small></span></span><span className="spot-card-bottom"><span className={spot.is_demo ? 'tag demo' : 'tag live'}>{spot.is_demo ? 'Demo host' : 'Community spot'}</span><span className="plug-label">{spot.plug_type}</span>{spot.distance !== null && <span className="distance">{spot.distance} km away</span>}</span></button>) : <div className="empty"><Search size={26}/><strong>No spots match yet</strong><p>Try another plug type or area.</p></div>}</div>{selected && <div className="selected-detail"><div><span className={selected.is_demo ? 'tag demo' : 'tag live'}>{selected.is_demo ? 'Sample location' : 'Community location'}</span><strong>{selected.title}</strong><p>{selected.plug_type} · {money(selected.hourly_rate)} per hour</p><small>{selected.is_demo ? 'This is a demo host for your project. No one is available to contact here.' : 'Approximate pin. Confirm the exact charging details with the owner.'}</small></div>{selected.owner_id === user?.id && !selected.is_demo && <button className="delete-button" onClick={removeSpot} aria-label="Remove your spot"><Trash2 size={16}/></button>}</div>}</aside></div>
      </section>
      <section className="bottom-strip"><div className="bottom-icon"><ShieldCheck size={22}/></div><div><strong>Simple on purpose.</strong><p>Supabase saves logins and community spot locations. Demo hosts and their hourly rates are just examples. No booking or payment flow.</p></div><button className="text-action" onClick={openAdd}>Add your cable <ArrowRight size={16}/></button></section>
    </main>
    <footer className="footer"><div className="container"><span>co<span className="brand-dot">.</span>charger</span><span>A Hyderabad project demo · Map data © OpenStreetMap contributors</span></div></footer>
    {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><div className="modal" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={19}/></button>{modal === 'login' ? <><span className="modal-icon"><Zap size={21}/></span><h2>{user ? 'Your account' : 'Log in to Co-Charger'}</h2><p>{user ? `Signed in as ${user.email}` : 'Enter your email to get a secure sign-in link. No password needed.'}</p>{user ? <><button className="solid full" onClick={() => { setModal('add'); setFormMessage('') }}>Add my charger spot <ArrowRight size={17}/></button><button className="ghost full" onClick={async () => { await supabase.auth.signOut(); setModal(null) }}>Sign out</button></> : <form onSubmit={signIn}><label>Email address<input required type="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)}/></label><button className="solid full" disabled={busy}>{busy ? 'Sending…' : 'Send sign-in link'} <ArrowRight size={17}/></button></form>}</> : <><span className="modal-icon"><MapPin size={22}/></span><h2>Add your cable spot</h2><p>Just the basics. Your pin is rounded to an approximate location on the public map.</p><form onSubmit={addSpot}><label>Spot name<input required minLength={3} maxLength={80} placeholder="My apartment charging cable" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/></label><label>Hyderabad area<input required minLength={2} maxLength={80} placeholder="e.g. Kondapur" value={form.area} onChange={event => setForm({ ...form, area: event.target.value })}/></label><div className="form-two"><label>Plug type<select value={form.plug_type} onChange={event => setForm({ ...form, plug_type: event.target.value })}><option>15A socket</option><option>Type 2</option><option>Portable EVSE</option></select></label><label>Demo rate / hour (₹)<input required type="number" min="1" max="999" value={form.hourly_rate} onChange={event => setForm({ ...form, hourly_rate: event.target.value })}/></label></div><div className="pin-choice"><div><strong>Approximate pin</strong><small>{pin ? `${pin[0]}, ${pin[1]}` : 'Choose a point in Hyderabad'}</small></div><button type="button" onClick={useMyPin}><LocateFixed size={15}/> Use my location</button><button type="button" onClick={() => { setModal(null); setPickMode(true); setFormMessage('') }}><MapPin size={15}/> Pick on map</button></div><button className="solid full" disabled={busy || !pin}>{busy ? 'Saving…' : 'Save spot'} <Check size={17}/></button></form></>}{formMessage && <div className="form-message">{formMessage}</div>}</div></div>}
  </>
}

createRoot(document.getElementById('root')).render(<App />)
