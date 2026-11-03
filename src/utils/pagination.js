export const RESULTS_PAGE_SIZE = 24

export function parsePageParam(value) {
  const page = Number(value)
  if (!Number.isInteger(page) || page < 1) return 1
  return page
}

export function pageCount(total, pageSize = RESULTS_PAGE_SIZE) {
  if (!Number.isFinite(total) || total <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

export function slicePage(items, page, pageSize = RESULTS_PAGE_SIZE) {
  const list = Array.isArray(items) ? items : []
  const totalPages = pageCount(list.length, pageSize)
  const safePage = Math.min(Math.max(1, page || 1), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    page: safePage,
    totalPages,
    pageSize,
    total: list.length,
    items: list.slice(start, start + pageSize),
    startIndex: list.length === 0 ? 0 : start + 1,
    endIndex: Math.min(start + pageSize, list.length),
  }
}
