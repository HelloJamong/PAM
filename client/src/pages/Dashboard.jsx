import React, { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/dashboard')
      .then(res => setData(res.data))
      .catch(err => setError(err.message))
  }, [])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">대시보드</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      {data && (
        <>
          <div className="stat-grid">
            <div className="stat-card primary">
              <div className="stat-label">전체 자산</div>
              <div className="stat-value">{data.total}</div>
            </div>
            <div className="stat-card success">
              <div className="stat-label">보관중</div>
              <div className="stat-value">{data.stored}</div>
            </div>
            <div className="stat-card warning">
              <div className="stat-label">반출중</div>
              <div className="stat-value">{data.checkedOut}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">최근 반출/반납 이력</div>
            <div className="table-wrap">
              {data.recent.length === 0 ? (
                <div className="empty-state">이력이 없습니다.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>자산번호</th>
                      <th>모델명</th>
                      <th>반출자</th>
                      <th>반출일</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map(r => (
                      <tr key={r.id}>
                        <td>{r.asset_no}</td>
                        <td>{r.model_name}</td>
                        <td>{r.user_name}</td>
                        <td>{r.checkout_date}</td>
                        <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
