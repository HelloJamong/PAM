const express = require('express')
const router = express.Router()
const db = require('../db')
const { hashPassword, requireAuth } = require('../auth')

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { password } = req.body
  if (!password) {
    return res.status(400).json({ success: false, message: '비밀번호를 입력해주세요.' })
  }
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password')
  if (!setting || setting.value !== hashPassword(password)) {
    return res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' })
  }
  req.session.authenticated = true
  res.json({ success: true })
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
  res.json({ success: true })
})

module.exports = router
