const crypto = require('crypto')

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

function requireAuth(req, res, next) {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' })
  }
  next()
}

module.exports = { hashPassword, requireAuth }
