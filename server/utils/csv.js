function escapeField(value) {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsv(rows) {
  const headers = [
    '자산번호', '모델명', '시리얼번호', '반출자', '소속업체', '연락처',
    '반출일', '반납예정일', '반납일', '반출확인자', '반납확인자', '상태', '비고',
  ]
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push([
      r.asset_no, r.model_name, r.serial_no,
      r.user_name, r.company_name, r.phone,
      r.checkout_date, r.expected_return_date, r.return_date,
      r.checkout_confirmed_by, r.return_confirmed_by, r.status, r.note,
    ].map(escapeField).join(','))
  }
  return '﻿' + lines.join('\r\n')
}

module.exports = { buildCsv }
