const test = require('node:test')
const assert = require('node:assert/strict')

const {
  validateAssetStatus,
  validateAssetStatusTransition,
  validateLoanDates,
} = require('../server/validation')

test('asset status accepts only the documented enum', () => {
  assert.equal(validateAssetStatus('보관중'), null)
  assert.equal(validateAssetStatus('반출중'), null)
  assert.equal(validateAssetStatus('폐기'), null)
  assert.match(validateAssetStatus('수리중'), /상태/)
})

test('checked-out status can only change through the loan workflow', () => {
  assert.match(validateAssetStatusTransition(null, '반출중'), /반출/)
  assert.match(validateAssetStatusTransition('보관중', '반출중'), /반출/)
  assert.match(validateAssetStatusTransition('반출중', '보관중'), /반납/)
  assert.equal(validateAssetStatusTransition('반출중', '반출중'), null)
  assert.equal(validateAssetStatusTransition('폐기', '보관중'), null)
})

test('loan dates must be real YYYY-MM-DD values in chronological order', () => {
  assert.equal(validateLoanDates({ checkoutDate: '2026-08-11', expectedReturnDate: '2026-08-12' }), null)
  assert.match(validateLoanDates({ checkoutDate: '2026-02-30' }), /날짜/)
  assert.match(validateLoanDates({ checkoutDate: '2026-08-11', expectedReturnDate: '2026-08-10' }), /반납예정일/)
  assert.match(validateLoanDates({ checkoutDate: '2026-08-11', returnDate: '2026-08-10' }), /반납일/)
})
