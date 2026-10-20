import React from 'react'

export default function Logo({ footer = false }) {
  return <span className={footer ? 'brand-lockup brand-lockup-footer' : 'brand-lockup'}>
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none" focusable="false">
        <path d="M27.9 10.6A13.7 13.7 0 1 0 27.9 29.4" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
        <path d="M25.8 15.7H32.4M25.8 24.3H32.4" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
        <path d="M18.7 13.5 15.1 21h5.1l-1.3 5.5 6-8h-5.1l1.4-5Z" fill="currentColor" />
      </svg>
    </span>
    <span className="brand-word">co<span className="brand-dot">.</span>charger</span>
  </span>
}
