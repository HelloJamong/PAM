const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Database = require('better-sqlite3')
const { legacyHashPassword } = require('../server/auth')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pam-api-'))
process.env.NODE_ENV = 'test'
process.env.PAM_DATA_DIR = path.join(root, 'data')
process.env.PAM_BACKUP_DIR = path.join(root, 'backup')
process.env.PAM_BACKUP_RETENTION = '4'

const db = require('../server/db')
const { startServer } = require('../server/index')

let server
let baseUrl
let cookie

test.before(async () => {
  server = await startServer({ port: 0 })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

test.after(async () => {
  await new Promise(resolve => server.close(resolve))
  db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

async function request(method, route, body) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (cookie) headers.Cookie = cookie
  return fetch(baseUrl + route, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

test('API protects asset/loan consistency and writes recoverable snapshots', async () => {
  db.prepare("UPDATE settings SET value = ? WHERE key = 'admin_password'")
    .run(legacyHashPassword('password1!'))

  let response = await request('POST', '/api/auth/login', { password: 'password1!' })
  assert.equal(response.status, 200)
  cookie = response.headers.get('set-cookie').split(';', 1)[0]
  assert.match(
    db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get().value,
    /^scrypt\$/
  )

  response = await request('GET', '/api/assets')
  assert.equal(response.status, 403)
  assert.equal((await response.json()).code, 'PASSWORD_CHANGE_REQUIRED')

  response = await request('POST', '/api/auth/change-password', {
    currentPassword: 'password1!',
    newPassword: 'Changed1!',
  })
  assert.equal(response.status, 200)

  response = await request('POST', '/api/assets', {
    asset_no: 'A-INVALID',
    model_name: 'Invalid',
    status: '반출중',
  })
  assert.equal(response.status, 400)

  response = await request('POST', '/api/assets', {
    asset_no: 'A-001',
    model_name: 'Notebook',
    status: '보관중',
    note: '=HYPERLINK("https://example.invalid")',
  })
  assert.equal(response.status, 201)
  const asset = (await response.json()).data

  response = await request('POST', '/api/assets', {
    asset_no: 'A-002',
    model_name: 'Monitor',
    status: '보관중',
  })
  assert.equal(response.status, 201)

  response = await request('GET', '/api/assets?page=1&limit=1')
  let page = await response.json()
  assert.equal(page.data.length, 1)
  assert.deepEqual(page.pagination, { page: 1, limit: 1, total: 2, totalPages: 2 })

  response = await request('GET', '/api/assets?page=2&limit=1')
  page = await response.json()
  assert.equal(page.data.length, 1)
  assert.equal(page.pagination.page, 2)

  response = await request('POST', '/api/loans/checkout', {
    asset_id: asset.id,
    user_name: 'Tester',
    checkout_date: '2026-02-30',
  })
  assert.equal(response.status, 400)

  response = await request('POST', '/api/loans/checkout', {
    asset_id: asset.id,
    user_name: 'Tester',
    checkout_date: '2026-08-11',
    expected_return_date: '2026-08-12',
  })
  assert.equal(response.status, 201)
  const loan = (await response.json()).data

  response = await request('PUT', `/api/assets/${asset.id}`, {
    asset_no: asset.asset_no,
    model_name: asset.model_name,
    status: '보관중',
  })
  assert.equal(response.status, 400)

  response = await request('PUT', `/api/loans/${loan.id}/return`, { return_date: '2026-08-10' })
  assert.equal(response.status, 400)

  response = await request('PUT', `/api/loans/${loan.id}/return`, { return_date: '2026-08-12' })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).backup.success, true)
  assert.equal(db.prepare('SELECT status FROM assets WHERE id = ?').get(asset.id).status, '보관중')
  assert.equal(db.prepare('SELECT status FROM loan_records WHERE id = ?').get(loan.id).status, '반납완료')

  response = await request('GET', '/api/health')
  const health = await response.json()
  assert.equal(health.app, 'PAM')
  assert.equal(health.backup.success, true)

  response = await request('GET', '/api/loans?page=1&limit=1')
  page = await response.json()
  assert.equal(page.data.length, 1)
  assert.equal(page.pagination.total, 1)

  response = await request('GET', '/api/assets/export.csv')
  assert.equal(response.status, 200)
  assert.match(await response.text(), /'=HYPERLINK/)

  assert.throws(
    () => db.prepare("INSERT INTO assets (asset_no, model_name, status) VALUES ('A-BAD', 'Bad', '수리중')").run(),
    /INVALID_ASSET_STATUS/
  )
  assert.throws(
    () => db.prepare("INSERT INTO assets (asset_no, model_name, status) VALUES ('A-ORPHAN', 'Orphan', '반출중')").run(),
    /CHECKOUT_REQUIRES_LOAN/
  )
  const disposed = db.prepare(
    "INSERT INTO assets (asset_no, model_name, status) VALUES ('A-DISPOSED', 'Disposed', '폐기')"
  ).run()
  const completedLoan = db.prepare(`
    INSERT INTO loan_records (asset_id, user_name, checkout_date, status)
    VALUES (?, 'Tester', '2026-08-01', '반납완료')
  `).run(disposed.lastInsertRowid)
  assert.throws(
    () => db.prepare("UPDATE loan_records SET status = '반출중' WHERE id = ?").run(completedLoan.lastInsertRowid),
    /ACTIVE_LOAN_UPDATE_NOT_ALLOWED/
  )

  const directAsset = db.prepare(
    "INSERT INTO assets (asset_no, model_name, status) VALUES ('A-DIRECT', 'Direct', '보관중')"
  ).run()
  const directLoan = db.prepare(`
    INSERT INTO loan_records (asset_id, user_name, checkout_date, status)
    VALUES (?, 'Direct Tester', '2026-08-01', '반출중')
  `).run(directAsset.lastInsertRowid)
  assert.equal(
    db.prepare('SELECT status FROM assets WHERE id = ?').get(directAsset.lastInsertRowid).status,
    '반출중'
  )
  db.prepare("UPDATE loan_records SET status = '반납완료' WHERE id = ?").run(directLoan.lastInsertRowid)
  assert.equal(
    db.prepare('SELECT status FROM assets WHERE id = ?').get(directAsset.lastInsertRowid).status,
    '보관중'
  )
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
  const indexNames = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map(row => row.name))
  for (const indexName of [
    'idx_assets_status_created',
    'idx_assets_created',
    'idx_loans_status_created',
    'idx_loans_asset_status',
  ]) {
    assert.ok(indexNames.has(indexName), `missing index: ${indexName}`)
  }

  const backupFiles = fs.readdirSync(process.env.PAM_BACKUP_DIR)
    .filter(file => file.endsWith('.db'))
  assert.ok(backupFiles.length > 0)
  assert.ok(backupFiles.length <= 4)

  const snapshotCounts = backupFiles.map(file => {
    const snapshot = new Database(path.join(process.env.PAM_BACKUP_DIR, file), { readonly: true })
    try {
      return snapshot.prepare(`
        SELECT
          (SELECT COUNT(*) FROM assets) AS assets,
          (SELECT COUNT(*) FROM loan_records WHERE status = '반납완료') AS returned
      `).get()
    } finally {
      snapshot.close()
    }
  })
  assert.ok(snapshotCounts.some(counts => counts.assets === 2 && counts.returned === 1))

  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = await request('POST', '/api/auth/login', { password: 'wrong-password' })
    assert.equal(response.status, 401)
  }
  response = await request('POST', '/api/auth/login', { password: 'Changed1!' })
  assert.equal(response.status, 429)
  assert.ok(Number(response.headers.get('retry-after')) >= 1)
})
