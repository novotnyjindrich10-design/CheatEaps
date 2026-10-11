const DECO_BY_THEME = {
  vegetarianske: ['🥦', '🥬', '🥕', '🥗', '🥒', '🌽'],
  veganske: ['🌱', '🥑', '🍇', '🥙', '🍋', '🌿'],
  pizza: ['🍕', '🍅', '🧀', '🫒', '🍕', '🌿'],
  burger: ['🍔', '🍟', '🧀', '🍔', '🧅', '🥬'],
  kebab: ['🌯', '🌶️', '🥙', '🧄', '🍋', '🌯'],
  cina: ['🥡', '🥟', '🥢', '🥟', '🍜', '🥡'],
  asijske: ['🍜', '🍣', '🥟', '🥢', '🍙', '🍜'],
  mexiko: ['🌮', '🥑', '🌶️', '🌽', '🍋', '🌮'],
  kava: ['☕', '🥐', '🫘', '🧁', '☕', '🥛'],
  sladke: ['🧁', '🍩', '🍰', '🍓', '🍪', '🧁'],
  zdrave: ['🥑', '🥝', '🥗', '🫐', '🥒', '🍋'],
  ceske: ['🍲', '🥨', '🍺', '🥟', '🍞', '🍲'],
  fastfood: ['🍟', '🥤', '🌭', '🍔', '🍿', '🍟'],
}

export default function CategoryDecorations({ theme }) {
  const icons = DECO_BY_THEME[theme]
  if (!icons?.length) return null

  return (
    <div className="category-deco" aria-hidden="true">
      {icons.map((icon, i) => (
        <span key={`${theme}-${i}`} className={`category-deco-item category-deco-item--${i + 1}`}>
          {icon}
        </span>
      ))}
    </div>
  )
}
