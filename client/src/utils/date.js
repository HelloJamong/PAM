// YYYY-MM-DD (input[type=date] 값 및 서버 전송용)
export const today = () => new Date().toISOString().slice(0, 10)

// YYYYMMDD (다운로드 파일명용)
export const todayCompact = () => today().replace(/-/g, '')
