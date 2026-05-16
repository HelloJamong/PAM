import React, { useState, useEffect } from 'react'
import { api } from '../api.js'

const today = () => new Date().toISOString().slice(0, 10)

export default function Return() {
  const [loans, setLoans] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ return_date: today(), return_confirmed_by: '', note: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = () => {
    api.get('/loans?status=반출중').then(res => setLoans(res.data)).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const openModal = loan => {
    setModal(loan)
    setForm({ return_date: today(), return_confirmed_by: '', note: '' })
    setError('')
  }

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleReturn = async e => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.put(`/loans/${modal.id}/return`, form)
      setModal(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">반납 처리</h1>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loans.length === 0 ? (
            <div className="empty-state">반출중인 자산이 없습니다.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>자산번호</th>
                  <th>모델명</th>
                  <th>반출자</th>
                  <th>소속업체</th>
                  <th>반출일</th>
                  <th>반납예정일</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loans.map(l => (
                  <tr key={l.id}>
                    <td>{l.asset_no}</td>
                    <td>{l.model_name}</td>
                    <td>{l.user_name}</td>
                    <td>{l.company_name || '-'}</td>
                    <td>{l.checkout_date}</td>
                    <td>{l.expected_return_date || '-'}</td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => openModal(l)}>
                        반납 처리
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="modal">
            <div className="modal-title">반납 처리 — {modal.asset_no}</div>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleReturn}>
              <div className="form-group">
                <label>반납일 *</label>
                <input type="date" name="return_date" value={form.return_date} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>반납확인자</label>
                <input name="return_confirmed_by" value={form.return_confirmed_by} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>비고</label>
                <input name="note" value={form.note} onChange={handleChange} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>취소</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '처리 중...' : '반납 확인'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
