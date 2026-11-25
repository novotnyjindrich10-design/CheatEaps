/**
 * FOODGO značkové logo — oficiální streetwear artwork (hrnec + FOODGO + BRNO).
 * BRNO je městský identifikátor v artworku; showCity připravuje budoucí varianty.
 */
const LOGO_WEBP = '/brand/foodgo-logo.webp'
const LOGO_PNG = '/brand/foodgo-logo.png'
/** Intrinsic ratio after transparent trim */
const LOGO_RATIO = 746 / 310

export default function Logo({
  height = 48,
  showCity = true,
  className = '',
}) {
  const h = Math.max(28, Number(height) || 42)
  void showCity
  const w = Math.round(h * LOGO_RATIO)

  return (
    <picture className={`foodgo-logo${className ? ` ${className}` : ''}`}>
      <source srcSet={LOGO_WEBP} type="image/webp" />
      <img
        src={LOGO_PNG}
        width={w}
        height={h}
        style={{ width: w, height: h, maxHeight: h }}
        alt=""
        decoding="async"
        draggable={false}
      />
    </picture>
  )
}
