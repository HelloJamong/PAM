import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Assets from './pages/Assets.jsx'
import Checkout from './pages/Checkout.jsx'
import Return from './pages/Return.jsx'
import History from './pages/History.jsx'
import Layout from './components/Layout.jsx'
import './index.css'

function ProtectedRoute({ authenticated, children }) {
  if (!authenticated) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(null)
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async r => {
        if (!r.ok) {
          setAuthenticated(false)
          setPasswordChangeRequired(false)
          return
        }
        const data = await r.json()
        setAuthenticated(true)
        setPasswordChangeRequired(Boolean(data.passwordChangeRequired))
      })
      .catch(() => {
        setAuthenticated(false)
        setPasswordChangeRequired(false)
      })
  }, [])

  useEffect(() => {
    const unauthorizedHandler = () => {
      setAuthenticated(false)
      setPasswordChangeRequired(false)
    }
    const passwordChangeHandler = () => setPasswordChangeRequired(true)
    window.addEventListener('pam:unauthorized', unauthorizedHandler)
    window.addEventListener('pam:password-change-required', passwordChangeHandler)
    return () => {
      window.removeEventListener('pam:unauthorized', unauthorizedHandler)
      window.removeEventListener('pam:password-change-required', passwordChangeHandler)
    }
  }, [])

  if (authenticated === null) {
    return <div className="loading">로딩 중...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            authenticated
              ? <Navigate to="/" replace />
              : <Login onLogin={(data) => {
                  setAuthenticated(true)
                  setPasswordChangeRequired(Boolean(data?.passwordChangeRequired))
                }} />
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute authenticated={authenticated}>
              <Layout
                passwordChangeRequired={passwordChangeRequired}
                onPasswordChanged={() => setPasswordChangeRequired(false)}
                onLogout={() => {
                  setAuthenticated(false)
                  setPasswordChangeRequired(false)
                }}
              >
                <Routes>
                  <Route path="/"        element={<Dashboard />} />
                  <Route path="/assets"  element={<Assets />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/return"  element={<Return />} />
                  <Route path="/history" element={<History />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
