import { getCategoryMeta } from '../constants/filters'

export default function BusinessPreview({ answers }) {
  const category = getCategoryMeta(answers.category)
  const photo = answers.photo?.dataUrl

  return (
    <article className="biz-preview" aria-label="Náhled podniku">
      <p className="biz-preview-tag">Nově přidaný podnik · ještě není veřejný</p>
      <div className="biz-preview-media">
        {photo ? (
          <img src={photo} alt={`Náhled fotografie – ${answers.businessName}`} />
        ) : (
          <div className="biz-preview-placeholder">Bez fotografie</div>
        )}
      </div>
      <div className="biz-preview-body">
        <h3>{answers.businessName || 'Název podniku'}</h3>
        <p className="biz-preview-meta">
          {[category?.label || answers.categoryLabel, answers.address || answers.locality]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="biz-preview-desc">{answers.description || 'Popis zatím chybí.'}</p>
      </div>
    </article>
  )
}
