import { useId } from 'react'

export default function Logo({ size = 40 }) {
  const uid = useId().replace(/:/g, '')
  const fill = `ce-fill-${uid}`
  const glow = `ce-glow-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fill} x1="10" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8CFF4A" />
          <stop offset="1" stopColor="#00D4B5" />
        </linearGradient>
        <filter id={glow} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="48" height="48" rx="13" fill="#0c1411" />
      <path
        d="M24 6.2c-7.4 0-13.4 5.8-13.4 13.1 0 9.2 13.4 22.5 13.4 22.5S37.4 28.5 37.4 19.3C37.4 12 31.4 6.2 24 6.2z"
        fill={`url(#${fill})`}
        filter={`url(#${glow})`}
      />
      <circle cx="24" cy="19.2" r="8.6" fill="#07140f" />
      <g fill={`url(#${fill})`}>
        <rect x="19.1" y="13.4" width="1.55" height="7.2" rx="0.7" />
        <rect x="21.15" y="13.4" width="1.55" height="7.2" rx="0.7" />
        <path d="M19.1 20.5h3.6v3.4c0 .7-.55 1.25-1.25 1.25h-1.1c-.7 0-1.25-.55-1.25-1.25v-3.4z" />
        <rect x="26.9" y="13.4" width="1.7" height="11.7" rx="0.8" />
        <path d="M26.9 13.4c2.2 0 3.4 1.15 3.4 2.7 0 1.55-1.2 2.5-3.4 2.5v-5.2z" />
      </g>
      <path
        d="M37.2 7.2l.85 1.85 1.95.4-1.5 1.35.45 1.95-1.75-.95-1.75.95.45-1.95-1.5-1.35 1.95-.4z"
        fill={`url(#${fill})`}
      />
    </svg>
  )
}
