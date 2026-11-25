import { DATA_SOURCE_NOTES } from '../data/sourceNotes'

export default function DataSources() {
  return (
    <details className="data-sources">
      <summary>O datech a zdrojích</summary>
      <ul>
        {DATA_SOURCE_NOTES.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </details>
  )
}
