const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const rootPackage = require('../package.json')
const clientPackage = require('../client/package.json')

test('package versions and changelog release entry stay aligned', () => {
  assert.equal(clientPackage.version, rootPackage.version)
  const changelog = fs.readFileSync('CHANGELOG.md', 'utf8')
  assert.match(changelog, new RegExp(`^## \\[${rootPackage.version.replace(/\./g, '\\.')}\\]`, 'm'))

  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) {
    assert.equal(process.env.GITHUB_REF_NAME.replace(/^v/, ''), rootPackage.version)
  }
})
