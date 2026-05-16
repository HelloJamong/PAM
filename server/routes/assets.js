const express = require('express')
const router = express.Router()
const db = require('../db')
const { requireAuth } = require('../auth')

router.use(requireAuth)

// GET /api/assets?status=&search=
router.get('/', (req, res, next) => {
  try {
    const { status, search } = req.query
    let sql = 'SELECT * FROM assets WHERE 1=1'
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
    const assets = db.prepare(sql).all(...params)
    res.json({ success: true, data: assets })
  } catch (err) {
    next(err)
  }
})

// POST /api/assets
router.post('/', (req, res, next) => {
  try {
    const { asset_no, model_name, serial_no, status = '보관중', note } = req.body
    if (!asset_no || !model_name) {
      return res.status(400).json({ success: false, message: '자산번호와 모델명은 필수입니다.' })
    }
    try {
      const result = db.prepare(
        'INSERT INTO assets (asset_no, model_name, serial_no, status, note) VALUES (?, ?, ?, ?, ?)'
      ).run(asset_no, model_name, serial_no || null, status, note || null)
      const created = db.prepare('SELECT * FROM assets WHERE id = ?').get(result.lastInsertRowid)
      res.status(201).json({ success: true, data: created })
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
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const { asset_no, model_name, serial_no, status, note } = req.body
    if (!asset_no || !model_name) {
      return res.status(400).json({ success: false, message: '자산번호와 모델명은 필수입니다.' })
    }
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(id)
    if (!asset) return res.status(404).json({ success: false, message: '자산을 찾을 수 없습니다.' })

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
    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/assets/:id
router.delete('/:id', (req, res, next) => {
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
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
