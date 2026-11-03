export default function OperatorSlot({ title, children }) {
  return (
    <section className="legal-gap">
      <p className="legal-gap-label">Doplní provozovatel</p>
      <h2>{title}</h2>
      {children}
    </section>
  )
}
