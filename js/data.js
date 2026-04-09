const DB_KEY = 'shareddb_v1';

function notionPageToItem(page) {
  const p = page.properties;
  const getText   = (prop) => prop?.rich_text?.[0]?.plain_text || prop?.title?.[0]?.plain_text || '';
  const getSelect = (prop) => prop?.select?.name || '';
  const getUrl    = (prop) => prop?.url || '';
  const getTags   = (prop) => (prop?.multi_select || []).map(t => t.name);
  return {
    id:       page.id,
    type:     getSelect(p.type) || 'file',
    name:     getText(p['이름'] || p['Name'] || p['name']),
    uploader: getText(p.uploader),
    url:      getUrl(p.url),
    tags:     getTags(p.tags),
    memo:     getText(p.memo),
    password: getText(p.password),
    date:     new Date(page.created_time).getTime(),
  };
}

async function fetchFromNotion() {
  const res = await fetch(CONFIG.gasProxyUrl);
  if (!res.ok) throw new Error('프록시 오류: ' + res.status);
  const data = await res.json();
  return (data.results || []).map(notionPageToItem);
}

async function addToNotion(item) {
  const res = await fetch(CONFIG.gasProxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error('추가 실패: ' + res.status);
  return await res.json();
}

function dbInit() {
  if (CONFIG.storageMode === 'notion') {
    return fetchFromNotion()
      .then(data => {
        sessionStorage.setItem(DB_KEY + '_notion', JSON.stringify(data));
        return data;
      })
      .catch(err => {
        console.warn('Notion 연동 실패:', err.message);
        return [];
      });
  }
  const saved = dbGetLocal();
  return Promise.resolve(saved);
}

function dbGetLocal() {
  try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]'); } catch { return []; }
}

function dbGetAll() {
  if (CONFIG.storageMode === 'notion') {
    try { return JSON.parse(sessionStorage.getItem(DB_KEY + '_notion') || '[]'); } catch { return []; }
  }
  return dbGetLocal();
}

async function dbAdd(item) {
  if (CONFIG.storageMode === 'notion') {
    await addToNotion(item);
    const all = dbGetAll();
    all.unshift(item);
    sessionStorage.setItem(DB_KEY + '_notion', JSON.stringify(all));
    return;
  }
  const all = dbGetAll();
  all.unshift(item);
  localStorage.setItem(DB_KEY, JSON.stringify(all));
}

const TYPE_META = {
  folder: { label: '폴더',        icon: '📁', cls: 'type-folder' },
  pdf:    { label: 'PDF',         icon: '📕', cls: 'type-pdf'    },
  doc:    { label: '문서',        icon: '📝', cls: 'type-doc'    },
  sheet:  { label: '스프레드시트', icon: '📊', cls: 'type-sheet' },
  img:    { label: '이미지',      icon: '🖼', cls: 'type-img'    },
  link:   { label: '링크',        icon: '🔗', cls: 'type-link'   },
  file:   { label: '파일',        icon: '📄', cls: 'type-file'   },
};

function typeMeta(type) {
  return TYPE_META[type] || TYPE_META.file;
}
