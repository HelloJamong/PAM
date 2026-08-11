const express = require('express')
const router = express.Router()
const db = require('../db')
const { requireAuth, requirePasswordReady } = require('../auth')
const { validateLoanDates } = require('../validation')
const { backupAfterMutation } = require('../utils/backup')
const { parsePagination, paginationMeta } = require('../pagination')

router.use(requireAuth, requirePasswordReady)

// GET /api/loans?status=&search=
router.get('/', (req, res, next) => {
  try {
    const { status, search } = req.query
    let fromWhere = `
      FROM loan_records lr
      JOIN assets a ON lr.asset_id = a.id
      WHERE 1=1`
    const params = []

    if (status) {
      fromWhere += ' AND lr.status = ?'
      params.push(status)
    }
    if (search) {
      fromWhere += ' AND (a.asset_no LIKE ? OR a.model_name LIKE ? OR lr.user_name LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like)
    }

    let sql = `SELECT lr.*, a.asset_no, a.model_name, a.serial_no ${fromWhere}`
    const pagination = parsePagination(req.query)
    sql += ' ORDER BY lr.created_at DESC, lr.id DESC'
    if (pagination) sql += ' LIMIT ? OFFSET ?'
    const loans = pagination
      ? db.prepare(sql).all(...params, pagination.limit, pagination.offset)
      : db.prepare(sql).all(...params)
    const response = { success: true, data: loans }
    if (pagination) {
      const total = db.prepare(`SELECT COUNT(*) AS count ${fromWhere}`).get(...params).count
      response.pagination = paginationMeta(total, pagination)
    }
    res.json(response)
  } catch (err) {
    next(err)
  }
})

// POST /api/loans/checkout
router.post('/checkout', async (req, res, next) => {
  try {
    const {
      asset_id, user_name, company_name, phone,
      checkout_date, expected_return_date, checkout_confirmed_by, note,
    } = req.body

    if (!asset_id || !user_name || !checkout_date) {
      return res.status(400).json({ success: false, message: '자산, 반출자명, 반출일은 필수입니다.' })
    }
    const dateError = validateLoanDates({
      checkoutDate: checkout_date,
      expectedReturnDate: expected_return_date,
    })
    if (dateError) {
      return res.status(400).json({ success: false, message: dateError })
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
    const backup = await backupAfterMutation(db, '반출 등록')
    res.status(201).json({ success: true, data: record, backup })
  } catch (err) {
    next(err)
  }
})

// PUT /api/loans/:id/return
router.put('/:id/return', async (req, res, next) => {
  try {
    const { id } = req.params
    const { return_date, return_confirmed_by, note } = req.body

    const loan = db.prepare('SELECT * FROM loan_records WHERE id = ?').get(id)
    if (!loan) return res.status(404).json({ success: false, message: '반출 이력을 찾을 수 없습니다.' })
    if (loan.status !== '반출중') {
      return res.status(400).json({ success: false, message: '반출중인 이력만 반납 처리할 수 있습니다.' })
    }

    const actualReturnDate = return_date || new Date().toISOString().slice(0, 10)
    const dateError = validateLoanDates({ checkoutDate: loan.checkout_date, returnDate: actualReturnDate })
    if (dateError) {
      return res.status(400).json({ success: false, message: dateError })
    }

    const returnOp = db.transaction(() => {
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
    const backup = await backupAfterMutation(db, '반납 처리')
    res.json({ success: true, data: updated, backup })
  } catch (err) {
    next(err)
  }
})

module.exports = router
