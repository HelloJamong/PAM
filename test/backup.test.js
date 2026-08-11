const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Database = require('better-sqlite3')

const { runBackup, backupAfterMutation, getBackupStatus } = require('../server/utils/backup')

test('backup includes WAL data and keeps only the configured number of snapshots', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pam-backup-'))
  const backupDir = path.join(root, 'backup')
  const db = new Database(path.join(root, 'pam.db'))
  t.after(() => {
    db.close()
    fs.rmSync(root, { recursive: true, force: true })
  })

  db.pragma('journal_mode = WAL')
  db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')

  for (let i = 1; i <= 5; i += 1) {
    db.prepare('INSERT INTO items (name) VALUES (?)').run(`item-${i}`)
    await runBackup(db, { backupDir, retention: 3 })
  }

  const files = fs.readdirSync(backupDir).filter(file => file.endsWith('.db'))
  assert.equal(files.length, 3)

  const counts = files.map(file => {
    const snapshot = new Database(path.join(backupDir, file), { readonly: true })
    try {
      assert.equal(snapshot.pragma('integrity_check', { simple: true }), 'ok')
      return snapshot.prepare('SELECT COUNT(*) AS count FROM items').get().count
    } finally {
      snapshot.close()
    }
  })
  assert.equal(Math.max(...counts), 5)
})

test('backup failure is returned as an explicit operator warning', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pam-backup-error-'))
  const db = new Database(path.join(root, 'pam.db'))
  t.after(() => {
    db.close()
    fs.rmSync(root, { recursive: true, force: true })
  })

  db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY)')
  const blockedParent = path.join(root, 'not-a-directory')
  fs.writeFileSync(blockedParent, 'blocked')

  const result = await backupAfterMutation(db, '테스트', {
    backupDir: path.join(blockedParent, 'backup'),
  })
  assert.equal(result.success, false)
  assert.match(result.message, /백업에 실패/)
  assert.equal(getBackupStatus().success, false)
})
