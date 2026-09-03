const express = require('express')
const session = require('express-session')
const path = require('path')
const crypto = require('crypto')

// DB 초기화 (테이블 자동 생성 + 초기 비밀번호 설정)
const db = require('./db')
const { backupAfterMutation, getBackupStatus } = require('./utils/backup')

const app = express()
const isDev = process.env.NODE_ENV === 'development'
const configuredPort = Number.parseInt(process.env.PAM_PORT, 10)
const PORT = Number.isInteger(configuredPort) ? configuredPort : isDev ? 3001 : 3000
const HOST = '127.0.0.1'

app.use(express.json({ limit: '5mb' }))

// 개발 환경 CORS (Vite 개발 서버 허용)
if (isDev) {
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    if (req.method === 'OPTIONS') return res.sendStatus(200)
    next()
  })
}

// 세션 (서버 재시작마다 새 시크릿 → 재시작 시 세션 만료)
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,       // http 로컬 환경
    maxAge: 8 * 60 * 60 * 1000,  // 8시간
  },
}))

// API 라우트
app.use('/api/auth',    require('./routes/auth'))
app.use('/api/assets',  require('./routes/assets'))
app.use('/api/loans',   require('./routes/loans'))
app.use('/api/dashboard', require('./routes/dashboard'))
app.use('/api/export',  require('./routes/export'))

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'PAM',
    mode: isDev ? 'development' : 'production',
    backup: getBackupStatus(),
  })
})

// 알 수 없는 API 경로는 JSON 404로 응답 (아래 SPA 폴백이 index.html을 200으로 반환하는 것 방지)
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API 경로를 찾을 수 없습니다.' })
})

// 운영 빌드: 정적 파일 서빙 (API 이외 모든 경로 → index.html)
if (!isDev) {
  const publicDir = path.join(__dirname, 'public')
  app.use(express.static(publicDir))
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

// 전역 에러 핸들러
app.use((err, req, res, next) => {
  console.error('[오류]', err.message)
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '서버 오류가 발생했습니다.',
  })
})

async function startServer({ port = PORT, host = HOST } = {}) {
  if (!db.isNewDatabase) {
    await backupAfterMutation(db, '서버 시작')
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const address = server.address()
      console.log(`PAM 서버 실행 중: http://${host}:${address.port}`)
      resolve(server)
    })
    server.once('error', reject)
  })
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('[서버 시작 오류]', err.message)
    process.exitCode = 1
  })
}

module.exports = { app, startServer }
