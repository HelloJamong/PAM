import React, { useState, useEffect, useRef } from 'react'
import { api } from '../api.js'
import Pagination from '../components/Pagination.jsx'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'

const EMPTY_FORM = { asset_no: '', model_name: '', serial_no: '', status: '보관중', note: '' }

function todayKey() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

async function downloadCsv(response, filename) {
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Assets() {
  const [assets, setAssets] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [importing, setImporting] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const fileInputRef = useRef(null)
  const debouncedSearch = useDebouncedValue(search)

  const load = () => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (statusFilter) params.set('status', statusFilter)
    params.set('page', page)
    params.set('limit', '25')
    api.get(`/assets?${params}`)
      .then(res => {
        if (res.pagination.page > res.pagination.totalPages) {
          setPage(res.pagination.totalPages)
          return
        }
        setAssets(res.data)
        setPagination(res.pagination)
        setError('')
      })
      .catch(err => setError(err.message))
  }

  useEffect(() => { load() }, [debouncedSearch, statusFilter, page])

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setError(''); setMessage('')
    try {
      if (editId) {
        await api.put(`/assets/${editId}`, form)
        setMessage('자산이 수정되었습니다.')
      } else {
        await api.post('/assets', form)
        setMessage('자산이 등록되었습니다.')
      }
      setForm(EMPTY_FORM); setEditId(null); load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleEdit = asset => {
    setEditId(asset.id)
    setForm({ asset_no: asset.asset_no, model_name: asset.model_name, serial_no: asset.serial_no || '', status: asset.status, note: asset.note || '' })
    setError(''); setMessage('')
  }

  const handleDelete = async asset => {
    if (!window.confirm(`"${asset.asset_no}" 자산을 삭제하시겠습니까?`)) return
    setError(''); setMessage('')
    try {
      await api.delete(`/assets/${asset.id}`)
      setMessage('자산이 삭제되었습니다.')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCancel = () => { setEditId(null); setForm(EMPTY_FORM); setError(''); setMessage('') }

  const handleExport = async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    setError(''); setMessage('')
    try {
      const res = await api.get(`/assets/export.csv?${params}`)
      await downloadCsv(res, `assets_${todayKey()}.csv`)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleTemplateDownload = async () => {
    setError(''); setMessage('')
    try {
      const res = await api.get('/assets/template.csv')
      await downloadCsv(res, 'assets_import_template.csv')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportFile = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(''); setMessage('')
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('CSV 확장자 파일만 가져올 수 있습니다.')
      return
    }

    setImporting(true)
    try {
      const csv = await file.text()
      const res = await api.post('/assets/import', { csv })
      const { total, created, updated } = res.data
      setMessage(`CSV 가져오기 완료: 총 ${total}건, 신규 ${created}건, 업데이트 ${updated}건`)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">자산 관리</h1>
      </div>

      <div className="card">
        <div className="card-title">{editId ? '자산 수정' : '자산 등록'}</div>
        {error && <div className="error-message" role="alert">{error}</div>}
        {message && <div className="success-message" role="status">{message}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="asset_no">자산번호 *</label>
              <input id="asset_no" name="asset_no" value={form.asset_no} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="model_name">모델명 *</label>
              <input id="model_name" name="model_name" value={form.model_name} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="serial_no">시리얼번호</label>
              <input id="serial_no" name="serial_no" value={form.serial_no} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="asset_status">상태</label>
              <select
                id="asset_status"
                name="status"
                value={form.status}
                onChange={handleChange}
                disabled={form.status === '반출중'}
              >
                <option value="보관중">보관중</option>
                <option value="폐기">폐기</option>
                {form.status === '반출중' && (
                  <option value="반출중">반출중 (반납 처리에서 변경)</option>
                )}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="asset_note">비고</label>
            <input id="asset_note" name="note" value={form.note} onChange={handleChange} />
          </div>
          <div className="form-actions">
            {editId && <button type="button" className="btn btn-secondary" onClick={handleCancel}>취소</button>}
            <button type="submit" className="btn btn-primary">{editId ? '수정 저장' : '등록'}</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            aria-label="자산 검색"
            placeholder="자산번호 / 모델명 / 시리얼번호 검색"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
          <select
            aria-label="자산 상태 필터"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">전체 상태</option>
            <option value="보관중">보관중</option>
            <option value="반출중">반출중</option>
            <option value="폐기">폐기</option>
          </select>
          <div className="toolbar-spacer" />
          <button className="btn btn-secondary" onClick={handleTemplateDownload}>입력 양식 다운로드</button>
          <button className="btn btn-secondary" onClick={handleExport}>CSV 내보내기</button>
          <button className="btn btn-primary" onClick={handleImportClick} disabled={importing}>
            {importing ? '가져오는 중...' : 'CSV 가져오기'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
        <div className="table-wrap">
          {assets.length === 0 ? (
            <div className="empty-state">등록된 자산이 없습니다.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>자산번호</th>
                  <th>모델명</th>
                  <th>시리얼번호</th>
                  <th>상태</th>
                  <th>비고</th>
                  <th>등록일</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.id}>
                    <td>{a.asset_no}</td>
                    <td>{a.model_name}</td>
                    <td>{a.serial_no || '-'}</td>
                    <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                    <td>{a.note || '-'}</td>
                    <td>{a.created_at?.slice(0, 10)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(a)}>수정</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>
    </div>
  )
}
