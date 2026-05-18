import React from 'react'
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
      <nav className="sidebar">
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
