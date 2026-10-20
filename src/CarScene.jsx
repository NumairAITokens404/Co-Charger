import React from 'react'

const lamps = [[314, 448], [440, 470], [1226, 470], [1352, 448]]

export default function CarScene({ dark }) {
  return (
    <div className={`car-stage ${dark ? 'lights-on' : ''}`} role="img" aria-label={`Front of a BMW i7, headlights ${dark ? 'on' : 'off'}`}>
      <div className="car-halo" aria-hidden="true" />
      <div className="car-floor" aria-hidden="true" />
      <img className="car-front" src="/bmw-i7-front.png" alt="" width="1666" height="944" fetchPriority="high" />
      <svg className="beam-svg" viewBox="0 0 1666 944" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="forward-glare">
            <stop stopColor="#ffffff" stopOpacity=".52" />
            <stop offset=".13" stopColor="#eafaff" stopOpacity=".30" />
            <stop offset=".48" stopColor="#b4e9ff" stopOpacity=".10" />
            <stop offset="1" stopColor="#b4e9ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lamp-glow">
            <stop stopColor="#ffffff" stopOpacity="1" />
            <stop offset=".2" stopColor="#f3fcff" stopOpacity=".94" />
            <stop offset=".56" stopColor="#c7efff" stopOpacity=".42" />
            <stop offset="1" stopColor="#c7efff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="lens-streak">
            <stop stopColor="#d8f5ff" stopOpacity="0" />
            <stop offset=".5" stopColor="#ffffff" stopOpacity=".7" />
            <stop offset="1" stopColor="#d8f5ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {lamps.map(([x, y]) => (
          <g key={x}>
            <ellipse cx={x} cy={y} rx="300" ry="250" fill="url(#forward-glare)" opacity=".48" />
            <ellipse cx={x} cy={y} rx="126" ry="75" fill="url(#lamp-glow)" opacity=".72" />
            <ellipse cx={x} cy={y} rx="69" ry="24" fill="url(#lamp-glow)" />
            <rect x={x - 108} y={y - 1.5} width="216" height="3" fill="url(#lens-streak)" opacity=".7" />
            <ellipse cx={x} cy={y} rx="26" ry="7" fill="#ffffff" opacity=".88" />
          </g>
        ))}
      </svg>
    </div>
  )
}
