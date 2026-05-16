const fs = require('fs')
const path = require('path')

function runBackup() {
  const baseDir = path.join(__dirname, '..', '..')
  const dbPath = path.join(baseDir, 'data', 'pam.db')
  const backupDir = path.join(baseDir, 'backup')

  if (!fs.existsSync(dbPath)) return

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const now = new Date()
  const stamp = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '_'
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0')

  const dest = path.join(backupDir, `pam_${stamp}.db`)
  fs.copyFileSync(dbPath, dest)
  console.log(`[백업] ${dest}`)
}

module.exports = { runBackup }
