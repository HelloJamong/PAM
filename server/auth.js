const crypto = require('crypto')

const SCRYPT_COST = 16384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 1
const SCRYPT_KEY_LENGTH = 64

function legacyHashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: 64 * 1024 * 1024,
  })
  return [
    'scrypt',
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$')
}

function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false

  if (!storedHash.startsWith('scrypt$')) {
    const actual = Buffer.from(legacyHashPassword(password), 'utf8')
    const expected = Buffer.from(storedHash, 'utf8')
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  }

  const [algorithm, cost, blockSize, parallelization, salt, expectedHash] = storedHash.split('$')
  if (algorithm !== 'scrypt' || !cost || !blockSize || !parallelization || !salt || !expectedHash) {
    return false
  }

  const parsedCost = Number(cost)
  const parsedBlockSize = Number(blockSize)
  const parsedParallelization = Number(parallelization)
  if (
    parsedCost !== SCRYPT_COST
    || parsedBlockSize !== SCRYPT_BLOCK_SIZE
    || parsedParallelization !== SCRYPT_PARALLELIZATION
  ) {
    return false
  }

  try {
    const expected = Buffer.from(expectedHash, 'base64url')
    const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64url'), expected.length, {
      N: parsedCost,
      r: parsedBlockSize,
      p: parsedParallelization,
      maxmem: 64 * 1024 * 1024,
    })
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

function createLoginLimiter({ maxAttempts = 5, lockMs = 30_000, now = Date.now } = {}) {
  const attempts = new Map()

  return {
    check(key) {
      const entry = attempts.get(key)
      if (!entry) return null
      if (entry.lockedUntil > now()) {
        return { retryAfterSeconds: Math.max(1, Math.ceil((entry.lockedUntil - now()) / 1000)) }
      }
      if (entry.lockedUntil) attempts.delete(key)
      return null
    },
    recordFailure(key) {
      const entry = attempts.get(key) || { failures: 0, lockedUntil: 0 }
      entry.failures += 1
      if (entry.failures >= maxAttempts) entry.lockedUntil = now() + lockMs
      attempts.set(key, entry)
    },
    reset(key) {
      attempts.delete(key)
    },
  }
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
  if (password.length > 256) {
    return '새 비밀번호는 256자리 이하여야 합니다.'
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

module.exports = {
  createLoginLimiter,
  hashPassword,
  legacyHashPassword,
  verifyPassword,
  requireAuth,
  requirePasswordReady,
  validatePasswordPolicy,
}
