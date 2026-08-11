const test = require('node:test')
const assert = require('node:assert/strict')

const { parsePagination, paginationMeta } = require('../server/pagination')

test('pagination clamps invalid and excessive query values', () => {
  assert.equal(parsePagination({}), null)
  assert.deepEqual(parsePagination({ page: '-1', limit: '500' }), { page: 1, limit: 100, offset: 0 })
  assert.deepEqual(parsePagination({ page: '3', limit: '20' }), { page: 3, limit: 20, offset: 40 })
  assert.deepEqual(paginationMeta(41, { page: 3, limit: 20 }), {
    page: 3,
    limit: 20,
    total: 41,
    totalPages: 3,
  })
})
