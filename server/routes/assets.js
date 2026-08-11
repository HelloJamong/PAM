const express = require('express')
const router = express.Router()
const db = require('../db')
const { requireAuth, requirePasswordReady } = require('../auth')
const { buildAssetsCsv, buildAssetsTemplateCsv, parseAssetsCsv } = require('../utils/csv')
const { validateAssetStatusTransition } = require('../validation')
const { backupAfterMutation } = require('../utils/backup')
const { parsePagination, paginationMeta } = require('../pagination')

router.use(requireAuth, requirePasswordReady)

// GET /api/assets?status=&search=
router.get('/', (req, res, next) => {
  try {
    const { status, search } = req.query
    let where = ' WHERE 1=1'
    const params = []

    if (status) {
      where += ' AND status = ?'
      params.push(status)
    }
    if (search) {
      where += ' AND (asset_no LIKE ? OR model_name LIKE ? OR serial_no LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like)
    }

    const pagination = parsePagination(req.query)
    let sql = `SELECT * FROM assets${where} ORDER BY created_at DESC, id DESC`
    if (pagination) sql += ' LIMIT ? OFFSET ?'
    const assets = pagination
      ? db.prepare(sql).all(...params, pagination.limit, pagination.offset)
      : db.prepare(sql).all(...params)
    const response = { success: true, data: assets }
    if (pagination) {
      const total = db.prepare(`SELECT COUNT(*) AS count FROM assets${where}`).get(...params).count
      response.pagination = paginationMeta(total, pagination)
    }
    res.json(response)
  } catch (err) {
    next(err)
  }
})


function sendCsv(res, csv, filename) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(Buffer.from(csv, 'utf8'))
}

// GET /api/assets/export.csv?status=&search=
router.get('/export.csv', (req, res, next) => {
  try {
    const { status, search } = req.query
    let sql = 'SELECT asset_no, model_name, serial_no, status, note FROM assets WHERE 1=1'
    const params = []

    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    if (search) {
      sql += ' AND (asset_no LIKE ? OR model_name LIKE ? OR serial_no LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like)
    }

    sql += ' ORDER BY created_at DESC'
    const rows = db.prepare(sql).all(...params)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    sendCsv(res, buildAssetsCsv(rows), `assets_${today}.csv`)
  } catch (err) {
    next(err)
  }
})

// GET /api/assets/template.csv
router.get('/template.csv', (req, res, next) => {
  try {
    sendCsv(res, buildAssetsTemplateCsv(), 'assets_import_template.csv')
  } catch (err) {
    next(err)
  }
})

// POST /api/assets/import
router.post('/import', async (req, res, next) => {
  try {
    const { csv } = req.body || {}
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ success: false, message: 'CSV 파일 내용이 필요합니다.' })
    }
    if (Buffer.byteLength(csv, 'utf8') > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'CSV 파일은 5MB 이하만 가져올 수 있습니다.' })
    }

    const assets = parseAssetsCsv(csv)
    const existingStmt = db.prepare('SELECT id, status FROM assets WHERE asset_no = ?')
    const insertStmt = db.prepare(
      'INSERT INTO assets (asset_no, model_name, serial_no, status, note) VALUES (?, ?, ?, ?, ?)'
    )
    const updateStmt = db.prepare(
      `UPDATE assets SET model_name=?, serial_no=?, status=?, note=?,
       updated_at=datetime('now','localtime') WHERE asset_no=?`
    )

    const result = db.transaction(items => {
      let created = 0
      let updated = 0
      for (const asset of items) {
        const existing = existingStmt.get(asset.asset_no)
        const transitionError = validateAssetStatusTransition(existing?.status, asset.status)
        if (transitionError) {
          const err = new Error(`${asset.asset_no}: ${transitionError}`)
          err.status = 400
          throw err
        }
        if (existing) {
          updateStmt.run(asset.model_name, asset.serial_no, asset.status, asset.note, asset.asset_no)
          updated += 1
        } else {
          insertStmt.run(asset.asset_no, asset.model_name, asset.serial_no, asset.status, asset.note)
          created += 1
        }
      }
      return { total: items.length, created, updated }
    })(assets)

    const backup = await backupAfterMutation(db, '자산 CSV 가져오기')
    res.json({ success: true, data: result, backup })
  } catch (err) {
    next(err)
  }
})

// POST /api/assets
router.post('/', async (req, res, next) => {
  try {
    const { asset_no, model_name, serial_no, status = '보관중', note } = req.body
    if (!asset_no || !model_name) {
      return res.status(400).json({ success: false, message: '자산번호와 모델명은 필수입니다.' })
    }
    const transitionError = validateAssetStatusTransition(null, status)
    if (transitionError) {
      return res.status(400).json({ success: false, message: transitionError })
    }
    try {
      const result = db.prepare(
        'INSERT INTO assets (asset_no, model_name, serial_no, status, note) VALUES (?, ?, ?, ?, ?)'
      ).run(asset_no, model_name, serial_no || null, status, note || null)
      const created = db.prepare('SELECT * FROM assets WHERE id = ?').get(result.lastInsertRowid)
      const backup = await backupAfterMutation(db, '자산 등록')
      res.status(201).json({ success: true, data: created, backup })
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ success: false, message: '이미 존재하는 자산번호입니다.' })
      }
      throw err
    }
  } catch (err) {
    next(err)
  }
})

// PUT /api/assets/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { asset_no, model_name, serial_no, status, note } = req.body
    if (!asset_no || !model_name) {
      return res.status(400).json({ success: false, message: '자산번호와 모델명은 필수입니다.' })
    }
    const asset = db.prepare('SELECT id, status FROM assets WHERE id = ?').get(id)
    if (!asset) return res.status(404).json({ success: false, message: '자산을 찾을 수 없습니다.' })
    const transitionError = validateAssetStatusTransition(asset.status, status)
    if (transitionError) {
      return res.status(400).json({ success: false, message: transitionError })
    }

    try {
      db.prepare(
        `UPDATE assets SET asset_no=?, model_name=?, serial_no=?, status=?, note=?,
         updated_at=datetime('now','localtime') WHERE id=?`
      ).run(asset_no, model_name, serial_no || null, status, note || null, id)
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ success: false, message: '이미 존재하는 자산번호입니다.' })
      }
      throw err
    }

    const updated = db.prepare('SELECT * FROM assets WHERE id = ?').get(id)
    const backup = await backupAfterMutation(db, '자산 수정')
    res.json({ success: true, data: updated, backup })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/assets/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id)
    if (!asset) return res.status(404).json({ success: false, message: '자산을 찾을 수 없습니다.' })
    if (asset.status === '반출중') {
      return res.status(400).json({ success: false, message: '반출중인 자산은 삭제할 수 없습니다.' })
    }
    db.transaction(() => {
      db.prepare('DELETE FROM loan_records WHERE asset_id = ?').run(id)
      db.prepare('DELETE FROM assets WHERE id = ?').run(id)
    })()
    const backup = await backupAfterMutation(db, '자산 삭제')
    res.json({ success: true, backup })
  } catch (err) {
    next(err)
  }
})

module.exports = router
