# Spec: Portable Asset Manager (PAM)

## Objective

Windows 폐쇄망 PC에서 설치 없이 실행 가능한 포터블 로컬 웹 기반 자산 반출/반납 관리 시스템.

**목표 사용자:** 외부 상주 인력 장비를 관리하는 담당자  
**운영 환경:** 인터넷 없는 Windows 폐쇄망, 127.0.0.1:3000 로컬 접속  
**성공 기준:**
- `PAM.exe` 더블클릭 → 시스템 트레이 아이콘 등장 + 브라우저 자동 오픈
- 브라우저를 닫아도 서버는 트레이에서 계속 실행
- 트레이 우클릭 → 종료로 서버 완전 종료
- 장비 등록 → 반출 → 반납 전체 워크플로우 동작
- 이력 CSV 내보내기 (Excel 한글 정상 표시)
- 단순 비밀번호 보호로 무단 접근 차단
- 폴더 복사만으로 다른 PC에서 동일하게 실행 가능

---

## Tech Stack

| 구분 | 선택 | 버전 |
|------|------|------|
| Launcher | Go (트레이 런처) | Go 1.22+, getlantern/systray |
| Frontend | React + Vite | React 18, Vite 5 |
| Backend | Node.js + Express | Node 20 LTS, Express 4 |
| Database | SQLite | better-sqlite3 |
| Auth | 단순 비밀번호 (세션 기반) | express-session |
| Runtime | 포터블 Node.js | node.exe Windows x64 동봉 |
| CSV | UTF-8 BOM 형식 | 직접 구현 |

---

## Commands

```bash
# 개발 (Node.js)
npm install                    # 루트 의존성 설치
cd client && npm install       # 프론트엔드 의존성 설치
npm run dev                    # Vite(5173) + Express(3001) 동시 실행

# 운영 빌드 (Node.js)
npm run build                  # Vite 빌드 → server/public/ 출력

# Go 런처 빌드 (Windows 타깃)
cd launcher
go mod tidy
GOOS=windows GOARCH=amd64 go build -ldflags="-H windowsgui" -o ../PAM.exe .

# 유틸
npm run seed                   # 샘플 데이터 삽입 (선택)
```

> `-H windowsgui` 플래그: 실행 시 CMD 창 없이 트레이만 표시

---

## Project Structure

```
PortableAssetManager/
├─ PAM.exe                  # Go 트레이 런처 빌드 결과물 (배포 시 포함)
├─ launcher/                # Go 소스 (개발용, 배포 시 불필요)
│  ├─ main.go               # 트레이 아이콘, Node 자식 프로세스 관리
│  ├─ go.mod
│  └─ go.sum
├─ runtime/                 # 포터블 Node.js 런타임
│  └─ node.exe              # Node.js Windows x64 단일 실행 파일
├─ server/
│  ├─ index.js              # Express 진입점, 127.0.0.1:3000 바인딩
│  ├─ db.js                 # SQLite 초기화, 테이블 자동 생성
│  ├─ auth.js               # 비밀번호 확인, 세션 미들웨어
│  ├─ routes/
│  │  ├─ assets.js          # GET/POST/PUT/DELETE /api/assets
│  │  ├─ loans.js           # GET /api/loans, checkout, return
│  │  ├─ dashboard.js       # GET /api/dashboard
│  │  └─ export.js          # GET /api/export/loans.csv
│  └─ utils/
│     ├─ backup.js          # 서버 시작 시 자동 백업
│     └─ csv.js             # UTF-8 BOM CSV 생성
├─ client/
│  ├─ index.html
│  ├─ package.json
│  └─ src/
│     ├─ main.jsx
│     ├─ App.jsx            # 라우팅, 인증 상태 관리
│     ├─ api.js             # fetch 래퍼
│     ├─ pages/
│     │  ├─ Login.jsx
│     │  ├─ Dashboard.jsx
│     │  ├─ Assets.jsx
│     │  ├─ Checkout.jsx
│     │  ├─ Return.jsx
│     │  └─ History.jsx
│     └─ components/
│        ├─ Layout.jsx      # 공통 네비게이션, 로그아웃
│        ├─ AssetForm.jsx
│        ├─ LoanForm.jsx
│        └─ DataTable.jsx
├─ server/public/           # Vite 빌드 결과물 (Express가 정적 서빙)
├─ data/
│  └─ pam.db                # SQLite DB (첫 실행 시 자동 생성)
├─ backup/                  # 자동 백업 DB 저장
├─ package.json             # 루트 Node.js 스크립트
└─ README.md
```

---

## Launcher (PAM.exe) 동작 명세

### 실행 흐름

```
PAM.exe 더블클릭
  │
  ├─ 중복 실행 감지: 포트 3000 이미 사용 중이면 브라우저만 오픈 후 종료
  ├─ runtime/node.exe server/index.js 를 자식 프로세스로 시작 (백그라운드)
  ├─ 서버 준비 대기: http://127.0.0.1:3000 에 최대 10초간 폴링
  ├─ 준비 완료 → 기본 브라우저로 http://127.0.0.1:3000 자동 오픈
  └─ 시스템 트레이 아이콘 표시 (이후 Go는 트레이 이벤트 루프 대기)
```

### 트레이 아이콘 상태

| 상태 | 아이콘 | 툴팁 |
|------|--------|------|
| 서버 실행 중 | 초록 아이콘 | `PAM - 실행 중 (포트 3000)` |
| 서버 오류/크래시 | 빨간 아이콘 | `PAM - 오류 발생` |

### 트레이 우클릭 메뉴

```
┌──────────────────────┐
│  PAM - 실행 중       │  ← 상태 텍스트 (비활성)
├──────────────────────┤
│  열기                │  → 브라우저로 http://127.0.0.1:3000 오픈
│  종료                │  → Node.js 프로세스 kill → PAM.exe 종료
└──────────────────────┘
```

### 종료 흐름

```
트레이 우클릭 → 종료 선택
  ├─ Node.js 자식 프로세스 kill (SIGTERM → 500ms 후 SIGKILL)
  ├─ 트레이 아이콘 제거
  └─ PAM.exe 프로세스 종료
```

### 비정상 종료 감지

- Node.js 자식 프로세스가 예기치 않게 종료되면 트레이 아이콘을 오류 상태로 변경
- 툴팁: `PAM - 서버 오류. 트레이 메뉴에서 재시작하세요`
- 트레이 메뉴에 **재시작** 항목 추가 노출

### 경로 해석 규칙

- 모든 경로는 `PAM.exe` 위치 기준 상대 경로로 해석
- `runtime/node.exe`: Node.js 실행 파일
- `server/index.js`: Express 진입점
- 경로 하드코딩 없음 — `os.Executable()` 로 실행 파일 위치 동적 취득

---

## Database Schema

### assets

```sql
CREATE TABLE assets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_no   TEXT    UNIQUE NOT NULL,
  model_name TEXT    NOT NULL,
  serial_no  TEXT,
  status     TEXT    NOT NULL DEFAULT '보관중',  -- '보관중' | '반출중' | '폐기'
  note       TEXT,
  created_at TEXT    DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT    DEFAULT (datetime('now', 'localtime'))
);
```

### loan_records

```sql
CREATE TABLE loan_records (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id              INTEGER NOT NULL,
  user_name             TEXT    NOT NULL,
  company_name          TEXT,
  phone                 TEXT,
  checkout_date         TEXT    NOT NULL,
  expected_return_date  TEXT,
  return_date           TEXT,
  checkout_confirmed_by TEXT,
  return_confirmed_by   TEXT,
  status                TEXT    NOT NULL,  -- '반출중' | '반납완료'
  note                  TEXT,
  created_at            TEXT    DEFAULT (datetime('now', 'localtime')),
  updated_at            TEXT    DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (asset_id) REFERENCES assets(id)
);
```

### settings

```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- 초기값: key='admin_password', value=SHA256('admin1234')
```

---

## API Requirements

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/auth/login | 비밀번호 확인, 세션 발급 |
| POST | /api/auth/logout | 세션 삭제 |
| GET | /api/auth/me | 세션 유효 확인 |
| GET | /api/assets | 자산 목록 (쿼리: status, search) |
| POST | /api/assets | 자산 등록 |
| PUT | /api/assets/:id | 자산 수정 |
| DELETE | /api/assets/:id | 자산 삭제 (반출중이면 거부) |
| GET | /api/loans | 이력 목록 (쿼리: status, search) |
| POST | /api/loans/checkout | 반출 등록 (자산 상태 → 반출중) |
| PUT | /api/loans/:id/return | 반납 처리 (자산 상태 → 보관중) |
| GET | /api/dashboard | 통계 + 최근 이력 5건 |
| GET | /api/export/loans.csv | 전체 또는 필터 결과 CSV 다운로드 |

모든 `/api/*` 엔드포인트는 세션 인증 필요 (login 제외).

---

## Authentication

- 단일 관리자 비밀번호 방식 (다중 계정 없음)
- 초기 비밀번호: `admin1234` (DB settings 테이블에 SHA-256 해시로 저장)
- 세션 유효 기간: 8시간 (서버 재시작 시 초기화)
- 로그인 실패 시 오류 메시지 표시, 잠금 없음
- 비밀번호 변경: 1차 스코프 외 (직접 DB 수정)
- 프론트엔드: 세션 만료 시 Login 화면으로 리다이렉트

---

## Screen Requirements

### Login
- 비밀번호 입력 폼
- 오류 메시지 (잘못된 비밀번호)

### Dashboard
- 통계 카드: 전체 자산 수, 보관중, 반출중
- 최근 반출/반납 이력 5건 테이블

### Assets
- 자산 등록 폼 (자산번호, 모델명, 시리얼번호, 상태, 비고)
- 자산 목록 테이블 (검색 입력 + 상태 필터 드롭다운)
- 수정/삭제 버튼 (반출중 자산 삭제 시 오류)

### Checkout
- 보관중 자산 드롭다운 선택
- 반출 정보 입력 폼 (반출자명, 소속업체, 연락처, 반출일, 반납예정일, 확인자, 비고)

### Return
- 반출중 자산 목록 테이블
- 각 행에 반납 처리 버튼
- 반납 모달: 반납일, 확인자, 상태메모

### History
- 전체 이력 테이블 (모든 필드)
- 검색 + 상태 필터
- CSV 다운로드 버튼 (현재 필터 반영)

---

## Code Style

```jsx
// React: 함수형 컴포넌트, hooks 사용
export default function AssetForm({ onSubmit }) {
  const [form, setForm] = useState({ asset_no: '', model_name: '', serial_no: '', status: '보관중', note: '' });
  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <input name="asset_no" value={form.asset_no} onChange={handleChange} required />
    </form>
  );
}
```

```js
// Express: async/await, 에러는 next(err)로 전달
router.get('/', async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const assets = db.getAssets({ status, search });
    res.json({ success: true, data: assets });
  } catch (err) {
    next(err);
  }
});
```

```go
// Go: 에러는 명시적 반환, 리소스는 defer로 해제
func startServer(exeDir string) (*exec.Cmd, error) {
    nodePath := filepath.Join(exeDir, "runtime", "node.exe")
    entryPath := filepath.Join(exeDir, "server", "index.js")
    cmd := exec.Command(nodePath, entryPath)
    cmd.Dir = exeDir
    if err := cmd.Start(); err != nil {
        return nil, fmt.Errorf("node 실행 실패: %w", err)
    }
    return cmd, nil
}
```

**네이밍:**
- 파일/폴더: kebab-case (Go 파일 제외)
- React 컴포넌트: PascalCase
- JS 변수/함수: camelCase
- Go 함수/변수: camelCase (exported는 PascalCase)
- DB 컬럼: snake_case
- 상태값: 한글 문자열 (`'보관중'`, `'반출중'`, `'반납완료'`)

---

## Testing Strategy

단위 테스트는 1차 스코프 외. 수동 검증:

1. **자산 CRUD:** 등록 → 목록 확인 → 수정 → 삭제
2. **반출 플로우:** 보관중 자산 선택 → 반출 등록 → 상태 변경 확인
3. **반납 플로우:** 반출중 자산 반납 처리 → 상태 복구 확인
4. **CSV 내보내기:** Excel 열기 → 한글 깨짐 없음 확인
5. **백업:** 서버 재시작 → backup/ 폴더에 새 파일 생성 확인
6. **인증:** 비밀번호 없이 API 호출 → 401 응답 확인
7. **트레이 동작:** PAM.exe 실행 → 트레이 아이콘 확인 → 브라우저 닫아도 트레이 유지 → 종료 클릭 → 프로세스 완전 종료
8. **중복 실행:** PAM.exe 두 번 실행 → 두 번째 실행 시 브라우저만 오픈, 서버 중복 실행 없음
9. **크래시 감지:** Node.js 강제 종료 → 트레이 아이콘 오류 상태 전환 확인

---

## Security Requirements

- Express: `127.0.0.1:3000`으로만 listen (외부 네트워크 차단)
- CORS: 개발 환경(`localhost:5173`)에서만 허용, 운영 빌드에서는 비활성화
- 세션 시크릿: 랜덤 생성 (서버 시작 시마다 새로 생성, 재시작 시 세션 만료)
- 비밀번호: SHA-256 해시 후 DB 저장
- SQL: prepared statement 사용 (better-sqlite3 기본)
- 외부 API 호출 없음, 외부 CDN 없음
- Go 런처: 자식 프로세스 PID 추적, 종료 시 반드시 kill

---

## Boundaries

**Always do:**
- 모든 DB 쿼리는 prepared statement 사용
- 자산 삭제 전 반출중 여부 확인
- 날짜 필드는 `YYYY-MM-DD` 형식으로 저장
- CSV는 UTF-8 BOM(`\xEF\xBB\xBF`) 포함
- Go에서 경로는 항상 `os.Executable()` 기준 상대 경로로 해석

**Ask first:**
- DB 스키마 변경 (컬럼 추가/삭제)
- 비밀번호 정책 변경 (복잡도, 잠금)
- 포트 번호 변경
- 트레이 메뉴 항목 추가

**Never do:**
- `0.0.0.0`으로 서버 바인딩
- 외부 CDN 참조 (Bootstrap CDN 등)
- 평문 비밀번호 DB 저장
- 반출중 자산 강제 삭제
- Go에서 경로를 절대경로로 하드코딩

---

## Auto Backup

- 트리거: `server/index.js` 시작 시 1회
- 소스: `data/pam.db`
- 대상: `backup/pam_YYYYMMDD_HHmmss.db`
- DB 파일이 없으면 백업 스킵 (첫 실행)
- 백업 폴더 없으면 자동 생성

---

## CSV Export Format

헤더 (한글):
```
자산번호,모델명,시리얼번호,반출자,소속업체,연락처,반출일,반납예정일,반납일,반출확인자,반납확인자,상태,비고
```

- 인코딩: UTF-8 BOM (`\xEF\xBB\xBF` 첫 3바이트)
- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename="loans_YYYYMMDD.csv"`
- 쿼리 파라미터로 필터 반영 (`status`, `search`)

---

## Deployment Layout (배포 폴더 구성)

```
PortableAssetManager/     ← 이 폴더째 복사하면 다른 PC에서 실행 가능
├─ PAM.exe                # 실행 진입점
├─ runtime/
│  └─ node.exe            # Node.js 20 LTS Windows x64
├─ server/                # Express + 라우트 소스
├─ server/public/         # Vite 빌드 결과물
├─ data/                  # pam.db 자동 생성
└─ backup/                # 자동 백업
```

> Node.js는 별도 설치 불필요. `runtime/node.exe`만으로 실행.

---

## Open Questions

없음. 모든 요구사항 확인 완료.

---

## Success Criteria

- [ ] `PAM.exe` 실행 시 트레이 아이콘 등장 + 브라우저 자동 오픈
- [ ] 브라우저 닫아도 트레이 아이콘 유지 (서버 계속 실행)
- [ ] 트레이 우클릭 → 열기 → 브라우저 오픈
- [ ] 트레이 우클릭 → 종료 → Node.js 프로세스 kill + PAM.exe 종료
- [ ] 중복 실행 시 브라우저만 오픈, 서버 중복 없음
- [ ] Node.js 크래시 시 트레이 아이콘 오류 상태 전환
- [ ] 로그인 없이 API 접근 시 401 반환
- [ ] 자산 등록/수정/삭제 동작
- [ ] 반출 등록 시 자산 상태 → `'반출중'`
- [ ] 반납 처리 시 자산 상태 → `'보관중'`
- [ ] 반출중 자산 삭제 시도 시 오류 응답
- [ ] CSV 다운로드 후 Excel에서 한글 정상 표시
- [ ] 서버 시작 시 `backup/` 폴더에 백업 파일 생성
- [ ] `data/pam.db` 없어도 서버 시작 시 자동 생성
- [ ] `PortableAssetManager/` 폴더 복사 후 다른 PC에서 동일하게 실행
