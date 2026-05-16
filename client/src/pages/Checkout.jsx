import React, { useState, useEffect } from 'react'
import { api } from '../api.js'

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY_FORM = { asset_id: '', user_name: '', company_name: '', phone: '', checkout_date: today(), expected_return_date: '', checkout_confirmed_by: '', note: '' }

export default function Checkout() {
  const [assets, setAssets] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const loadAssets = () => {
    api.get('/assets?status=보관중').then(res => setAssets(res.data)).catch(() => {})
  }

  useEffect(() => { loadAssets() }, [])

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setError(''); setMessage(''); setLoading(true)
    try {
      await api.post('/loans/checkout', { ...form, asset_id: Number(form.asset_id) })
      setMessage('반출이 등록되었습니다.')
      setForm(EMPTY_FORM)
      loadAssets()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">반출 등록</h1>
      </div>

      <div className="card">
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>자산 선택 *</label>
            <select name="asset_id" value={form.asset_id} onChange={handleChange} required>
              <option value="">-- 보관중 자산 선택 --</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>{a.asset_no} / {a.model_name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>반출자명 *</label>
              <input name="user_name" value={form.user_name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>소속업체</label>
              <input name="company_name" value={form.company_name} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>연락처</label>
              <input name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>반출확인자</label>
              <input name="checkout_confirmed_by" value={form.checkout_confirmed_by} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>반출일 *</label>
              <input type="date" name="checkout_date" value={form.checkout_date} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>반납예정일</label>
              <input type="date" name="expected_return_date" value={form.expected_return_date} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label>비고</label>
            <input name="note" value={form.note} onChange={handleChange} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '등록 중...' : '반출 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
