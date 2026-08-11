function parsePagination(query) {
  if (query.page === undefined && query.limit === undefined) return null

  const requestedPage = Number.parseInt(query.page, 10)
  const requestedLimit = Number.parseInt(query.limit, 10)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 100)
    : 25

  return { page, limit, offset: (page - 1) * limit }
}

function paginationMeta(total, { page, limit }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

module.exports = { parsePagination, paginationMeta }
