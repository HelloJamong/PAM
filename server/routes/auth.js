const express = require('express')
const router = express.Router()
const db = require('../db')
const { hashPassword, requireAuth, validatePasswordPolicy } = require('../auth')

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
router.post('/login', (req, res) => {
  const { password } = req.body
  if (!password) {
    return res.status(400).json({ success: false, message: '비밀번호를 입력해주세요.' })
  }
  const setting = getSetting('admin_password')
  if (!setting || setting.value !== hashPassword(password)) {
    return res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' })
  }
  const passwordChangeRequired = isPasswordChangeRequired()
  req.session.authenticated = true
  req.session.passwordChangeRequired = passwordChangeRequired
  res.json({ success: true, passwordChangeRequired })
})

// POST /api/auth/change-password — 최초 로그인 비밀번호 변경
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: '현재 비밀번호와 새 비밀번호를 입력해주세요.' })
  }

  const setting = getSetting('admin_password')
  if (!setting || setting.value !== hashPassword(currentPassword)) {
    return res.status(400).json({ success: false, message: '현재 비밀번호가 올바르지 않습니다.' })
  }

  const policyError = validatePasswordPolicy(newPassword)
  if (policyError) {
    return res.status(400).json({ success: false, message: policyError })
  }

  setSetting('admin_password', hashPassword(newPassword))
  setSetting('admin_password_must_change', 'false')
  req.session.passwordChangeRequired = false

  res.json({ success: true, passwordChangeRequired: false })
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
