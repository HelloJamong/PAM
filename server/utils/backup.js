const fs = require('fs')
const path = require('path')

const DEFAULT_RETENTION = 30
const BACKUP_FAILURE_MESSAGE = '데이터는 저장되었지만 자동 백업에 실패했습니다. 저장 공간과 backup 폴더를 확인해주세요.'
let backupQueue = Promise.resolve()
let lastBackupStatus = { success: null, lastAttemptAt: null }

function backupStamp(now = new Date()) {
  return now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '_'
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0')
    + '_'
    + String(now.getMilliseconds()).padStart(3, '0')
}

function configuredRetention(value = process.env.PAM_BACKUP_RETENTION) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION
}

async function pruneBackups(backupDir, retention) {
  const entries = await fs.promises.readdir(backupDir, { withFileTypes: true })
  const backups = await Promise.all(entries
    .filter(entry => entry.isFile() && /^pam_.*\.db$/.test(entry.name))
    .map(async entry => {
      const filePath = path.join(backupDir, entry.name)
      const stat = await fs.promises.stat(filePath)
      return { filePath, modifiedAt: stat.mtimeMs }
    }))

  backups.sort((a, b) => b.modifiedAt - a.modifiedAt)
  await Promise.all(backups.slice(retention).map(backup => fs.promises.unlink(backup.filePath)))
}

async function createBackup(db, options) {
  const backupDir = options.backupDir
    ? path.resolve(options.backupDir)
    : process.env.PAM_BACKUP_DIR
      ? path.resolve(process.env.PAM_BACKUP_DIR)
      : path.join(__dirname, '..', '..', 'backup')
  const retention = configuredRetention(options.retention)

  await fs.promises.mkdir(backupDir, { recursive: true })
  const stamp = backupStamp()
  let dest = path.join(backupDir, `pam_${stamp}.db`)
  let suffix = 1
  while (fs.existsSync(dest)) {
    dest = path.join(backupDir, `pam_${stamp}_${suffix}.db`)
    suffix += 1
  }
  try {
    await db.backup(dest)
  } catch (err) {
    await fs.promises.unlink(dest).catch(() => {})
    throw err
  }
  await pruneBackups(backupDir, retention)
  console.log(`[백업] ${dest}`)
  return dest
}

function runBackup(db, options = {}) {
  const operation = backupQueue
    .then(() => createBackup(db, options))
    .then(filePath => {
      lastBackupStatus = { success: true, lastAttemptAt: new Date().toISOString() }
      return filePath
    })
    .catch(err => {
      lastBackupStatus = {
        success: false,
        lastAttemptAt: new Date().toISOString(),
        message: BACKUP_FAILURE_MESSAGE,
      }
      throw err
    })
  backupQueue = operation.catch(() => {})
  return operation
}

async function backupAfterMutation(db, context, options = {}) {
  try {
    await runBackup(db, options)
    return { success: true }
  } catch (err) {
    console.error(`[백업 오류${context ? `: ${context}` : ''}]`, err.message)
    return { success: false, message: BACKUP_FAILURE_MESSAGE }
  }
}

// 응답을 막지 않는 백업 트리거. 결과는 getBackupStatus() / GET /api/health 로 노출된다.
function scheduleBackup(db, context, options = {}) {
  runBackup(db, options).catch(err => {
    console.error(`[백업 오류${context ? `: ${context}` : ''}]`, err.message)
  })
}

function getBackupStatus() {
  return { ...lastBackupStatus }
}

// 큐에 쌓인 백업이 모두 끝날 때까지 대기 (테스트에서 파일 검증 전 사용)
function whenBackupSettled() {
  return backupQueue
}

module.exports = { runBackup, backupAfterMutation, scheduleBackup, getBackupStatus, whenBackupSettled }
