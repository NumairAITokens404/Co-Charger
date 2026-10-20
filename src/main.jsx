import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { ArrowRight, ChevronDown, Moon, Sun, Check, CircleHelp, Crosshair, LocateFixed, MapPin, Navigation, Plus, Search, Trash2, UserRound, X, Zap } from 'lucide-react'
import ChargerMap, { inIndiaCoverage } from './Map'
import CarScene from './CarScene'
import Logo from './Logo'
import { supabase } from './supabase'
import './style.css'

const kmBetween = (a, b, c, d) => {
  const rad = Math.PI / 180
  const x = Math.sin((c-a)*rad/2)**2 + Math.cos(a*rad)*Math.cos(c*rad)*Math.sin((d-b)*rad/2)**2
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)) * 10) / 10
}
const money = value => `₹${Number(value).toLocaleString('en-IN')}`
const initialForm = { title: '', area: '', city: '', plug_type: '15A socket', hourly_rate: '80' }
const emptyProfile = { first_name: '', last_name: '', phone_digits: '', address: '' }
const phoneDigits = value => {
  const digits = value.replace(/\D/g, '')
  return (digits.length > 10 && digits.startsWith('91') ? digits.slice(2) : digits).slice(0, 10)
}
const locationError = error => {
  if (error?.code === 1) return 'Location permission was denied. Allow it in your browser settings, or choose a point on the map.'
  if (error?.code === 2) return 'Your device could not determine its location. Choose a point on the map instead.'
  if (error?.code === 3) return 'Finding your location timed out. Try again or choose a point on the map.'
  return 'Your browser could not share a location. Choose a point on the map instead.'
}

function ProfileFields({ draft, setDraft, onSave, onSignOut, busy, loading }) {
  if (loading) return <p>Loading your details…</p>
  return <>
    <form className="profile-form" onSubmit={onSave}>
      <div className="form-two">
        <label>First name<input required maxLength={60} autoComplete="given-name" value={draft.first_name} onChange={event => setDraft({ ...draft, first_name: event.target.value })}/></label>
        <label>Last name<input required maxLength={60} autoComplete="family-name" value={draft.last_name} onChange={event => setDraft({ ...draft, last_name: event.target.value })}/></label>
      </div>
      <label>Phone number<div className="phone-input"><span>+91</span><input required type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]{10}" title="Enter exactly 10 digits" placeholder="10-digit number" value={draft.phone_digits} onChange={event => setDraft({ ...draft, phone_digits: phoneDigits(event.target.value) })}/></div></label>
      <label>Address<textarea required minLength={5} maxLength={300} rows={3} autoComplete="street-address" placeholder="House / flat, street, area, city, PIN code" value={draft.address} onChange={event => setDraft({ ...draft, address: event.target.value })}/></label>
      <p className="profile-privacy">Your phone number and address stay private. Charger spots show only an approximate map pin.</p>
      <button className="solid full" disabled={busy}>{busy ? 'Saving…' : 'Save details'} <Check size={17}/></button>
    </form>
    <button className="ghost full" onClick={onSignOut}>Sign out</button>
  </>
}

function App() {
  const [dark, setDark] = useState(() => {
    try { return (localStorage.getItem('cocharger-theme') || 'dark') === 'dark' } catch { return true }
  })
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try { localStorage.setItem('cocharger-theme', dark ? 'dark' : 'light') } catch {}
  }, [dark])
  const toggleTheme = () => {
    const changeTheme = () => flushSync(() => setDark(current => !current))
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      changeTheme()
      return
    }
    document.startViewTransition(changeTheme)
  }
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileDraft, setProfileDraft] = useState(emptyProfile)
  const [profileLoading, setProfileLoading] = useState(false)
  const [spots, setSpots] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [plug, setPlug] = useState('All plugs')
  const [location, setLocation] = useState(null)
  const [locationSource, setLocationSource] = useState(null)
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(null)
  const [email, setEmail] = useState('')
  const [form, setForm] = useState(initialForm)
  const [pin, setPin] = useState(null)
  const [pickMode, setPickMode] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formMessage, setFormMessage] = useState('')

  const loadSpots = async () => {
    if (!supabase) { setLoading(false); setNotice('Supabase is not configured.'); return }
    const { data, error } = await supabase.from('charger_spots')
      .select('id,owner_id,title,area,city,latitude,longitude,plug_type,hourly_rate,is_demo')
      .order('city')
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

  useEffect(() => {
    let active = true
    if (!user?.id) {
      setProfile(null)
      setProfileDraft(emptyProfile)
      return
    }
    setProfile(null)
    setProfileDraft(emptyProfile)
    setProfileLoading(true)
    supabase.from('user_profiles')
      .select('first_name,last_name,phone_number,address')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setNotice(`Could not load your profile: ${error.message}`)
        else if (data) {
          setProfile(data)
          setProfileDraft({
            first_name: data.first_name,
            last_name: data.last_name,
            phone_digits: data.phone_number.slice(3),
            address: data.address
          })
        } else setModal(current => current ?? 'login')
        setProfileLoading(false)
      })
    return () => { active = false }
  }, [user?.id])

  const sorted = useMemo(() => spots.map(spot => ({
    ...spot,
    distance: location ? kmBetween(location[0], location[1], Number(spot.latitude), Number(spot.longitude)) : null
  })).filter(spot => {
    const text = `${spot.title} ${spot.area} ${spot.city}`.toLowerCase()
    return text.includes(search.toLowerCase()) && (plug === 'All plugs' || spot.plug_type === plug)
  }).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.area.localeCompare(b.area)), [spots, location, search, plug])

  const visible = location ? sorted.filter(spot => spot.distance <= 15) : sorted
  const selected = visible.find(spot => spot.id === selectedId) || null

  const findMe = () => {
    if (!navigator.geolocation) { setNotice('This browser cannot provide a location. Choose a point on the map instead.'); return }
    setNotice('Finding your location…')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (!inIndiaCoverage(coords.latitude, coords.longitude)) {
        setLocation(null)
        setLocationSource(null)
        setNotice('Your location is outside our India map coverage. Choose a point in India to explore.')
        return
      }
      setLocation([coords.latitude, coords.longitude])
      setLocationSource('gps')
      setNotice('Showing spots within 15 km of your current location.')
    }, error => setNotice(locationError(error)),
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 })
  }

  const chooseOnMap = () => {
    setPickMode('browse')
    setNotice('Tap a point in India on the map to find spots within 15 km of it.')
    document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  const useMyPin = () => {
    if (!navigator.geolocation) { setFormMessage('Location is unavailable. Pick a point on the map instead.'); return }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (!inIndiaCoverage(coords.latitude, coords.longitude)) { setFormMessage('Please choose a location within India.'); return }
      setPin([Math.round(coords.latitude * 1000) / 1000, Math.round(coords.longitude * 1000) / 1000])
      setFormMessage('Approximate pin added. Coordinates are rounded for privacy.')
    }, error => setFormMessage(locationError(error)),
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 })
  }

  const openAdd = () => {
    setFormMessage('')
    if (!user) { setModal('login'); return }
    if (!profile) { setFormMessage('Save your details before adding a charger spot.'); setModal('login'); return }
    setModal('add')
  }

  const handleMapPick = latlng => {
    if (!pickMode) return
    if (!inIndiaCoverage(latlng.lat, latlng.lng)) { setNotice('Please choose a point within India.'); return }
    if (pickMode === 'browse') {
      setLocation([latlng.lat, latlng.lng])
      setLocationSource('map')
      setSelectedId(null)
      setPickMode(null)
      setNotice('Showing spots within 15 km of the point you chose.')
      return
    }
    setPin([Math.round(latlng.lat * 1000) / 1000, Math.round(latlng.lng * 1000) / 1000])
    setPickMode(null)
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

  const saveProfile = async event => {
    event.preventDefault()
    const first_name = profileDraft.first_name.trim()
    const last_name = profileDraft.last_name.trim()
    const address = profileDraft.address.trim()
    if (!first_name || !last_name || !/^\d{10}$/.test(profileDraft.phone_digits) || address.length < 5) {
      setFormMessage('Add your name, a 10-digit Indian phone number, and your address.')
      return
    }
    setBusy(true)
    const details = { first_name, last_name, phone_number: `+91${profileDraft.phone_digits}`, address }
    const { error } = await supabase.from('user_profiles').upsert({ id: user.id, ...details, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    setBusy(false)
    if (error) { setFormMessage(error.message); return }
    setProfile(details)
    setProfileDraft({ first_name, last_name, phone_digits: profileDraft.phone_digits, address })
    setFormMessage('Your details were saved.')
  }

  const addSpot = async event => {
    event.preventDefault()
    if (!pin) { setFormMessage('Choose an approximate location first.'); return }
    setBusy(true)
    const { error } = await supabase.from('charger_spots').insert({
      owner_id: user.id,
      title: form.title.trim(),
      area: form.area.trim(),
      city: form.city.trim(),
      latitude: pin[0], longitude: pin[1],
      plug_type: form.plug_type,
      hourly_rate: Number(form.hourly_rate)
    })
    setBusy(false)
    if (error) { setFormMessage(error.message); return }
    setModal(null)
    setForm(initialForm)
    setPin(null)
    setNotice('Your spot was saved to the India map.')
    loadSpots()
  }

  const removeSpot = async () => {
    if (!selected || selected.owner_id !== user?.id) return
    const { error } = await supabase.from('charger_spots').delete().eq('id', selected.id)
    if (error) setNotice(error.message)
    else { setSelectedId(null); setNotice('Your spot was removed.'); loadSpots() }
  }

  return <>
    <header className="header"><div className="nav container"><a href="#top" className="brand" aria-label="Co-Charger home"><Logo /></a><div className="nav-actions"><button className="theme-toggle" onClick={toggleTheme} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Switch to light mode" : "Switch to dark mode"}>{dark ? <Sun size={19}/> : <Moon size={19}/>}</button><button className="solid small" onClick={openAdd}><Plus size={17}/> Add a spot</button><button className="nav-profile" onClick={() => { setFormMessage(''); setModal('login') }}><span className="profile-avatar"><UserRound size={17}/></span><span className="profile-name">{user ? (profile?.first_name || 'Profile') : 'Log in'}</span><ChevronDown className="profile-chevron" size={14}/></button></div></div></header>
    <main id="top" className="container">
      <section className="intro"><div className="hero-visual"><h1 className="hero-lines"><span className="hero-left">Find<br/>power.</span><span className="hero-center">KEEP MOVING</span><span className="hero-right">Drive<br/>farther.</span></h1><CarScene dark={dark}/></div><div className="intro-copy"><p>Find a little extra power, anywhere in India. Try your current location to see which spots are closest.</p><div className="intro-actions"><button className="solid" onClick={findMe}><LocateFixed size={18}/> Use my location <ArrowRight size={18}/></button><button className="ghost" onClick={() => document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' })}>Explore the map <Navigation size={17}/></button></div></div></section>
      <section id="map-section" className="finder"><div className="finder-header"><div><h2>Find a plug close to you.</h2></div></div><div className="finder-tools"><div className="search-box"><Search size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search a city or area, like Mumbai" aria-label="Search charger spots"/></div><div className="filter-pills">{['All plugs','Type 2','15A socket','Portable EVSE'].map(option => <button key={option} className={plug === option ? 'pill active' : 'pill'} onClick={() => setPlug(option)}>{option}</button>)}</div><button className="location-quick" onClick={findMe}><Crosshair size={17}/> Near me</button><button className="location-quick" onClick={chooseOnMap}><MapPin size={17}/> Choose on map</button></div>
        {notice && <div className="notice"><CircleHelp size={16}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={14}/></button></div>}
        <div className="finder-grid"><div className="map-wrap"><ChargerMap spots={visible} selectedId={selectedId} onSelect={setSelectedId} userLocation={location} locationSource={locationSource} pickMode={pickMode} onPick={handleMapPick}/>{pickMode && <div className="pick-banner"><MapPin size={18}/> {pickMode === 'browse' ? 'Tap the map to choose where to search' : 'Tap the map to place your approximate pin'} <button onClick={() => { const wasHost = pickMode === 'host'; setPickMode(null); if (wasHost) setModal('add') }}>Cancel</button></div>}<div className="map-legend"><span className="legend-user"/> {locationSource === 'map' ? 'Chosen point' : 'You'} <span className="legend-spot"/> Charger spot</div></div><aside className="spot-panel"><div className="panel-heading"><div><strong>{loading ? 'Loading…' : `${visible.length} ${location ? 'spots nearby' : 'spots across India'}`}</strong><small>{location ? `Sorted by distance from ${locationSource === 'map' ? 'chosen point' : 'you'}` : 'Demo & community locations across India'}</small></div><button onClick={() => { setLocation(null); setLocationSource(null); setSearch(''); setPlug('All plugs'); setSelectedId(null); setNotice('Showing all spots across India.') }}>Reset</button></div><div className="spots-scroll">{visible.length ? visible.map(spot => <button className={selectedId === spot.id ? 'spot-card selected' : 'spot-card'} key={spot.id} onClick={() => setSelectedId(spot.id)}><span className="spot-card-top"><span className="spot-symbol"><Zap size={18} fill="currentColor" /></span><span className="spot-info"><strong>{spot.title}</strong><small><MapPin size={13}/>{spot.area}, {spot.city}</small></span><span className="spot-rate"><b>{money(spot.hourly_rate)}</b><small>/hr</small></span></span><span className="spot-card-bottom"><span className={spot.is_demo ? 'tag demo' : 'tag live'}>{spot.is_demo ? 'Demo host' : 'Community spot'}</span><span className="plug-label">{spot.plug_type}</span>{spot.distance !== null && <span className="distance">{spot.distance} km away</span>}</span></button>) : <div className="empty"><Search size={26}/><strong>No spots match yet</strong><p>Try another city or area, or reset to explore India.</p></div>}</div>{selected && <div className="selected-detail"><div><span className={selected.is_demo ? 'tag demo' : 'tag live'}>{selected.is_demo ? 'Sample location' : 'Community location'}</span><strong>{selected.title}</strong><p>{selected.plug_type} · {money(selected.hourly_rate)} per hour</p><small>{selected.is_demo ? 'This is a demo host for your project. No one is available to contact here.' : 'Approximate pin. Confirm the exact charging details with the owner.'}</small></div>{selected.owner_id === user?.id && !selected.is_demo && <button className="delete-button" onClick={removeSpot} aria-label="Remove your spot"><Trash2 size={16}/></button>}</div>}</aside></div>
      </section>

    </main>
    <footer className="footer"><div className="container"><a href="#top" className="brand footer-brand" aria-label="Co-Charger home"><Logo footer /></a><span>A community charging project for India · Map data © OpenStreetMap contributors</span></div></footer>
    {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><div className="modal" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={19}/></button>{modal === 'login' ? <><span className="modal-icon"><Zap size={21}/></span><h2>{user ? 'Your account' : 'Log in to Co-Charger'}</h2><p>{user ? `Signed in as ${user.email}` : 'Enter your email to get a secure sign-in link. No password needed.'}</p>{user ? <ProfileFields draft={profileDraft} setDraft={setProfileDraft} onSave={saveProfile} onSignOut={async () => { await supabase.auth.signOut(); setModal(null) }} busy={busy} loading={profileLoading}/> : <form onSubmit={signIn}><label>Email address<input required type="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)}/></label><button className="solid full" disabled={busy}>{busy ? 'Sending…' : 'Send sign-in link'} <ArrowRight size={17}/></button></form>}</> : <><span className="modal-icon"><MapPin size={22}/></span><h2>Add your cable spot</h2><p>Just the basics. Your pin is rounded to an approximate location on the public map.</p><form onSubmit={addSpot}><label>Spot name<input required minLength={3} maxLength={80} placeholder="My apartment charging cable" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/></label><label>City<input required minLength={2} maxLength={80} placeholder="e.g. Mumbai" value={form.city} onChange={event => setForm({ ...form, city: event.target.value })}/></label><label>Area / neighbourhood<input required minLength={2} maxLength={80} placeholder="e.g. Kondapur" value={form.area} onChange={event => setForm({ ...form, area: event.target.value })}/></label><div className="form-two"><label>Plug type<select value={form.plug_type} onChange={event => setForm({ ...form, plug_type: event.target.value })}><option>15A socket</option><option>Type 2</option><option>Portable EVSE</option></select></label><label>Demo rate / hour (₹)<input required type="number" min="1" max="999" value={form.hourly_rate} onChange={event => setForm({ ...form, hourly_rate: event.target.value })}/></label></div><div className="pin-choice"><div><strong>Approximate pin</strong><small>{pin ? `${pin[0]}, ${pin[1]}` : 'Choose a point in India'}</small></div><button type="button" onClick={useMyPin}><LocateFixed size={15}/> Use my location</button><button type="button" onClick={() => { setModal(null); setPickMode('host'); setFormMessage('') }}><MapPin size={15}/> Pick on map</button></div><button className="solid full" disabled={busy || !pin}>{busy ? 'Saving…' : 'Save spot'} <Check size={17}/></button></form></>}{formMessage && <div className="form-message">{formMessage}</div>}</div></div>}
  </>
}

createRoot(document.getElementById('root')).render(<App />)
