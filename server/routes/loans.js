const express = require('express')
const router = express.Router()
const db = require('../db')
const { requireAuth } = require('../auth')

router.use(requireAuth)

// GET /api/loans?status=&search=
router.get('/', (req, res, next) => {
  try {
    const { status, search } = req.query
    let sql = `
      SELECT lr.*, a.asset_no, a.model_name, a.serial_no
      FROM loan_records lr
      JOIN assets a ON lr.asset_id = a.id
      WHERE 1=1`
    const params = []

    if (status) {
      sql += ' AND lr.status = ?'
      params.push(status)
    }
    if (search) {
      sql += ' AND (a.asset_no LIKE ? OR a.model_name LIKE ? OR lr.user_name LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like)
    }

    sql += ' ORDER BY lr.created_at DESC'
    const loans = db.prepare(sql).all(...params)
    res.json({ success: true, data: loans })
  } catch (err) {
    next(err)
  }
})

// POST /api/loans/checkout
router.post('/checkout', (req, res, next) => {
  try {
    const {
      asset_id, user_name, company_name, phone,
      checkout_date, expected_return_date, checkout_confirmed_by, note,
    } = req.body

    if (!asset_id || !user_name || !checkout_date) {
      return res.status(400).json({ success: false, message: '자산, 반출자명, 반출일은 필수입니다.' })
    }

    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset_id)
    if (!asset) return res.status(404).json({ success: false, message: '자산을 찾을 수 없습니다.' })
    if (asset.status !== '보관중') {
      return res.status(400).json({ success: false, message: '보관중인 자산만 반출할 수 있습니다.' })
    }

    const checkout = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO loan_records
          (asset_id, user_name, company_name, phone, checkout_date,
           expected_return_date, checkout_confirmed_by, status, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, '반출중', ?)
      `).run(
        asset_id, user_name, company_name || null, phone || null,
        checkout_date, expected_return_date || null, checkout_confirmed_by || null, note || null
      )
      db.prepare(`UPDATE assets SET status='반출중', updated_at=datetime('now','localtime') WHERE id=?`).run(asset_id)
      return db.prepare('SELECT * FROM loan_records WHERE id = ?').get(result.lastInsertRowid)
    })

    const record = checkout()
    res.status(201).json({ success: true, data: record })
  } catch (err) {
    next(err)
  }
})

// PUT /api/loans/:id/return
router.put('/:id/return', (req, res, next) => {
  try {
    const { id } = req.params
    const { return_date, return_confirmed_by, note } = req.body

    const loan = db.prepare('SELECT * FROM loan_records WHERE id = ?').get(id)
    if (!loan) return res.status(404).json({ success: false, message: '반출 이력을 찾을 수 없습니다.' })
    if (loan.status !== '반출중') {
      return res.status(400).json({ success: false, message: '반출중인 이력만 반납 처리할 수 있습니다.' })
    }

    const returnOp = db.transaction(() => {
      const actualReturnDate = return_date || new Date().toISOString().slice(0, 10)
      db.prepare(`
        UPDATE loan_records
        SET status='반납완료', return_date=?, return_confirmed_by=?, note=COALESCE(?,note),
            updated_at=datetime('now','localtime')
        WHERE id=?
      `).run(actualReturnDate, return_confirmed_by || null, note || null, id)
      db.prepare(`UPDATE assets SET status='보관중', updated_at=datetime('now','localtime') WHERE id=?`).run(loan.asset_id)
      return db.prepare('SELECT * FROM loan_records WHERE id = ?').get(id)
    })

    const updated = returnOp()
    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
})

module.exports = router
