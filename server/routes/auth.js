const express = require('express')
const router = express.Router()
const db = require('../db')
const {
  createLoginLimiter,
  hashPassword,
  verifyPassword,
  requireAuth,
  validatePasswordPolicy,
} = require('../auth')
const { scheduleBackup, getBackupStatus } = require('../utils/backup')

const loginLimiter = createLoginLimiter()

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value)
}

function isPasswordChangeRequired() {
  const setting = getSetting('admin_password_must_change')
  return setting?.value === 'true'
}

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const clientKey = req.ip || req.socket.remoteAddress || 'local'
    const lock = loginLimiter.check(clientKey)
    if (lock) {
      res.setHeader('Retry-After', String(lock.retryAfterSeconds))
      return res.status(429).json({
        success: false,
        message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
      })
    }

    const { password } = req.body
    if (typeof password !== 'string' || !password || password.length > 256) {
      return res.status(400).json({ success: false, message: '비밀번호를 입력해주세요.' })
    }
    const setting = getSetting('admin_password')
    if (!setting || !verifyPassword(password, setting.value)) {
      loginLimiter.recordFailure(clientKey)
      return res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' })
    }

    loginLimiter.reset(clientKey)
    let migrated = false
    if (!setting.value.startsWith('scrypt$')) {
      setSetting('admin_password', hashPassword(password))
      scheduleBackup(db, '비밀번호 해시 마이그레이션')
      migrated = true
    }

    const passwordChangeRequired = isPasswordChangeRequired()
    req.session.authenticated = true
    req.session.passwordChangeRequired = passwordChangeRequired
    res.json({ success: true, passwordChangeRequired, ...(migrated && { backup: getBackupStatus() }) })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/change-password — 최초 로그인 비밀번호 변경
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (
      typeof currentPassword !== 'string'
      || typeof newPassword !== 'string'
      || !currentPassword
      || !newPassword
      || currentPassword.length > 256
    ) {
      return res.status(400).json({ success: false, message: '현재 비밀번호와 새 비밀번호를 입력해주세요.' })
    }

    const setting = getSetting('admin_password')
    if (!setting || !verifyPassword(currentPassword, setting.value)) {
      return res.status(400).json({ success: false, message: '현재 비밀번호가 올바르지 않습니다.' })
    }

    const policyError = validatePasswordPolicy(newPassword)
    if (policyError) {
      return res.status(400).json({ success: false, message: policyError })
    }

    setSetting('admin_password', hashPassword(newPassword))
    setSetting('admin_password_must_change', 'false')
    req.session.passwordChangeRequired = false
    scheduleBackup(db, '비밀번호 변경')

    res.json({ success: true, passwordChangeRequired: false, backup: getBackupStatus() })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true })
  })
})

// GET /api/auth/me — 세션 유효 확인
router.get('/me', (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false })
  }
  const passwordChangeRequired = req.session.passwordChangeRequired ?? isPasswordChangeRequired()
  req.session.passwordChangeRequired = passwordChangeRequired
  res.json({ success: true, passwordChangeRequired })
})

module.exports = router
