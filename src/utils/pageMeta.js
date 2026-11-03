const BRAND = 'CheapEats Brno'

const PAGES = {
  '/': {
    title: 'CheapEats Brno — jídlo podle chuti a rozpočtu',
    description:
      'Katalog restaurací, kaváren a rychlého občerstvení v Brně. Hledej podle kategorie, ověřené ceny a vzdálenosti.',
  },
  '/results': {
    title: 'Výsledky hledání | CheapEats Brno',
    description: 'Filtrovaný seznam podniků v Brně podle kategorie, ceny, diety a vzdálenosti.',
  },
  '/oblibene': {
    title: 'Oblíbené | CheapEats Brno',
    description: 'Restaurace uložené k účtu CheapEats.',
  },
  '/porovnani': {
    title: 'Porovnání podniků | CheapEats Brno',
    description: 'Porovnání až tří podniků z katalogu CheapEats podle ceny, lokality a doložené nabídky.',
    robots: 'noindex',
  },
  '/odmeny': {
    title: 'Slevy a body | CheapEats Brno',
    description: 'Slevy nalezené u oficiálních zdrojů a stav věrnostních bodů CheapEats.',
  },
  '/pro-podniky': {
    title: 'Pro podniky | CheapEats Brno',
    description: 'Žádost o přidání provozovny do katalogu CheapEats Brno.',
  },
  '/podpor-me': {
    title: 'Podpoř CheapEats Brno',
    description: 'Dobrovolná podpora katalogu CheapEats Brno.',
  },
  '/ochrana-osobnich-udaju': {
    title: 'Ochrana osobních údajů | CheapEats Brno',
    description: 'Jak CheapEats Brno pracuje s účtem, recenzemi a polohou v prohlížeči.',
  },
  '/obchodni-podminky': {
    title: 'Obchodní podmínky | CheapEats Brno',
    description: 'Podmínky používání katalogu CheapEats Brno. Text není právní posudek.',
  },
  '/prihlaseni': {
    title: 'Přihlášení | CheapEats Brno',
    description: 'Přihlášení k účtu CheapEats.',
    robots: 'noindex',
  },
  '/registrace': {
    title: 'Registrace | CheapEats Brno',
    description: 'Založení účtu CheapEats.',
    robots: 'noindex',
  },
  '/nove-heslo': {
    title: 'Nové heslo | CheapEats Brno',
    description: 'Nastavení nového hesla k účtu CheapEats.',
    robots: 'noindex',
  },
}

export function metaForPath(pathname) {
  const path = String(pathname || '/').split('?')[0] || '/'
  if (path.startsWith('/admin')) {
    return {
      title: `Administrace | ${BRAND}`,
      description: 'Interní správa CheapEats.',
      path,
      robots: 'noindex, nofollow',
    }
  }
  if (path.startsWith('/restaurant/')) {
    return {
      title: `Podnik | ${BRAND}`,
      description: 'Detail podniku v katalogu CheapEats Brno.',
      path,
      robots: '',
    }
  }
  const known = PAGES[path]
  if (!known) {
    return {
      title: `Stránka nenalezena | ${BRAND}`,
      description: 'Tahle adresa v CheapEats není.',
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
  else if (node.hasAttribute('href')) node.setAttribute('href', value)
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
    setNamed('meta[property="og:image"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('property', 'og:image')
      return el
    }, `${location.origin}/logo-mark.png`)
  }
}
