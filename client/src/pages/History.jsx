import React, { useState, useEffect } from 'react'
import { api } from '../api.js'
import Pagination from '../components/Pagination.jsx'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'

export default function History() {
  const [loans, setLoans] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const debouncedSearch = useDebouncedValue(search)

  const load = () => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (statusFilter) params.set('status', statusFilter)
    params.set('page', page)
    params.set('limit', '25')
    api.get(`/loans?${params}`)
      .then(res => {
        if (res.pagination.page > res.pagination.totalPages) {
          setPage(res.pagination.totalPages)
          return
        }
        setLoans(res.data)
        setPagination(res.pagination)
        setError('')
      })
      .catch(err => setError(err.message))
  }

  useEffect(() => { load() }, [debouncedSearch, statusFilter, page])

  const handleDownload = async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    try {
      setError('')
      const res = await api.get(`/export/loans.csv?${params}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `loans_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">이력 조회</h1>
      </div>

      <div className="card">
        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="toolbar">
          <input
            aria-label="이력 검색"
            placeholder="자산번호 / 모델명 / 반출자 검색"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
          <select
            aria-label="이력 상태 필터"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">전체 상태</option>
            <option value="반출중">반출중</option>
            <option value="반납완료">반납완료</option>
          </select>
          <div className="toolbar-spacer" />
          <button className="btn btn-secondary" onClick={handleDownload}>CSV 다운로드</button>
        </div>

        <div className="table-wrap">
          {loans.length === 0 ? (
            <div className="empty-state">이력이 없습니다.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>자산번호</th>
                  <th>모델명</th>
                  <th>반출자</th>
                  <th>소속업체</th>
                  <th>연락처</th>
                  <th>반출일</th>
                  <th>반납예정일</th>
                  <th>반납일</th>
                  <th>반출확인자</th>
                  <th>반납확인자</th>
                  <th>상태</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {loans.map(l => (
                  <tr key={l.id}>
                    <td>{l.asset_no}</td>
                    <td>{l.model_name}</td>
                    <td>{l.user_name}</td>
                    <td>{l.company_name || '-'}</td>
                    <td>{l.phone || '-'}</td>
                    <td>{l.checkout_date}</td>
                    <td>{l.expected_return_date || '-'}</td>
                    <td>{l.return_date || '-'}</td>
                    <td>{l.checkout_confirmed_by || '-'}</td>
                    <td>{l.return_confirmed_by || '-'}</td>
                    <td><span className={`badge badge-${l.status}`}>{l.status}</span></td>
                    <td>{l.note || '-'}</td>
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
