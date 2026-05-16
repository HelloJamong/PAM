const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

// PAM.exe 또는 node 실행 위치 기준으로 data/ 경로 결정
const baseDir = path.dirname(process.execPath === process.argv[0]
  ? process.execPath  // pkg 번들 실행 시
  : path.resolve(process.argv[1], '../../'))  // node server/index.js 실행 시

const dataDir = path.join(__dirname, '..', 'data')
const dbPath = path.join(dataDir, 'pam.db')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(dbPath)

// WAL 모드: 동시 읽기 성능 향상
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_no   TEXT    UNIQUE NOT NULL,
    model_name TEXT    NOT NULL,
    serial_no  TEXT,
    status     TEXT    NOT NULL DEFAULT '보관중',
    note       TEXT,
    created_at TEXT    DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT    DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS loan_records (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id              INTEGER NOT NULL,
    user_name             TEXT    NOT NULL,
    company_name          TEXT,
    phone                 TEXT,
    checkout_date         TEXT    NOT NULL,
    expected_return_date  TEXT,
    return_date           TEXT,
    checkout_confirmed_by TEXT,
    return_confirmed_by   TEXT,
    status                TEXT    NOT NULL,
    note                  TEXT,
    created_at            TEXT    DEFAULT (datetime('now', 'localtime')),
    updated_at            TEXT    DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (asset_id) REFERENCES assets(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

// 초기 관리자 비밀번호 설정 (없을 때만 삽입)
const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password')
if (!existing) {
  const hash = crypto.createHash('sha256').update('admin1234').digest('hex')
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_password', hash)
}

module.exports = db
