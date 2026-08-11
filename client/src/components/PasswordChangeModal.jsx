import React, { useState } from 'react'
import { api } from '../api.js'

const PASSWORD_POLICY_TEXT = '최소 8자리이며, 대문자, 특수문자, 숫자를 모두 포함해야 합니다.'

function validatePassword(password) {
  if (!password || password.length < 8) return '새 비밀번호는 최소 8자리 이상이어야 합니다.'
  if (!/[A-Z]/.test(password)) return '새 비밀번호에는 대문자가 1개 이상 포함되어야 합니다.'
  if (!/\d/.test(password)) return '새 비밀번호에는 숫자가 1개 이상 포함되어야 합니다.'
  if (!/[^A-Za-z0-9]/.test(password)) return '새 비밀번호에는 특수문자가 1개 이상 포함되어야 합니다.'
  return ''
}

export default function PasswordChangeModal({ onChanged }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')

    const policyError = validatePassword(newPassword)
    if (policyError) {
      setError(policyError)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword })
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay password-required-overlay" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="password-change-title">
        <div className="modal-title" id="password-change-title">최초 로그인 비밀번호 변경</div>
        <p className="modal-description">
          초기 비밀번호로 로그인했습니다. 시스템 이용 전 관리자 비밀번호를 변경해주세요.
        </p>
        <div className="password-policy">비밀번호 규칙: {PASSWORD_POLICY_TEXT}</div>
        {error && <div className="error-message" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="currentPassword">현재 비밀번호</label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="newPassword">새 비밀번호</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">새 비밀번호 확인</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
