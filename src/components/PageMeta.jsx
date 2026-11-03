import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { applyPageMeta, metaForPath } from '../utils/pageMeta'

export default function PageMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname.startsWith('/restaurant/')) return
    applyPageMeta(metaForPath(pathname))
  }, [pathname])

  return null
}
