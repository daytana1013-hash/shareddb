// ┌─────────────────────────────────────────────────────────────────┐
// │  SharedDB — config.js                                           │
// │  이 파일을 수정해서 액세스 코드와 사이트 설정을 변경하세요.         │
// └─────────────────────────────────────────────────────────────────┘

const CONFIG = {
  // 사이트 이름
  siteName: 'SharedDB',

  // 팀 접속 코드 — GitHub에 올리기 전 반드시 변경하세요
  // 또는 .env 파일로 관리하고 GitHub Actions로 주입하는 방식도 안내 드립니다
  accessCode: 'db2024',

  // 데모 힌트 노출 여부 (배포 후 false로 변경)
  showDemoHint: true,

  // 항목당 잠금 비밀번호 기능 사용 여부
  itemLockEnabled: true,

  // 데이터 저장 방식: 'localstorage' | 'json'
  // 'localstorage' : 브라우저에 저장 (개인), 협업시 data/db.json 방식 사용 권장
  // 'json'         : data/db.json 파일을 읽기 전용으로 로드 (PR로 항목 추가)
  storageMode: 'localstorage',

  // storageMode가 'json'일 때 읽어올 파일 경로
  jsonPath: 'data/db.json',
};
