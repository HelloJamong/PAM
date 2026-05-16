const express = require('express')
const router = express.Router()
const db = require('../db')
const { requireAuth } = require('../auth')
const { buildCsv } = require('../utils/csv')

router.use(requireAuth)

// GET /api/export/loans.csv?status=&search=
router.get('/loans.csv', (req, res, next) => {
  try {
    const { status, search } = req.query
    let sql = `
      SELECT a.asset_no, a.model_name, a.serial_no,
             lr.user_name, lr.company_name, lr.phone,
             lr.checkout_date, lr.expected_return_date, lr.return_date,
             lr.checkout_confirmed_by, lr.return_confirmed_by, lr.status, lr.note
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
    const rows = db.prepare(sql).all(...params)
    const csv = buildCsv(rows)

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="loans_${today}.csv"`)
    res.send(Buffer.from(csv, 'utf8'))
  } catch (err) {
    next(err)
  }
})

module.exports = router
