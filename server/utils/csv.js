function escapeField(value) {
  if (value == null) return ''
  const raw = String(value)
  const str = /^[\t ]*[=+\-@]/.test(raw) ? `'${raw}` : raw
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsvFromRows(headers, rows) {
  const lines = [headers.map(escapeField).join(',')]
  for (const row of rows) {
    lines.push(headers.map(header => escapeField(row[header])).join(','))
  }
  return '\ufeff' + lines.join('\r\n')
}

function buildCsv(rows) {
  const headers = [
    '자산번호', '모델명', '시리얼번호', '반출자', '소속업체', '연락처',
    '반출일', '반납예정일', '반납일', '반출확인자', '반납확인자', '상태', '비고',
  ]
  const normalized = rows.map(r => ({
    자산번호: r.asset_no,
    모델명: r.model_name,
    시리얼번호: r.serial_no,
    반출자: r.user_name,
    소속업체: r.company_name,
    연락처: r.phone,
    반출일: r.checkout_date,
    반납예정일: r.expected_return_date,
    반납일: r.return_date,
    반출확인자: r.checkout_confirmed_by,
    반납확인자: r.return_confirmed_by,
    상태: r.status,
    비고: r.note,
  }))
  return buildCsvFromRows(headers, normalized)
}

function buildAssetsCsv(rows) {
  const headers = ['자산번호', '모델명', '시리얼번호', '상태', '비고']
  const normalized = rows.map(r => ({
    자산번호: r.asset_no,
    모델명: r.model_name,
    시리얼번호: r.serial_no,
    상태: r.status,
    비고: r.note,
  }))
  return buildCsvFromRows(headers, normalized)
}

function buildAssetsTemplateCsv() {
  const headers = ['자산번호', '모델명', '시리얼번호', '상태', '비고']
  const rows = [{
    자산번호: 'ASSET-001',
    모델명: '예시 모델명',
    시리얼번호: 'SN-001',
    상태: '보관중',
    비고: '선택 입력',
  }]
  return buildCsvFromRows(headers, rows)
}

function parseCsv(text) {
  const input = String(text || '').replace(/^\ufeff/, '')
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    const next = input[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char === '\r') {
      // CRLF의 CR은 무시하고 LF에서 행을 마감합니다.
    } else {
      field += char
    }
  }

  if (inQuotes) {
    const err = new Error('CSV 따옴표 형식이 올바르지 않습니다.')
    err.status = 400
    throw err
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter(r => r.some(v => String(v).trim() !== ''))
}

function normalizeHeader(header) {
  return String(header || '').trim().toLowerCase().replace(/[\s_-]/g, '')
}

function parseAssetsCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) {
    const err = new Error('가져올 자산 데이터가 없습니다. CSV 헤더와 1개 이상의 데이터 행이 필요합니다.')
    err.status = 400
    throw err
  }

  const headerAliases = {
    자산번호: 'asset_no',
    assetno: 'asset_no',
    모델명: 'model_name',
    modelname: 'model_name',
    시리얼번호: 'serial_no',
    시리얼: 'serial_no',
    serialno: 'serial_no',
    상태: 'status',
    status: 'status',
    비고: 'note',
    메모: 'note',
    note: 'note',
  }

  const headers = rows[0].map(header => headerAliases[normalizeHeader(header)] || null)
  if (!headers.includes('asset_no') || !headers.includes('model_name')) {
    const err = new Error('CSV 헤더에 자산번호와 모델명이 필요합니다.')
    err.status = 400
    throw err
  }

  const allowedStatuses = new Set(['보관중', '반출중', '폐기'])
  const assets = []
  const seenAssetNos = new Set()

  rows.slice(1).forEach((values, index) => {
    const lineNo = index + 2
    const item = {}
    headers.forEach((key, colIndex) => {
      if (!key) return
      item[key] = values[colIndex] == null ? '' : String(values[colIndex]).trim()
    })

    if (!item.asset_no && !item.model_name && !item.serial_no && !item.status && !item.note) return
    if (!item.asset_no || !item.model_name) {
      const err = new Error(`${lineNo}행: 자산번호와 모델명은 필수입니다.`)
      err.status = 400
      throw err
    }
    if (seenAssetNos.has(item.asset_no)) {
      const err = new Error(`${lineNo}행: CSV 안에 중복된 자산번호가 있습니다. (${item.asset_no})`)
      err.status = 400
      throw err
    }

    item.status = item.status || '보관중'
    if (!allowedStatuses.has(item.status)) {
      const err = new Error(`${lineNo}행: 상태는 보관중, 반출중, 폐기 중 하나여야 합니다.`)
      err.status = 400
      throw err
    }

    seenAssetNos.add(item.asset_no)
    assets.push({
      asset_no: item.asset_no,
      model_name: item.model_name,
      serial_no: item.serial_no || null,
      status: item.status,
      note: item.note || null,
    })
  })

  if (assets.length === 0) {
    const err = new Error('가져올 자산 데이터가 없습니다.')
    err.status = 400
    throw err
  }

  return assets
}

module.exports = { buildCsv, buildAssetsCsv, buildAssetsTemplateCsv, parseAssetsCsv }
