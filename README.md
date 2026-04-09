# SharedDB

팀 공유 자료 검색 시스템 — GitHub Pages 정적 배포 버전

## 기능

- 🔐 액세스 코드 기반 접근 제어
- 📁 파일 / 폴더 / 링크 메타데이터 등록
- 🔍 이름 · 업로더 · 태그 · 메모 통합 검색
- 🏷 태그 칩 퀵 필터
- ↕ 날짜(오래된순/최신순) · 이름 · 유형 정렬
- 🔒 항목별 추가 비밀번호 잠금
- 📱 모바일 반응형

---

## 배포 방법 (GitHub Pages)

### 1. 레포지토리 생성

```bash
# GitHub에서 새 레포 생성 후
git clone https://github.com/<your-id>/shareddb.git
cp -r shareddb-files/* shareddb/   # 이 프로젝트 파일 복사
cd shareddb
```

### 2. 액세스 코드 Secret 등록

GitHub 레포지토리 → **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|------|-------|
| `SHAREDDB_ACCESS_CODE` | 원하는 코드 (예: `team2024!`) |

### 3. GitHub Pages 활성화

레포지토리 → **Settings → Pages → Source: GitHub Actions** 선택

### 4. 배포

```bash
git add .
git commit -m "init: SharedDB 첫 배포"
git push origin main
```

push 하면 GitHub Actions가 자동으로 액세스 코드를 주입하고 배포합니다.
약 1~2분 후 `https://<your-id>.github.io/shareddb/` 에서 확인하세요.

---

## 데이터 관리

### localstorage 모드 (기본)
- 각 사용자 브라우저에 저장
- 추가한 항목은 본인 브라우저에만 반영됨
- 개인 메모 용도에 적합

### json 모드 (팀 공유 권장)
`js/config.js`에서 변경:
```js
storageMode: 'json',
jsonPath:    'data/db.json',
```

`data/db.json` 에 항목을 직접 작성하거나 PR로 추가.
push하면 자동 배포.

```json
{
  "id": 1720000000000,
  "type": "pdf",
  "name": "보고서.pdf",
  "uploader": "홍길동",
  "url": "https://drive.google.com/...",
  "tags": ["보고서", "2025"],
  "memo": "",
  "password": "",
  "date": 1720000000000
}
```

**type 값:** `folder` · `pdf` · `doc` · `sheet` · `img` · `link` · `file`

---

## 설정 변경 (`js/config.js`)

| 설정 | 설명 |
|------|------|
| `siteName` | 사이트 이름 |
| `accessCode` | 팀 접속 코드 (Secret 주입 전 기본값) |
| `showDemoHint` | 로그인 화면에 코드 힌트 노출 여부 |
| `itemLockEnabled` | 항목별 잠금 기능 사용 여부 |
| `storageMode` | `localstorage` 또는 `json` |

---

## 파일 구조

```
shareddb/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── config.js      ← 설정 파일
│   ├── data.js        ← 데이터 레이어
│   └── app.js         ← 앱 로직
├── data/
│   └── db.json        ← json 모드용 데이터
└── .github/
    └── workflows/
        └── deploy.yml ← 자동 배포 워크플로우
```
