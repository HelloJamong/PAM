const test = require('node:test')
const assert = require('node:assert/strict')

const { buildAssetsCsv } = require('../server/utils/csv')

test('CSV export neutralizes spreadsheet formula prefixes', () => {
  const csv = buildAssetsCsv([{
    asset_no: '=HYPERLINK("https://example.invalid")',
    model_name: '+SUM(1,1)',
    serial_no: '  @command',
    status: '보관중',
    note: '-danger',
  }])

  assert.match(csv, /'=/)
  assert.match(csv, /'\+SUM/)
  assert.match(csv, /'  @command/)
  assert.match(csv, /'-danger/)
})
