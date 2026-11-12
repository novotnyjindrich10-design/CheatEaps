import { BRAND_CITY as BRAND } from '../constants/brand.js'

const PAGES = {
  '/': {
    title: 'FoodGo Brno — kde se najíst v Brně podle chuti a rozpočtu',
    description:
      'Kde se najíst v Brně: katalog restaurací, kaváren a rychlého občerstvení. Filtruj podle kategorie, ověřené ceny, vzdálenosti a studentských slev.',
  },
  '/results': {
    title: 'Výsledky hledání | FoodGo Brno',
    description: 'Levné restaurace a podniky v Brně podle kategorie, ceny, diety a vzdálenosti. Ověřené ceny oddělujeme od odhadů.',
  },
  '/oblibene': {
    title: 'Oblíbené | FoodGo Brno',
    description: 'Restaurace uložené v prohlížeči nebo k účtu FoodGo.',
    robots: 'noindex, nofollow',
  },
  '/nevim-co-jist': {
    title: 'Nevím, co jíst | FoodGo Brno',
    description: 'Náhodný tip na restauraci v Brně podle ceny, kategorie a vzdálenosti.',
  },
  '/porovnani': {
    title: 'Porovnání podniků | FoodGo Brno',
    description: 'Porovnání až tří podniků z katalogu FoodGo podle ceny, lokality a doložené nabídky.',
    robots: 'noindex',
  },
  '/odmeny': {
    title: 'Slevy a body | FoodGo Brno',
    description: 'Slevy nalezené u oficiálních zdrojů a stav věrnostních bodů FoodGo.',
    robots: 'noindex, nofollow',
  },
  '/pro-podniky': {
    title: 'Pro podniky | FoodGo Brno',
    description: 'Placené balíčky propagace pro podniky v Brně. Hledání restaurací zůstává zdarma.',
  },
  '/podpor-me': {
    title: 'Podpoř FoodGo Brno',
    description: 'Dobrovolná podpora katalogu FoodGo Brno.',
  },
  '/ochrana-osobnich-udaju': {
    title: 'Ochrana osobních údajů | FoodGo Brno',
    description: 'Jak FoodGo Brno pracuje s účtem, recenzemi a polohou v prohlížeči.',
  },
  '/obchodni-podminky': {
    title: 'Obchodní podmínky | FoodGo Brno',
    description: 'Podmínky používání katalogu FoodGo Brno. Text není právní posudek.',
  },
  '/prihlaseni': {
    title: 'Přihlášení | FoodGo Brno',
    description: 'Přihlášení k účtu FoodGo.',
    robots: 'noindex',
  },
  '/registrace': {
    title: 'Registrace | FoodGo Brno',
    description: 'Založení účtu FoodGo.',
    robots: 'noindex',
  },
  '/nove-heslo': {
    title: 'Nové heslo | FoodGo Brno',
    description: 'Nastavení nového hesla k účtu FoodGo.',
    robots: 'noindex',
  },
}

export function metaForPath(pathname) {
  const path = String(pathname || '/').split('?')[0] || '/'
  if (path.startsWith('/nabidka/')) {
    return {
      title: `Nabídka | ${BRAND}`,
      description: 'Detail slevy FoodGo. Kód je až po přihlášení.',
      path,
      robots: 'noindex, nofollow',
    }
  }
  if (path.startsWith('/admin')) {
    return {
      title: `Administrace | ${BRAND}`,
      description: 'Interní správa FoodGo.',
      path,
      robots: 'noindex, nofollow',
    }
  }
  if (path.startsWith('/restaurant/')) {
    return {
      title: `Podnik | ${BRAND}`,
      description: 'Detail podniku v katalogu FoodGo Brno.',
      path,
      robots: '',
    }
  }
  const known = PAGES[path]
  if (!known) {
    return {
      title: `Stránka nenalezena | ${BRAND}`,
      description: 'Tahle adresa v FoodGo není.',
      path,
      robots: 'noindex',
    }
  }
  return { path, robots: '', ...known }
}

function setNamed(selector, create, value) {
  let node = document.head.querySelector(selector)
  if (!node) {
    node = create()
    document.head.appendChild(node)
  }
  if (node.tagName === 'TITLE') node.textContent = value
  else if (node.tagName === 'LINK') node.setAttribute('href', value)
  else node.setAttribute('content', value)
}

export function applyPageMeta(meta) {
  if (typeof document === 'undefined' || !meta) return
  document.title = meta.title
  setNamed('meta[name="description"]', () => {
    const el = document.createElement('meta')
    el.setAttribute('name', 'description')
    return el
  }, meta.description)
  setNamed('meta[property="og:title"]', () => {
    const el = document.createElement('meta')
    el.setAttribute('property', 'og:title')
    return el
  }, meta.title)
  setNamed('meta[property="og:description"]', () => {
    const el = document.createElement('meta')
    el.setAttribute('property', 'og:description')
    return el
  }, meta.description)
  setNamed('meta[property="og:type"]', () => {
    const el = document.createElement('meta')
    el.setAttribute('property', 'og:type')
    return el
  }, 'website')
  const robots = meta.robots || 'index,follow'
  setNamed('meta[name="robots"]', () => {
    const el = document.createElement('meta')
    el.setAttribute('name', 'robots')
    return el
  }, robots)
  if (typeof location !== 'undefined' && location.origin) {
    const url = `${location.origin}${meta.path || '/'}`
    setNamed('link[rel="canonical"]', () => {
      const el = document.createElement('link')
      el.setAttribute('rel', 'canonical')
      return el
    }, url)
    setNamed('meta[property="og:url"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('property', 'og:url')
      return el
    }, url)
    const image =
      meta.image && String(meta.image).startsWith(location.origin)
        ? meta.image
        : meta.image && String(meta.image).startsWith('/')
          ? `${location.origin}${meta.image}`
          : `${location.origin}/logo-mark.png`
    setNamed('meta[property="og:image"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('property', 'og:image')
      return el
    }, image)
    setNamed('meta[name="twitter:card"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('name', 'twitter:card')
      return el
    }, 'summary_large_image')
    setNamed('meta[name="twitter:title"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('name', 'twitter:title')
      return el
    }, meta.title)
    setNamed('meta[name="twitter:description"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('name', 'twitter:description')
      return el
    }, meta.description)
    setNamed('meta[name="twitter:image"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('name', 'twitter:image')
      return el
    }, image)
  }
}
