import { createContext, useContext, useMemo, useState } from 'react'
import { cleanCompareIds, nextCompareIds } from '../utils/compareSelection.js'

const STORAGE_KEY = 'cheapeats.compare.v1'
const CompareContext = createContext(null)

function readIds() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return cleanCompareIds(raw ? JSON.parse(raw) : [])
  } catch {
    return []
  }
}

function writeIds(ids) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* soukromý režim */
  }
}

export function CompareProvider({ children }) {
  const [ids, setIds] = useState(readIds)
  const [notice, setNotice] = useState('')

  const api = useMemo(
    () => ({
      ids,
      notice,
      has: (id) => ids.includes(id),
      toggle(id) {
        const next = nextCompareIds(ids, id)
        setIds(next.ids)
        writeIds(next.ids)
        setNotice(next.notice)
      },
      remove(id) {
        const next = ids.filter((item) => item !== id)
        setIds(next)
        writeIds(next)
        setNotice('')
      },
      clear() {
        setIds([])
        writeIds([])
        setNotice('')
      },
    }),
    [ids, notice],
  )

  return <CompareContext.Provider value={api}>{children}</CompareContext.Provider>
}

export function useCompare() {
  return (
    useContext(CompareContext) || {
      ids: [],
      notice: '',
      has: () => false,
      toggle() {},
      remove() {},
      clear() {},
    }
  )
}
