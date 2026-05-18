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

function requirePasswordReady(req, res, next) {
  if (req.session.passwordChangeRequired) {
    return res.status(403).json({
      success: false,
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: '최초 로그인 비밀번호 변경 후 이용할 수 있습니다.',
    })
  }
  next()
}

function validatePasswordPolicy(password) {
  if (!password || password.length < 8) {
    return '새 비밀번호는 최소 8자리 이상이어야 합니다.'
  }
  if (!/[A-Z]/.test(password)) {
    return '새 비밀번호에는 대문자가 1개 이상 포함되어야 합니다.'
  }
  if (!/\d/.test(password)) {
    return '새 비밀번호에는 숫자가 1개 이상 포함되어야 합니다.'
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return '새 비밀번호에는 특수문자가 1개 이상 포함되어야 합니다.'
  }
  return null
}

module.exports = { hashPassword, requireAuth, requirePasswordReady, validatePasswordPolicy }
