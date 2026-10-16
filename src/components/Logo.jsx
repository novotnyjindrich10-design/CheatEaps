export default function Logo({ size = 40 }) {
  return (
    <img
      src="/logo-mark.png"
      alt=""
      width={size}
      height={size}
      draggable={false}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  )
}
