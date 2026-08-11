# Implementation Plan: Portable Asset Manager (PAM)

## Overview

Go 트레이 런처 + Node.js/Express 백엔드 + React/Vite 프론트엔드로 구성된 포터블 자산 반출/반납 관리 시스템. 총 18개 태스크를 5개 페이즈로 분리하며, 각 페이즈 완료 후 체크포인트를 통해 검증한다.

## Architecture Decisions

- **수직 슬라이싱:** DB → API → UI 순서로 각 기능을 완전히 완성한 뒤 다음 기능으로 이동
- **Go 런처는 마지막:** Node.js 앱이 완전히 동작한 뒤 Go 래퍼 작업. 개발 중에는 `npm run dev`로 진행
- **Loans API 트랜잭션:** 반출/반납 등록은 asset 상태 변경과 반드시 하나의 SQLite 트랜잭션으로 처리
- **Dev 프록시:** 개발 시 Vite(:5173) → Express(:3001) 프록시, 운영 빌드에서는 Express가 정적 파일 직접 서빙
- **better-sqlite3:** 동기 API 사용 (async/await 불필요, 코드 단순화)

## Dependency Graph

```
[Task 1] 프로젝트 스캐폴드
    │
    └─ [Task 2] DB 초기화 (SQLite 스키마)
           │
           └─ [Task 3] Express 서버 골격
                  │
                  ├─ [Task 4] Auth API  ──→  [Task 5] Login UI
                  │
                  ├─ [Task 6] Assets API ──→  [Task 7] Assets UI
                  │
                  ├─ [Task 8] Loans API ──→  [Task 9] Checkout UI
                  │                    └──→  [Task 10] Return UI
                  │
                  ├─ [Task 11] Export API ──→  [Task 12] History UI
                  │
                  └─ [Task 13] Dashboard API + UI
                         │
                         └─ [Task 14] Auto Backup
                                │
                                └─ [Task 15] Go 런처 - 프로세스 관리
                                       │
                                       └─ [Task 16] Go 런처 - 트레이 + UX
                                              │
                                              ├─ [Task 17] 빌드 파이프라인
                                              └─ [Task 18] README + Seed 데이터
```

---

## Phase 1: Foundation (기반)

### Task 1: 프로젝트 스캐폴드

**Description:** 전체 폴더 구조, package.json, Vite 설정, 개발/빌드 스크립트를 구성한다.

**Acceptance criteria:**
- [ ] `npm run dev` 실행 시 Vite(:5173)와 Express(:3001)가 동시에 뜬다
- [ ] `npm run build` 실행 시 `server/public/`에 Vite 빌드 결과물이 생성된다
- [ ] Vite 개발 서버에서 `/api/*` 요청이 `:3001`로 프록시된다

**Verification:**
- [ ] `npm run dev` → 브라우저에서 `localhost:5173` 접근 가능
- [ ] `npm run build` → `server/public/index.html` 존재 확인

**Dependencies:** 없음

**Files:**
- `package.json` (루트 — concurrently로 dev 동시 실행)
- `client/package.json` (React 18, React Router 7, Vite 6)
- `client/vite.config.mjs` (proxy 설정)
- `client/index.html`
- `client/src/main.jsx`
- `client/src/App.jsx` (빈 껍데기)
- `server/package.json` (Express 4, better-sqlite3, express-session)
- `server/index.js` (빈 껍데기)
- `.gitignore`

**Scope:** M

---

### Task 2: DB 초기화

**Description:** SQLite DB 파일을 자동 생성하고 3개 테이블(assets, loan_records, settings)을 초기화한다. 초기 관리자 비밀번호를 settings에 삽입한다.

**Acceptance criteria:**
- [ ] `data/pam.db`가 없을 때 서버 시작 시 자동 생성된다
- [ ] 3개 테이블이 `IF NOT EXISTS`로 안전하게 생성된다
- [ ] `settings` 테이블에 `admin_password` = scrypt(`password1!`) 초기값이 삽입된다
- [ ] `data/` 폴더가 없으면 자동 생성된다

**Verification:**
- [ ] `node server/index.js` 실행 후 `data/pam.db` 생성 확인
- [ ] `sqlite3 data/pam.db ".tables"` → 3개 테이블 출력

**Dependencies:** Task 1

**Files:**
- `server/db.js`

**Scope:** S

---

### Task 3: Express 서버 골격

**Description:** 127.0.0.1:3001(개발)/3000(운영) 바인딩, 세션 미들웨어, CORS(개발), 에러 핸들러, 정적 파일 서빙을 설정한다.

**Acceptance criteria:**
- [ ] `GET /api/health` → `{ status: "ok", app: "PAM" }` 계약 반환
- [ ] `127.0.0.1`로만 바인딩 (0.0.0.0 아님)
- [ ] `NODE_ENV=production`일 때 `server/public/` 정적 파일 서빙
- [ ] 처리되지 않은 에러는 `{ success: false, message }` JSON으로 응답

**Verification:**
- [ ] `curl http://127.0.0.1:3001/api/health` → `status="ok"`, `app="PAM"` 확인
- [ ] `curl http://0.0.0.0:3001/api/health` → 연결 거부

**Dependencies:** Task 2

**Files:**
- `server/index.js` (완성)

**Scope:** S

---

### Checkpoint 1: Foundation
- [ ] `npm run dev` 정상 실행
- [ ] DB 자동 생성 확인
- [ ] `/api/health` 응답 확인

---

## Phase 2: Auth (인증)

### Task 4: Auth API

**Description:** 비밀번호 로그인/로그아웃/세션 확인 API와 인증 미들웨어를 구현한다.

**Acceptance criteria:**
- [ ] `POST /api/auth/login` — 올바른 비밀번호 시 세션 발급, 틀리면 401
- [ ] `POST /api/auth/logout` — 세션 삭제
- [ ] `GET /api/auth/me` — 세션 유효 시 200, 없으면 401
- [ ] `requireAuth` 미들웨어: 세션 없으면 401 반환
- [ ] 비밀번호는 scrypt로 검증하고 기존 SHA-256 값은 로그인 시 마이그레이션

**Verification:**
- [ ] `curl -X POST .../api/auth/login -d '{"password":"admin1234"}'` → 200
- [ ] `curl -X POST .../api/auth/login -d '{"password":"wrong"}'` → 401
- [ ] 세션 쿠키 없이 `/api/assets` 호출 → 401

**Dependencies:** Task 3

**Files:**
- `server/auth.js` (scrypt 해시/검증, 로그인 제한, requireAuth 미들웨어)
- `server/routes/auth.js`
- `server/index.js` (라우트 등록)

**Scope:** S

---

### Task 5: Login UI + 라우팅 기반

**Description:** Login 페이지, 인증 상태 관리, 401 자동 리다이렉트, 공통 Layout 컴포넌트를 구현한다.

**Acceptance criteria:**
- [ ] 비로그인 상태에서 `/` 접근 시 Login 화면으로 리다이렉트
- [ ] 올바른 비밀번호 입력 시 Dashboard로 이동
- [ ] 틀린 비밀번호 시 오류 메시지 표시
- [ ] Layout에 네비게이션(Dashboard/자산/반출/반납/이력)과 로그아웃 버튼
- [ ] API 응답 401 시 자동으로 Login 화면으로 이동

**Verification:**
- [ ] 브라우저에서 로그인 → Dashboard 이동 확인
- [ ] 로그아웃 → Login 화면 복귀 확인

**Dependencies:** Task 4

**Files:**
- `client/src/pages/Login.jsx`
- `client/src/App.jsx` (React Router, 인증 상태)
- `client/src/api.js` (fetch 래퍼, 401 처리)
- `client/src/components/Layout.jsx`

**Scope:** M

---

### Checkpoint 2: Auth
- [ ] 로그인/로그아웃 플로우 완전 동작
- [ ] 인증 없이 API 접근 시 401 → Login 리다이렉트

---

## Phase 3: Assets (자산 관리)

### Task 6: Assets API

**Description:** 자산 CRUD API를 구현한다. 반출중 자산 삭제 시도는 거부한다.

**Acceptance criteria:**
- [ ] `GET /api/assets` — `status`/`search` 필터와 `page`/`limit` 페이지네이션 동작
- [ ] `POST /api/assets` — 자산 등록, `asset_no` 중복 시 409
- [ ] `PUT /api/assets/:id` — 자산 수정
- [ ] `DELETE /api/assets/:id` — 삭제, 반출중 상태면 400 반환
- [ ] 모든 엔드포인트 `requireAuth` 적용

**Verification:**
- [ ] 자산 등록 → 목록 조회에서 확인
- [ ] 반출중 자산 삭제 시도 → 400 응답

**Dependencies:** Task 4

**Files:**
- `server/routes/assets.js`
- `server/index.js` (라우트 등록)

**Scope:** S

---

### Task 7: Assets UI

**Description:** 자산 등록 폼, 자산 목록 테이블, 수정/삭제 기능을 구현한다.

**Acceptance criteria:**
- [ ] 자산 등록 폼에서 필수 필드(자산번호, 모델명) 미입력 시 제출 불가
- [ ] 목록 테이블에서 자산번호/모델명/시리얼번호 검색 동작
- [ ] 상태 필터 드롭다운 동작
- [ ] 수정 버튼 클릭 시 폼에 기존 값 채워짐
- [ ] 삭제 버튼 클릭 시 확인 다이얼로그, 반출중 삭제 시 오류 메시지

**Verification:**
- [ ] 브라우저에서 자산 등록 → 목록 즉시 반영
- [ ] 검색어 입력 → 필터링 동작

**Dependencies:** Task 6

**Files:**
- `client/src/pages/Assets.jsx`
- `client/src/components/AssetForm.jsx`
- `client/src/components/DataTable.jsx`

**Scope:** M

---

### Checkpoint 3: Assets
- [ ] 자산 등록/수정/삭제 전체 동작
- [ ] 검색 및 필터 동작

---

## Phase 4: Loans (반출/반납)

### Task 8: Loans API (반출 + 반납)

**Description:** 반출 등록, 반납 처리, 이력 조회 API를 구현한다. 반출/반납은 SQLite 트랜잭션으로 처리한다.

**Acceptance criteria:**
- [ ] `GET /api/loans` — `status`/`search` 필터와 `page`/`limit` 페이지네이션
- [ ] `POST /api/loans/checkout` — loan_records 삽입 + asset.status → '반출중' (트랜잭션)
- [ ] `PUT /api/loans/:id/return` — loan_records 업데이트 + asset.status → '보관중' (트랜잭션)
- [ ] 보관중 아닌 자산으로 반출 시도 시 400
- [ ] 반출중 아닌 이력으로 반납 시도 시 400

**Verification:**
- [ ] 반출 등록 → 자산 상태 '반출중' 변경 확인
- [ ] 반납 처리 → 자산 상태 '보관중' 복귀 확인
- [ ] 트랜잭션 검증: 의도적으로 asset 업데이트 실패 시 loan_records도 롤백

**Dependencies:** Task 4

**Files:**
- `server/routes/loans.js`
- `server/index.js` (라우트 등록)

**Scope:** S

---

### Task 9: Checkout UI (반출 등록)

**Description:** 보관중 자산 선택 드롭다운과 반출 정보 입력 폼을 구현한다.

**Acceptance criteria:**
- [ ] 자산 드롭다운에 보관중 자산만 표시
- [ ] 필수 필드(자산, 반출자명, 반출일) 미입력 시 제출 불가
- [ ] 등록 성공 시 성공 메시지 + 폼 초기화
- [ ] 등록 후 자산 드롭다운 목록 갱신

**Verification:**
- [ ] 반출 등록 → 자산 드롭다운에서 해당 자산 사라짐 확인

**Dependencies:** Task 8

**Files:**
- `client/src/pages/Checkout.jsx`
- `client/src/components/LoanForm.jsx`

**Scope:** M

---

### Task 10: Return UI (반납 처리)

**Description:** 반출중 자산 목록과 반납 처리 모달을 구현한다.

**Acceptance criteria:**
- [ ] 반출중 자산 목록 테이블 (반출자, 업체, 반출일, 반납예정일 표시)
- [ ] 반납 버튼 클릭 시 모달 오픈 (반납일, 확인자, 메모 입력)
- [ ] 반납일 기본값은 오늘 날짜
- [ ] 반납 처리 성공 시 목록에서 해당 행 제거

**Verification:**
- [ ] 반납 처리 후 목록에서 자산 사라짐 확인
- [ ] Assets 페이지에서 해당 자산 상태 '보관중' 확인

**Dependencies:** Task 8

**Files:**
- `client/src/pages/Return.jsx`

**Scope:** M

---

### Checkpoint 4: Loans
- [ ] 반출 → 반납 전체 플로우 동작
- [ ] 각 단계별 자산 상태 변경 확인

---

## Phase 5: History + Export + Dashboard (조회/내보내기)

### Task 11: Export API + CSV 유틸

**Description:** UTF-8 BOM CSV 생성 유틸과 export 엔드포인트를 구현한다.

**Acceptance criteria:**
- [ ] `GET /api/export/loans.csv` — 전체 이력 CSV 다운로드
- [ ] `status`, `search` 쿼리 파라미터로 필터링 반영
- [ ] 파일 첫 3바이트: `\xEF\xBB\xBF` (UTF-8 BOM)
- [ ] 파일명: `loans_YYYYMMDD.csv`
- [ ] Excel에서 열었을 때 한글 정상 표시

**Verification:**
- [ ] 다운로드한 CSV를 Excel로 열어 한글 깨짐 없음 확인
- [ ] `hexdump -C loans_*.csv | head -1` 첫 바이트 `ef bb bf` 확인

**Dependencies:** Task 8

**Files:**
- `server/utils/csv.js`
- `server/routes/export.js`
- `server/index.js` (라우트 등록)

**Scope:** S

---

### Task 12: History UI

**Description:** 전체 반출/반납 이력 테이블, 검색/필터, CSV 다운로드를 구현한다.

**Acceptance criteria:**
- [ ] 모든 이력 필드가 테이블에 표시
- [ ] 상태 필터 드롭다운 동작
- [ ] 검색 입력(자산번호/모델명/반출자) 동작
- [ ] CSV 다운로드 버튼 클릭 시 현재 필터 조건 반영하여 다운로드

**Verification:**
- [ ] 필터 적용 후 CSV 다운로드 → 필터된 행만 포함 확인

**Dependencies:** Task 11

**Files:**
- `client/src/pages/History.jsx`

**Scope:** M

---

### Task 13: Dashboard API + UI

**Description:** 통계 API와 대시보드 화면을 구현한다.

**Acceptance criteria:**
- [ ] `GET /api/dashboard` — 전체/보관중/반출중 자산 수 + 최근 이력 5건
- [ ] Dashboard UI에 통계 카드 3개 표시
- [ ] 최근 이력 5건 테이블 표시
- [ ] 로그인 후 기본 랜딩 페이지

**Verification:**
- [ ] 로그인 직후 Dashboard에 통계 표시 확인

**Dependencies:** Task 8

**Files:**
- `server/routes/dashboard.js`
- `client/src/pages/Dashboard.jsx`
- `server/index.js` (라우트 등록)

**Scope:** M

---

### Checkpoint 5: Core Features Complete
- [ ] 전체 워크플로우 (등록 → 반출 → 반납 → 이력 확인) 동작
- [ ] CSV 다운로드 + Excel 한글 확인
- [ ] Dashboard 통계 정확성 확인

---

## Phase 6: Utilities (유틸)

### Task 14: 자동 백업

**Description:** 서버 시작 시 pam.db를 backup/ 폴더에 날짜시간 형식으로 복사한다.

**Acceptance criteria:**
- [ ] 서버 시작 시 `backup/pam_YYYYMMDD_HHmmss.db` 생성
- [ ] `data/pam.db`가 없으면 (첫 실행) 백업 스킵
- [ ] `backup/` 폴더 없으면 자동 생성

**Verification:**
- [ ] 서버 재시작 2회 → `backup/` 폴더에 2개 파일 생성 확인

**Dependencies:** Task 3

**Files:**
- `server/utils/backup.js`
- `server/index.js` (시작 시 호출)

**Scope:** XS

---

### Checkpoint 6: Utilities
- [ ] 서버 재시작 후 backup/ 파일 생성 확인

---

## Phase 7: Go Launcher (트레이 런처)

### Task 15: Go 프로젝트 + Node.js 프로세스 관리

**Description:** Go 모듈 초기화, Node.js 자식 프로세스 시작/종료, 중복 실행 방지, 경로 해석을 구현한다.

**Acceptance criteria:**
- [ ] `go build` 시 `PAM.exe` 생성
- [ ] `PAM.exe` 실행 시 `runtime/node.exe server/index.js` 자식 프로세스 시작
- [ ] 포트 3000 이미 사용 중이면 자식 프로세스 시작 안 하고 브라우저만 오픈
- [ ] 모든 경로는 `os.Executable()` 기준 상대 경로
- [ ] 종료 시 자식 프로세스도 함께 종료

**Verification:**
- [ ] `PAM.exe` 실행 → `tasklist | findstr node` 에서 node.exe 확인
- [ ] `PAM.exe` 두 번 실행 → node.exe 1개만 실행 확인
- [ ] 종료 후 `tasklist` → node.exe 사라짐 확인

**Dependencies:** Task 3 (서버가 완전히 동작해야 테스트 가능)

**Files:**
- `launcher/go.mod`
- `launcher/main.go` (프로세스 관리 부분)

**Scope:** M

---

### Task 16: 트레이 아이콘 + UX

**Description:** systray 아이콘, 상태 표시, 우클릭 메뉴(열기/종료), 브라우저 자동 오픈, 크래시 감지를 구현한다.

**Acceptance criteria:**
- [ ] 실행 시 시스템 트레이에 아이콘 등장
- [ ] 서버 준비 완료 후 기본 브라우저로 `http://127.0.0.1:3000` 자동 오픈
- [ ] 트레이 우클릭 → 열기: 브라우저 오픈
- [ ] 트레이 우클릭 → 종료: 자식 프로세스 kill + PAM.exe 종료
- [ ] Node.js 크래시 감지 시 트레이 아이콘 오류 상태 + 재시작 메뉴 표시
- [ ] `-H windowsgui` 빌드 시 CMD 창 없이 실행

**Verification:**
- [ ] PAM.exe 실행 → 트레이 아이콘 + 브라우저 자동 오픈 확인
- [ ] 브라우저 닫기 → 트레이 아이콘 유지 확인
- [ ] 트레이 종료 → 프로세스 완전 사라짐 확인

**Dependencies:** Task 15

**Files:**
- `launcher/main.go` (트레이 부분 추가)
- `launcher/assets/icon.ico` (트레이 아이콘)

**Scope:** M

---

### Checkpoint 7: Go Launcher
- [ ] PAM.exe 실행 → 트레이 + 브라우저 자동 오픈
- [ ] 종료 플로우 완전 동작
- [ ] 중복 실행 방지 동작

---

## Phase 8: Build & Packaging

### Task 17: 빌드 파이프라인 + 포터블 구성

**Description:** 운영 빌드 스크립트, 포터블 폴더 구성, Go 빌드 명령을 정리한다.

**Acceptance criteria:**
- [ ] `npm run build` 실행 시 `server/public/`에 Vite 빌드 결과물 생성
- [ ] 운영 시 `runtime/node.exe server/index.js` 실행으로 서버 단독 구동 가능
- [ ] Go 빌드 명령 `GOOS=windows GOARCH=amd64 go build -ldflags="-H windowsgui" -o ../PAM.exe .`로 빌드
- [ ] 배포 폴더 구성: PAM.exe + runtime/ + server/ + server/public/ + data/ + backup/

**Verification:**
- [ ] `npm run build` 후 `node server/index.js` 실행 → `http://127.0.0.1:3000` 정상 접속

**Dependencies:** Task 16

**Files:**
- `package.json` (build 스크립트 최종)
- `launcher/go.mod` (최종)

**Scope:** S

---

### Task 18: README + Seed 데이터

**Description:** README.md 작성과 선택적 샘플 데이터 스크립트를 구현한다.

**Acceptance criteria:**
- [ ] README에 개발/빌드/운영 실행 방법 포함
- [ ] README에 백업/복구 방법 포함
- [ ] `npm run seed` 실행 시 샘플 자산 5개 + 이력 3개 삽입
- [ ] seed는 멱등 — 중복 실행해도 에러 없음

**Verification:**
- [ ] README만 보고 프로젝트 처음 시작 가능한지 확인

**Dependencies:** Task 17

**Files:**
- `README.md`
- `server/seed.js`
- `package.json` (seed 스크립트)

**Scope:** S

---

### Checkpoint 8: Final
- [ ] 전체 빌드 파이프라인 동작
- [ ] PAM.exe로 전체 플로우 동작
- [ ] README 완성

---

## Summary

| Phase | Tasks | 핵심 결과물 |
|-------|-------|------------|
| 1. Foundation | 1-3 | 프로젝트 구조, DB, Express 골격 |
| 2. Auth | 4-5 | 로그인/로그아웃, 세션 보호 |
| 3. Assets | 6-7 | 자산 CRUD 완전 동작 |
| 4. Loans | 8-10 | 반출/반납 전체 플로우 |
| 5. History+Dashboard | 11-13 | 이력 조회, CSV, 대시보드 |
| 6. Utilities | 14 | 자동 백업 |
| 7. Go Launcher | 15-16 | 트레이 EXE |
| 8. Packaging | 17-18 | 빌드, README, Seed |

**총 태스크:** 18개  
**예상 규모:** S×8 + M×8 + XS×2

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| better-sqlite3 네이티브 모듈 빌드 실패 | High | Windows 환경에서 `npm install` 직접 수행, pre-built 바이너리 사용 |
| Go systray Windows 렌더링 이슈 | Med | getlantern/systray는 Windows CGO 필요 — 빌드 환경에 MinGW 설치 필요 |
| 포터블 node.exe 경로 문제 | Med | PAM.exe와 같은 폴더 기준 상대 경로 철저히 준수 |
| 세션 서버 재시작 시 초기화 | Low | 명세에 정의된 동작 — 8시간 유효, 재시작 시 재로그인 안내 |

## Open Questions

없음.
