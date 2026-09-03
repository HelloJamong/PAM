import React, { useState } from 'react'
import { api } from '../api.js'
import Pagination from '../components/Pagination.jsx'
import { usePaginatedList } from '../hooks/usePaginatedList.js'
import { todayCompact } from '../utils/date.js'

export default function History() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const {
    items: loans, pagination, error, setError, setPage,
  } = usePaginatedList('/loans', { search, status: statusFilter })

  const handleDownload = async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    try {
      setError('')
      await api.download(`/export/loans.csv?${params}`, `loans_${todayCompact()}.csv`)
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
