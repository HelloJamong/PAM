const db = require('./db')
const { runBackup } = require('./utils/backup')

const assets = [
  { asset_no: 'A-0001', model_name: 'ThinkPad X1 Carbon', serial_no: 'SN-TP-2024-001', status: '보관중', note: '7세대' },
  { asset_no: 'A-0002', model_name: 'Dell Latitude 5540',  serial_no: 'SN-DL-2024-002', status: '보관중', note: null },
  { asset_no: 'A-0003', model_name: 'MacBook Pro 14',      serial_no: 'SN-MB-2024-003', status: '보관중', note: 'M3 칩' },
  { asset_no: 'A-0004', model_name: 'Surface Pro 9',       serial_no: 'SN-SP-2024-004', status: '보관중', note: null },
  { asset_no: 'A-0005', model_name: 'HP EliteBook 840',    serial_no: 'SN-HP-2024-005', status: '보관중', note: null },
]

const insertAsset = db.prepare(
  'INSERT OR IGNORE INTO assets (asset_no, model_name, serial_no, status, note) VALUES (?, ?, ?, ?, ?)'
)

for (const a of assets) {
  const { changes } = insertAsset.run(a.asset_no, a.model_name, a.serial_no, a.status, a.note)
  if (changes > 0) console.log(`[seed] 자산 등록: ${a.asset_no} ${a.model_name}`)
  else console.log(`[seed] 이미 존재 (스킵): ${a.asset_no}`)
}

// 반출 이력 샘플 (보관중 자산 중 A-0001, A-0002만 반출 처리)
const loans = [
  {
    asset_no: 'A-0001',
    user_name: '김철수', company_name: '현대건설', phone: '010-1234-5678',
    checkout_date: '2026-05-01', expected_return_date: '2026-05-31',
    checkout_confirmed_by: '관리자', status: '반출중',
  },
  {
    asset_no: 'A-0002',
    user_name: '이영희', company_name: 'ABC물산', phone: '010-9876-5432',
    checkout_date: '2026-04-15', expected_return_date: '2026-04-30',
    return_date: '2026-04-29', return_confirmed_by: '관리자',
    checkout_confirmed_by: '관리자', status: '반납완료',
  },
]

const insertLoan = db.prepare(`
  INSERT OR IGNORE INTO loan_records
    (asset_id, user_name, company_name, phone, checkout_date, expected_return_date,
     return_date, checkout_confirmed_by, return_confirmed_by, status)
  SELECT a.id, ?, ?, ?, ?, ?, ?, ?, ?, ?
  FROM assets a WHERE a.asset_no = ?
    AND NOT EXISTS (SELECT 1 FROM loan_records WHERE asset_id = a.id AND status = ?)
`)

const updateAssetStatus = db.prepare(
  "UPDATE assets SET status = ? WHERE asset_no = ? AND status = '보관중'"
)

for (const l of loans) {
  const { changes } = insertLoan.run(
    l.user_name, l.company_name, l.phone, l.checkout_date, l.expected_return_date || null,
    l.return_date || null, l.checkout_confirmed_by || null, l.return_confirmed_by || null,
    l.status, l.asset_no, l.status
  )
  if (changes > 0) {
    if (l.status === '반출중') updateAssetStatus.run('반출중', l.asset_no)
    console.log(`[seed] 이력 등록: ${l.asset_no} → ${l.status}`)
  } else {
    console.log(`[seed] 이력 이미 존재 (스킵): ${l.asset_no}`)
  }
}

runBackup(db)
  .then(() => console.log('[seed] 완료'))
  .catch(err => {
    console.error('[seed] 백업 실패:', err.message)
    process.exitCode = 1
  })
