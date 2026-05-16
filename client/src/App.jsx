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

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => setAuthenticated(r.ok))
      .catch(() => setAuthenticated(false))
  }, [])

  useEffect(() => {
    const handler = () => setAuthenticated(false)
    window.addEventListener('pam:unauthorized', handler)
    return () => window.removeEventListener('pam:unauthorized', handler)
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
              : <Login onLogin={() => setAuthenticated(true)} />
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute authenticated={authenticated}>
              <Layout onLogout={() => setAuthenticated(false)}>
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
