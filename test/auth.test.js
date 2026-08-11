const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createLoginLimiter,
  hashPassword,
  legacyHashPassword,
  verifyPassword,
} = require('../server/auth')

test('password hashes use salted scrypt and verify legacy SHA-256 hashes', () => {
  const first = hashPassword('Changed1!')
  const second = hashPassword('Changed1!')

  assert.match(first, /^scrypt\$/)
  assert.notEqual(first, second)
  assert.equal(verifyPassword('Changed1!', first), true)
  assert.equal(verifyPassword('wrong', first), false)
  assert.equal(verifyPassword('Changed1!', legacyHashPassword('Changed1!')), true)
})

test('login limiter locks repeated failures and resets successful clients', () => {
  let now = 1_000
  const limiter = createLoginLimiter({ maxAttempts: 3, lockMs: 500, now: () => now })

  assert.equal(limiter.check('local'), null)
  limiter.recordFailure('local')
  limiter.recordFailure('local')
  assert.equal(limiter.check('local'), null)
  limiter.recordFailure('local')
  assert.equal(limiter.check('local').retryAfterSeconds, 1)

  now += 501
  assert.equal(limiter.check('local'), null)
  limiter.recordFailure('local')
  limiter.reset('local')
  assert.equal(limiter.check('local'), null)
})
