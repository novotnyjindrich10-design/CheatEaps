/** Typografické logo FOODGO — čitelné i na malém mobilu. */
export default function Logo({ size = 40, withWordmark = false, tone = 'brand' }) {
  const mark = Math.max(28, Number(size) || 40)
  const fill = tone === 'inverse' ? '#ffffff' : '#0f7a4c'
  const accent = tone === 'inverse' ? '#8cff4a' : '#12b37a'

  return (
    <span className={`foodgo-logo${withWordmark ? ' foodgo-logo--word' : ''}`} aria-hidden="true">
      <svg
        className="foodgo-logo-mark"
        width={mark}
        height={mark}
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        <rect width="40" height="40" rx="10" fill={fill} />
        <path
          d="M20 8.5c-5.2 0-9.4 4-9.4 9 0 6.6 7.7 13.7 8.7 14.6a1 1 0 0 0 1.4 0c1-0.9 8.7-8 8.7-14.6 0-5-4.2-9-9.4-9zm0 12.2a3.4 3.4 0 1 1 0-6.8 3.4 3.4 0 0 1 0 6.8z"
          fill={accent}
        />
      </svg>
      {withWordmark ? (
        <svg
          className="foodgo-logo-word"
          viewBox="0 0 148 28"
          height={Math.round(mark * 0.55)}
          xmlns="http://www.w3.org/2000/svg"
          focusable="false"
        >
          <text
            x="0"
            y="22"
            fontFamily="Segoe UI, Helvetica Neue, Arial, sans-serif"
            fontSize="24"
            fontWeight="800"
            letterSpacing="1.6"
            fill={fill}
          >
            FOODGO
          </text>
        </svg>
      ) : null}
    </span>
  )
}
