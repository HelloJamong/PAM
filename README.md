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
└── backup/               # 서버 시작 시 자동 백업
```

## 백업 및 복구

- 서버 시작 시 `backup/pam_YYYYMMDD_HHmmss.db` 자동 생성
- 복구: `backup/` 에서 원하는 파일을 `data/pam.db` 로 복사 후 재시작

## 라이선스

이 프로젝트는 [MIT 라이선스](LICENSE)에 따라 배포됩니다.
