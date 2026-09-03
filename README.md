# PAM — Portable Asset Manager

Windows 폐쇄망 PC에서 설치 없이 실행 가능한 포터블 자산 반출/반납 관리 시스템.

## 실행 방법 (운영)

1. `PortableAssetManager.zip` 압축 해제
2. `PAM.exe` 더블클릭
3. 시스템 트레이 아이콘 등장 + 브라우저 자동 오픈 (`http://127.0.0.1:3000`)
4. 초기 비밀번호: `password1!`
5. 최초 로그인 후 비밀번호 변경 팝업에서 새 비밀번호 설정
   - 새 비밀번호는 최소 8자리, 대문자, 특수문자, 숫자를 모두 포함해야 합니다.

> 브라우저를 닫아도 서버는 트레이에서 계속 실행됩니다.  
> 트레이 아이콘 우클릭 → **종료** 로 완전 종료합니다.

## 개발 환경 설정

```bash
# 의존성 설치
npm install
npm install --prefix client

# 개발 서버 실행 (Vite :5173 + Express :3001 동시 실행)
npm run dev

# 자동 테스트
npm test

# 샘플 데이터 삽입 (선택)
npm run seed
```

## 운영 빌드

```bash
# React 프론트엔드 빌드 → server/public/
npm run build

# 서버 단독 실행 확인
node server/index.js
# → http://127.0.0.1:3000
```


## 자산 CSV 가져오기/내보내기

자산 관리 화면에서 다음 기능을 사용할 수 있습니다.

- **입력 양식 다운로드**: `assets_import_template.csv` 양식을 다운로드합니다.
- **CSV 가져오기**: 양식에 맞춘 `.csv` 파일로 자산을 일괄 등록/수정합니다.
  - 필수 컬럼: `자산번호`, `모델명`
  - 선택 컬럼: `시리얼번호`, `상태`, `비고`
  - 상태 값: `보관중`, `반출중`, `폐기`
  - 기존 자산번호가 있으면 해당 자산 정보를 업데이트합니다.
  - `반출중` 상태로의 변경은 CSV가 아니라 반출 등록 화면에서 처리합니다.
- **CSV 내보내기**: 현재 검색/상태 필터가 적용된 자산 목록을 `.csv`로 다운로드합니다.
  - Excel 수식으로 해석될 수 있는 값은 안전한 텍스트로 내보냅니다.

## 배포 폴더 구성

```
PortableAssetManager/
├── PAM.exe               # 실행 진입점 (Go 트레이 런처)
├── runtime/
│   └── node.exe          # Node.js 20 LTS Windows x64 포터블
├── server/               # Express 서버 소스
│   └── public/           # Vite 빌드 결과물 (정적 파일)
├── node_modules/         # 서버 의존성 (express, better-sqlite3 등)
├── package.json
├── data/                 # pam.db 자동 생성
└── backup/               # 자동 스냅샷 백업 (최근 30개 보존)
```

## 백업 및 복구

- 기존 DB로 서버를 시작하거나 데이터 변경이 완료되면 SQLite 온라인 백업을 자동 생성합니다.
- WAL에 기록된 변경도 포함하며, 기본적으로 최근 백업 30개를 보존합니다.
- `PAM_BACKUP_RETENTION` 환경 변수로 보존 개수를 조정할 수 있습니다.
- 백업 실패 시 데이터 저장 결과와 별도로 화면에 운영 경고를 표시합니다.
- 복구: `backup/` 에서 원하는 파일을 `data/pam.db` 로 복사 후 재시작

## 버전

- 현재 버전: `26.1.5`
- 루트/클라이언트 패키지와 CHANGELOG 버전을 동일하게 유지합니다.

## 라이선스

이 프로젝트는 [MIT 라이선스](LICENSE)에 따라 배포됩니다.
