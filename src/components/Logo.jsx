/**
 * FOODGO značkové logo — graffiti artwork (čepice + FOODGO + příbor + BRNO).
 * Velikost řídí CSS (.brand / .footer-logo); zachovává poměr stran.
 */
const LOGO_WEBP = '/brand/foodgo-logo.webp'
const LOGO_PNG = '/brand/foodgo-logo.png'
/** Intrinsic ratio after transparent trim */
export const LOGO_RATIO = 629 / 257

export default function Logo({
  showCity = true,
  className = '',
}) {
  void showCity

  return (
    <picture className={`foodgo-logo${className ? ` ${className}` : ''}`}>
      <source srcSet={LOGO_WEBP} type="image/webp" />
      <img
        src={LOGO_PNG}
        width={629}
        height={257}
        alt=""
        decoding="async"
        draggable={false}
      />
    </picture>
  )
}
