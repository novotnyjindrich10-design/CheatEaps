/**
 * Denní období pro relevantnější tipy na úvodu.
 * @returns {{ id: string, title: string, hint: string, category?: string, preferOpen: boolean }}
 */
export function mealPeriodForHour(hour = new Date().getHours()) {
  const h = Number(hour)
  if (!Number.isFinite(h)) {
    return { id: 'day', title: 'Doporučené podniky', hint: 'Nejlíp zdokumentované podniky z různých kuchyní.', preferOpen: true }
  }
  if (h >= 6 && h < 11) {
    return {
      id: 'morning',
      title: 'Ráno kolem tebe',
      hint: 'Kavárny a snídaně — jen podniky, u kterých umíme číst otevírací dobu.',
      category: 'kava',
      preferOpen: true,
    }
  }
  if (h >= 11 && h < 15) {
    return {
      id: 'lunch',
      title: 'Oběd v okolí',
      hint: 'Podniky vhodné na poledne. Preferujeme ty s čitelnou otevírací dobou.',
      preferOpen: true,
    }
  }
  if (h >= 15 && h < 18) {
    return {
      id: 'afternoon',
      title: 'Odpolední tipy',
      hint: 'Káva, sladké nebo lehčí jídlo podle toho, co je v katalogu doložené.',
      category: 'kava',
      preferOpen: true,
    }
  }
  if (h >= 18 && h < 23) {
    return {
      id: 'evening',
      title: 'Večerní tipy',
      hint: 'Večeře a podniky, které teď dávají smysl podle dostupných údajů.',
      preferOpen: true,
    }
  }
  return {
    id: 'late',
    title: 'Noční tipy',
    hint: 'Když je otevírací doba čitelná, ukazujeme podniky, které mohou mít otevřeno.',
    preferOpen: true,
  }
}
