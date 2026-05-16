import React, { useState } from 'react'

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (res.ok) {
        onLogin()
      } else {
        setError(data.message || '로그인에 실패했습니다.')
      }
    } catch {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <img src="/pam-logo.png" alt="PAM" />
        </div>
        <h1 className="login-title">PAM</h1>
        <p className="login-subtitle">자산 반출/반납 관리 시스템</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">관리자 비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoFocus
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
