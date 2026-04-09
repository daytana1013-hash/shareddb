// ── data.js : 데이터 CRUD 레이어 ──────────────────────────────────

const DB_KEY = 'shareddb_v1';

const SAMPLE_DATA = [
  {
    id: 1704067200000,
    type: 'folder',
    name: '2024 연간 보고서',
    uploader: '김민준',
    url: '',
    tags: ['보고서', '2024', '연간'],
    memo: '재무/운영 연간 결산 모음',
    password: '',
    date: 1704067200000,
  },
  {
    id: 1706745600000,
    type: 'pdf',
    name: 'Q4 실적발표 자료.pdf',
    uploader: '이수진',
    url: 'https://example.com/q4-results.pdf',
    tags: ['실적', 'IR', '2024'],
    memo: '외부 공개용',
    password: '',
    date: 1706745600000,
  },
  {
    id: 1709251200000,
    type: 'link',
    name: '팀 노션 워크스페이스',
    uploader: '박지훈',
    url: 'https://notion.so/team',
    tags: ['노션', '협업'],
    memo: '',
    password: '',
    date: 1709251200000,
  },
  {
    id: 1711929600000,
    type: 'doc',
    name: '제품 로드맵 2025 v2.docx',
    uploader: '최유리',
    url: 'https://drive.google.com/example',
    tags: ['로드맵', '2025', '제품'],
    memo: '내부 검토용 — 외부 공유 금지',
    password: 'road2025',
    date: 1711929600000,
  },
  {
    id: 1714521600000,
    type: 'sheet',
    name: '재무계획_2025.xlsx',
    uploader: '김민준',
    url: 'https://docs.google.com/spreadsheets/example',
    tags: ['재무', '예산', '2025'],
    memo: '',
    password: '',
    date: 1714521600000,
  },
  {
    id: 1717200000000,
    type: 'img',
    name: 'UI 디자인 시안 v3.png',
    uploader: '이수진',
    url: 'https://www.figma.com/example',
    tags: ['디자인', 'UI', '피그마'],
    memo: '피그마 링크',
    password: '',
    date: 1717200000000,
  },
];

// ── 초기화 ───────────────────────────────────────────────────────
function dbInit() {
  if (CONFIG.storageMode === 'json') {
    // json 모드: db.json을 fetch해서 읽기만 함 (추가는 로컬에 버퍼링)
    return fetch(CONFIG.jsonPath)
      .then(r => r.json())
      .then(data => {
        const local = dbGetLocal();
        // 로컬에 추가된 항목 병합 (json에 없는 id만)
        const jsonIds = new Set(data.map(d => d.id));
        const merged = [...data, ...local.filter(l => !jsonIds.has(l.id))];
        sessionStorage.setItem(DB_KEY + '_merged', JSON.stringify(merged));
        return merged;
      })
      .catch(() => {
        return dbGetLocal().length ? dbGetLocal() : [...SAMPLE_DATA];
      });
  }
  // localstorage 모드
  const saved = dbGetLocal();
  if (saved.length === 0) {
    localStorage.setItem(DB_KEY, JSON.stringify(SAMPLE_DATA));
    return Promise.resolve([...SAMPLE_DATA]);
  }
  return Promise.resolve(saved);
}

function dbGetLocal() {
  try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]'); } catch { return []; }
}

function dbGetAll() {
  if (CONFIG.storageMode === 'json') {
    try { return JSON.parse(sessionStorage.getItem(DB_KEY + '_merged') || '[]'); } catch { return []; }
  }
  return dbGetLocal();
}

function dbAdd(item) {
  const all = dbGetAll();
  all.unshift(item);
  localStorage.setItem(DB_KEY, JSON.stringify(all));
  if (CONFIG.storageMode === 'json') {
    sessionStorage.setItem(DB_KEY + '_merged', JSON.stringify(all));
  }
}

function dbDelete(id) {
  const all = dbGetAll().filter(x => x.id !== id);
  localStorage.setItem(DB_KEY, JSON.stringify(all));
  if (CONFIG.storageMode === 'json') {
    sessionStorage.setItem(DB_KEY + '_merged', JSON.stringify(all));
  }
}

// ── 유형 메타 ────────────────────────────────────────────────────
const TYPE_META = {
  folder: { label: '폴더',    icon: '📁', cls: 'type-folder' },
  pdf:    { label: 'PDF',     icon: '📕', cls: 'type-pdf'    },
  doc:    { label: '문서',    icon: '📝', cls: 'type-doc'    },
  sheet:  { label: '스프레드시트', icon: '📊', cls: 'type-sheet' },
  img:    { label: '이미지',  icon: '🖼', cls: 'type-img'    },
  link:   { label: '링크',    icon: '🔗', cls: 'type-link'   },
  file:   { label: '파일',    icon: '📄', cls: 'type-file'   },
};

function typeMeta(type) {
  return TYPE_META[type] || TYPE_META.file;
}
