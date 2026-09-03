const BASE = '/api'

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  }
  if (body !== undefined) {
    opts.body = JSON.stringify(body)
  }

  const res = await fetch(BASE + path, opts)

  if (res.status === 401) {
    window.dispatchEvent(new Event('pam:unauthorized'))
    throw new Error('UNAUTHORIZED')
  }

  // CSV 다운로드 등 JSON이 아닌 응답 처리
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    if (!res.ok) throw new Error('요청 처리 중 오류가 발생했습니다.')
    return res
  }

  const data = await res.json()
  if (!res.ok) {
    if (res.status === 403 && data.code === 'PASSWORD_CHANGE_REQUIRED') {
      window.dispatchEvent(new Event('pam:password-change-required'))
    }
    throw new Error(data.message || '요청 처리 중 오류가 발생했습니다.')
  }
  if (data.backup) {
    window.dispatchEvent(new CustomEvent('pam:backup-status', { detail: data.backup }))
  }
  return data
}

async function download(path, filename) {
  const res = await request('GET', path)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),
  download,
}
