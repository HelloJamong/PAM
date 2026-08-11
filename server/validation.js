const ASSET_STATUSES = new Set(['보관중', '반출중', '폐기'])

function validateAssetStatus(status) {
  if (!ASSET_STATUSES.has(status)) {
    return '상태는 보관중, 반출중, 폐기 중 하나여야 합니다.'
  }
  return null
}

function validateAssetStatusTransition(currentStatus, nextStatus) {
  const statusError = validateAssetStatus(nextStatus)
  if (statusError) return statusError

  if (currentStatus !== '반출중' && nextStatus === '반출중') {
    return '반출중 상태는 반출 등록을 통해서만 설정할 수 있습니다.'
  }
  if (currentStatus === '반출중' && nextStatus !== '반출중') {
    return '반출중인 자산의 상태는 반납 처리를 통해서만 변경할 수 있습니다.'
  }
  return null
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validateLoanDates({ checkoutDate, expectedReturnDate, returnDate }) {
  for (const [label, value] of [
    ['반출일', checkoutDate],
    ['반납예정일', expectedReturnDate],
    ['반납일', returnDate],
  ]) {
    if (value && !isValidDateOnly(value)) {
      return `${label}은 올바른 날짜(YYYY-MM-DD)여야 합니다.`
    }
  }

  if (checkoutDate && expectedReturnDate && expectedReturnDate < checkoutDate) {
    return '반납예정일은 반출일보다 빠를 수 없습니다.'
  }
  if (checkoutDate && returnDate && returnDate < checkoutDate) {
    return '반납일은 반출일보다 빠를 수 없습니다.'
  }
  return null
}

module.exports = { validateAssetStatus, validateAssetStatusTransition, validateLoanDates }
