const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const { hashPassword, legacyHashPassword } = require('./auth')

const dataDir = process.env.PAM_DATA_DIR
  ? path.resolve(process.env.PAM_DATA_DIR)
  : path.join(__dirname, '..', 'data')
const dbPath = path.join(dataDir, 'pam.db')
const isNewDatabase = !fs.existsSync(dbPath)

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

  CREATE INDEX IF NOT EXISTS idx_assets_status_created
    ON assets(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_assets_created
    ON assets(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_loans_status_created
    ON loan_records(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_loans_asset_status
    ON loan_records(asset_id, status);

  CREATE TRIGGER IF NOT EXISTS validate_assets_status_insert
  BEFORE INSERT ON assets
  WHEN NEW.status NOT IN ('보관중', '반출중', '폐기')
  BEGIN
    SELECT RAISE(ABORT, 'INVALID_ASSET_STATUS');
  END;

  CREATE TRIGGER IF NOT EXISTS validate_assets_status_update
  BEFORE UPDATE OF status ON assets
  WHEN NEW.status NOT IN ('보관중', '반출중', '폐기')
  BEGIN
    SELECT RAISE(ABORT, 'INVALID_ASSET_STATUS');
  END;

  CREATE TRIGGER IF NOT EXISTS protect_assets_checked_out_insert
  BEFORE INSERT ON assets
  WHEN NEW.status = '반출중'
  BEGIN
    SELECT RAISE(ABORT, 'CHECKOUT_REQUIRES_LOAN');
  END;

  CREATE TRIGGER IF NOT EXISTS protect_assets_checkout_transition
  BEFORE UPDATE OF status ON assets
  WHEN OLD.status <> '반출중'
    AND NEW.status = '반출중'
    AND NOT EXISTS (
      SELECT 1 FROM loan_records
      WHERE asset_id = OLD.id AND status = '반출중'
    )
  BEGIN
    SELECT RAISE(ABORT, 'CHECKOUT_REQUIRES_LOAN');
  END;

  CREATE TRIGGER IF NOT EXISTS protect_assets_return_transition
  BEFORE UPDATE OF status ON assets
  WHEN OLD.status = '반출중'
    AND NEW.status <> '반출중'
    AND EXISTS (
      SELECT 1 FROM loan_records
      WHERE asset_id = OLD.id AND status = '반출중'
    )
  BEGIN
    SELECT RAISE(ABORT, 'RETURN_REQUIRES_COMPLETED_LOAN');
  END;

  CREATE TRIGGER IF NOT EXISTS validate_loan_status_insert
  BEFORE INSERT ON loan_records
  WHEN NEW.status NOT IN ('반출중', '반납완료')
  BEGIN
    SELECT RAISE(ABORT, 'INVALID_LOAN_STATUS');
  END;

  CREATE TRIGGER IF NOT EXISTS validate_loan_status_update
  BEFORE UPDATE OF status ON loan_records
  WHEN NEW.status NOT IN ('반출중', '반납완료')
  BEGIN
    SELECT RAISE(ABORT, 'INVALID_LOAN_STATUS');
  END;

  CREATE TRIGGER IF NOT EXISTS protect_active_loan_asset_insert
  BEFORE INSERT ON loan_records
  WHEN NEW.status = '반출중'
    AND (SELECT status FROM assets WHERE id = NEW.asset_id) <> '보관중'
  BEGIN
    SELECT RAISE(ABORT, 'ACTIVE_LOAN_REQUIRES_STORED_ASSET');
  END;

  CREATE TRIGGER IF NOT EXISTS protect_duplicate_active_loan_insert
  BEFORE INSERT ON loan_records
  WHEN NEW.status = '반출중'
    AND EXISTS (
      SELECT 1 FROM loan_records
      WHERE asset_id = NEW.asset_id AND status = '반출중'
    )
  BEGIN
    SELECT RAISE(ABORT, 'DUPLICATE_ACTIVE_LOAN');
  END;

  CREATE TRIGGER IF NOT EXISTS sync_asset_checkout_after_loan_insert
  AFTER INSERT ON loan_records
  WHEN NEW.status = '반출중'
  BEGIN
    UPDATE assets
    SET status = '반출중', updated_at = datetime('now', 'localtime')
    WHERE id = NEW.asset_id;
  END;

  CREATE TRIGGER IF NOT EXISTS protect_active_loan_update
  BEFORE UPDATE OF status, asset_id ON loan_records
  WHEN NEW.status = '반출중'
    AND (OLD.status <> '반출중' OR OLD.asset_id <> NEW.asset_id)
  BEGIN
    SELECT RAISE(ABORT, 'ACTIVE_LOAN_UPDATE_NOT_ALLOWED');
  END;

  CREATE TRIGGER IF NOT EXISTS sync_asset_return_after_loan_update
  AFTER UPDATE OF status ON loan_records
  WHEN OLD.status = '반출중' AND NEW.status = '반납완료'
  BEGIN
    UPDATE assets
    SET status = '보관중', updated_at = datetime('now', 'localtime')
    WHERE id = OLD.asset_id
      AND NOT EXISTS (
        SELECT 1 FROM loan_records
        WHERE asset_id = OLD.asset_id AND status = '반출중'
      );
  END;

  CREATE TRIGGER IF NOT EXISTS sync_asset_return_after_loan_delete
  AFTER DELETE ON loan_records
  WHEN OLD.status = '반출중'
  BEGIN
    UPDATE assets
    SET status = '보관중', updated_at = datetime('now', 'localtime')
    WHERE id = OLD.asset_id
      AND NOT EXISTS (
        SELECT 1 FROM loan_records
        WHERE asset_id = OLD.asset_id AND status = '반출중'
      );
  END;
`)

// 초기 관리자 비밀번호 설정 및 기존 기본값 마이그레이션
const INITIAL_ADMIN_PASSWORD = 'password1!'
const LEGACY_ADMIN_PASSWORD = 'admin1234'
const legacyHash = legacyHashPassword(LEGACY_ADMIN_PASSWORD)
const passwordSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password')
const mustChangeSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password_must_change')

if (!passwordSetting) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_password', hashPassword(INITIAL_ADMIN_PASSWORD))
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_password_must_change', 'true')
} else if (passwordSetting.value === legacyHash) {
  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(hashPassword(INITIAL_ADMIN_PASSWORD), 'admin_password')
  db.prepare(`
    INSERT INTO settings (key, value) VALUES ('admin_password_must_change', 'true')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run()
} else if (!mustChangeSetting) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_password_must_change', 'false')
}

db.isNewDatabase = isNewDatabase

module.exports = db
