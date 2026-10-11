const LABEL = {
  pizza: 'Pizza',
  burger: 'Burger',
  kebab: 'Kebab',
  asijske: 'Miska',
  cina: 'Miska',
  mexiko: 'Taco',
  sladke: 'Dezért',
  zdrave: 'Mísa',
  fastfood: 'Hranolky',
  vegetarianske: 'Salát',
  veganske: 'Mísa',
  ceske: 'Talíř',
  kava: 'Káva',
  neuvedeno: 'Talíř',
}

function Dish({ category }) {
  if (category === 'pizza') {
    return (
      <>
        <circle cx="210" cy="228" r="92" fill="#f3d2b8" />
        <circle cx="210" cy="228" r="78" fill="#e8b089" />
        <circle cx="178" cy="208" r="11" fill="#c84b3a" />
        <circle cx="232" cy="218" r="10" fill="#c84b3a" />
        <circle cx="206" cy="258" r="9" fill="#2f7d4a" />
      </>
    )
  }
  if (category === 'burger') {
    return (
      <>
        <ellipse cx="210" cy="186" rx="78" ry="22" fill="#e2b07a" />
        <rect x="132" y="196" width="156" height="18" rx="6" fill="#3d8f6a" />
        <rect x="132" y="216" width="156" height="28" rx="8" fill="#8b4a32" />
        <ellipse cx="210" cy="262" rx="78" ry="20" fill="#d4a06a" />
      </>
    )
  }
  if (category === 'kava') {
    return (
      <>
        <path
          d="M150 176h108a18 18 0 0118 18v70a48 48 0 01-48 48h-48a48 48 0 01-48-48v-70a18 18 0 0118-18z"
          fill="#8b6b4f"
        />
        <path d="M276 196h22a28 28 0 010 56h-16" fill="none" stroke="#8b6b4f" strokeWidth="12" />
        <path
          d="M176 150c12-22 28-22 40 0"
          fill="none"
          stroke="#c9b8a6"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </>
    )
  }
  if (category === 'asijske' || category === 'cina') {
    return (
      <>
        <ellipse cx="210" cy="250" rx="96" ry="28" fill="#efe6dc" />
        <path d="M114 236c12-52 180-52 192 0" fill="#d7eee3" />
        <path d="M128 236c20-38 144-38 164 0" fill="#3d8f6a" />
      </>
    )
  }
  if (category === 'sladke') {
    return (
      <>
        <ellipse cx="210" cy="268" rx="70" ry="16" fill="#edd6e0" />
        <path d="M150 268c8-88 112-88 120 0" fill="#e8a0b8" />
        <circle cx="210" cy="168" r="14" fill="#c86b8a" />
      </>
    )
  }
  if (category === 'kebab' || category === 'mexiko') {
    return (
      <>
        <path d="M140 168c70-48 140 0 140 0l-28 128H168z" fill="#e8c48a" />
        <path d="M168 210h88l-12 70H180z" fill="#3d8f6a" />
      </>
    )
  }
  if (category === 'zdrave' || category === 'vegetarianske' || category === 'veganske') {
    return (
      <>
        <ellipse cx="210" cy="252" rx="100" ry="26" fill="#e5f0df" />
        <circle cx="178" cy="214" r="28" fill="#4f8f5b" />
        <circle cx="230" cy="206" r="24" fill="#d46a3c" />
        <circle cx="214" cy="240" r="22" fill="#c9a227" />
      </>
    )
  }
  if (category === 'fastfood') {
    return (
      <>
        <rect x="150" y="170" width="22" height="110" rx="8" fill="#e2b44c" />
        <rect x="180" y="158" width="22" height="122" rx="8" fill="#f0c35c" />
        <rect x="210" y="176" width="22" height="104" rx="8" fill="#e2b44c" />
        <rect x="240" y="164" width="22" height="116" rx="8" fill="#d4a43a" />
      </>
    )
  }
  return (
    <>
      <ellipse cx="210" cy="250" rx="100" ry="24" fill="#efe6dc" />
      <ellipse cx="210" cy="228" rx="64" ry="40" fill="#c9a27a" />
    </>
  )
}

export default function CuisineIllustration({ category = 'neuvedeno', className = '' }) {
  const key = LABEL[category] ? category : 'neuvedeno'
  return (
    <svg
      className={`cuisine-illustration ${className}`}
      viewBox="0 0 420 420"
      role="img"
      aria-label={`Ilustrace: ${LABEL[key]}`}
    >
      <rect width="420" height="420" fill="#f6f4ef" rx="40" />
      <circle cx="210" cy="228" r="132" fill="#fff" />
      <circle cx="210" cy="228" r="118" fill="none" stroke="#e7e0d6" strokeWidth="8" />
      <Dish category={key} />
    </svg>
  )
}
