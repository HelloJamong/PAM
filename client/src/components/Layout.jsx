import React, { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import PasswordChangeModal from './PasswordChangeModal.jsx'

const NAV_ITEMS = [
  { to: '/',         label: '대시보드', end: true },
  { to: '/assets',   label: '자산 관리' },
  { to: '/checkout', label: '반출 등록' },
  { to: '/return',   label: '반납 처리' },
  { to: '/history',  label: '이력 조회' },
]

export default function Layout({ children, onLogout, passwordChangeRequired, onPasswordChanged }) {
  const navigate = useNavigate()
  const [backupWarning, setBackupWarning] = useState('')

  useEffect(() => {
    let active = true
    const applyBackupStatus = status => {
      if (!active) return
      setBackupWarning(status?.success === false
        ? status.message || '최근 자동 백업에 실패했습니다. 저장 공간과 backup 폴더를 확인해주세요.'
        : '')
    }
    const backupStatusHandler = event => {
      applyBackupStatus(event.detail)
    }
    window.addEventListener('pam:backup-status', backupStatusHandler)
    api.get('/health')
      .then(data => applyBackupStatus(data.backup))
      .catch(() => {
        if (active) setBackupWarning('자동 백업 상태를 확인하지 못했습니다. 서버 연결 상태를 확인해주세요.')
      })
    return () => {
      active = false
      window.removeEventListener('pam:backup-status', backupStatusHandler)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      onLogout()
      navigate('/login')
    }
  }

  return (
    <div className="app-layout">
      <nav className="sidebar" aria-label="주요 메뉴">
        <div className="sidebar-header">
          <img src="/pam-logo.png" alt="PAM" className="sidebar-logo" />
          <span className="sidebar-title">PAM</span>
        </div>
        <ul className="nav-list">
          {NAV_ITEMS.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-logout">로그아웃</button>
        </div>
      </nav>
      <main className="main-content">
        {backupWarning && <div className="error-message" role="alert">{backupWarning}</div>}
        {passwordChangeRequired ? (
          <div className="password-required-placeholder">
            비밀번호 변경 후 시스템을 이용할 수 있습니다.
          </div>
        ) : children}
      </main>
      {passwordChangeRequired && <PasswordChangeModal onChanged={onPasswordChanged} />}
    </div>
  )
}
