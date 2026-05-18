const express = require('express')
const router = express.Router()
const db = require('../db')
const { requireAuth, requirePasswordReady } = require('../auth')

router.use(requireAuth, requirePasswordReady)

// GET /api/dashboard
router.get('/', (req, res, next) => {
  try {
    const total    = db.prepare("SELECT COUNT(*) as cnt FROM assets").get().cnt
    const stored   = db.prepare("SELECT COUNT(*) as cnt FROM assets WHERE status='보관중'").get().cnt
    const checkedOut = db.prepare("SELECT COUNT(*) as cnt FROM assets WHERE status='반출중'").get().cnt

    const recent = db.prepare(`
      SELECT lr.*, a.asset_no, a.model_name
      FROM loan_records lr
      JOIN assets a ON lr.asset_id = a.id
      ORDER BY lr.created_at DESC
      LIMIT 5
    `).all()

    res.json({
      success: true,
      data: { total, stored, checkedOut, recent },
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
