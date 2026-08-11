const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

function source(file) {
  return fs.readFileSync(file, 'utf8')
}

test('list pages expose request failures and debounce search requests', () => {
  const assets = source('client/src/pages/Assets.jsx')
  const history = source('client/src/pages/History.jsx')
  const checkout = source('client/src/pages/Checkout.jsx')
  const returns = source('client/src/pages/Return.jsx')

  for (const page of [assets, history, checkout, returns]) {
    assert.doesNotMatch(page, /catch\(\(\) => \{\}\)/)
    assert.match(page, /role="alert"/)
  }
  assert.match(assets, /useDebouncedValue/)
  assert.match(history, /useDebouncedValue/)
})

test('responsive and dialog accessibility contracts are present', () => {
  const css = source('client/src/index.css')
  const returns = source('client/src/pages/Return.jsx')
  const layout = source('client/src/components/Layout.jsx')

  assert.match(css, /@media \(max-width: 768px\)/)
  assert.match(css, /:focus-visible/)
  assert.match(returns, /role="dialog"/)
  assert.match(returns, /aria-modal="true"/)
  assert.match(returns, /requestAnimationFrame/)
  assert.match(layout, /aria-label="주요 메뉴"/)
})

test('layout restores backup failures that occurred before it mounted', () => {
  const layout = source('client/src/components/Layout.jsx')

  assert.match(layout, /api\.get\('\/health'\)/)
  assert.match(layout, /applyBackupStatus\(data\.backup\)/)
  assert.match(layout, /status\?\.success === false/)
  assert.match(layout, /role="alert"/)
})
