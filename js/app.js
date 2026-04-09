// ── app.js : 메인 앱 로직 ────────────────────────────────────────

let currentUser = '';
let allFiles = [];
let activeType = 'file';
let pendingItemId = null;
let pendingForPreview = false;

// ── 인증 ─────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (CONFIG.showDemoHint) {
    document.getElementById('demo-hint').textContent =
      '데모 코드: ' + CONFIG.accessCode;
  }
  document.getElementById('input-code').addEventListener('keydown', e => {
    if (e.key === 'Enter') tryLogin();
  });
  document.getElementById('input-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('input-code').focus();
  });
  document.getElementById('item-pw-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitItemPw();
  });

  const saved = sessionStorage.getItem('shareddb_user');
  if (saved) {
    currentUser = saved;
    boot();
  }
});

function tryLogin() {
  const name = document.getElementById('input-name').value.trim();
  const code = document.getElementById('input-code').value.trim();
  if (!name) { document.getElementById('input-name').focus(); return; }
  if (code !== CONFIG.accessCode) {
    document.getElementById('lock-error').style.display = 'block';
    document.getElementById('input-code').value = '';
    document.getElementById('input-code').focus();
    return;
  }
  currentUser = name;
  sessionStorage.setItem('shareddb_user', name);
  document.getElementById('lock-error').style.display = 'none';
  boot();
}

function boot() {
  document.getElementById('lock-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('header-user').textContent = currentUser;
  dbInit().then(data => {
    allFiles = data;
    renderFiles();
  });
}

function logout() {
  sessionStorage.removeItem('shareddb_user');
  location.reload();
}

// ── 렌더링 ───────────────────────────────────────────────────────
function renderFiles() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();
  const sort  = document.getElementById('sort-select').value;

  document.getElementById('search-clear').style.display = query ? 'flex' : 'none';

  let list = [...allFiles];

  // 검색 필터
  if (query) {
    list = list.filter(f =>
      f.name.toLowerCase().includes(query) ||
      (f.uploader || '').toLowerCase().includes(query) ||
      (f.memo || '').toLowerCase().includes(query) ||
      (f.tags || []).some(t => t.toLowerCase().includes(query))
    );
  }

  // 정렬
  if (sort === 'newest')    list.sort((a, b) => b.date - a.date);
  if (sort === 'oldest')    list.sort((a, b) => a.date - b.date);
  if (sort === 'name_asc')  list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  if (sort === 'name_desc') list.sort((a, b) => b.name.localeCompare(a.name, 'ko'));
  if (sort === 'type')      list.sort((a, b) => (a.type||'').localeCompare(b.type||''));

  // 통계
  const total   = allFiles.length;
  const folders = allFiles.filter(f => f.type === 'folder').length;
  const files   = allFiles.filter(f => f.type !== 'folder').length;
  let statText  = `전체 ${total}개 · 📁 ${folders}  📄 ${files}`;
  if (query) statText += `  |  "${query}" 검색 결과 ${list.length}개`;
  document.getElementById('stat-text').textContent = statText;

  // 태그 칩 (현재 검색어 기반)
  renderChips(list);

  const tbody = document.getElementById('file-tbody');
  const empty = document.getElementById('empty-state');

  if (!list.length) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = list.map(item => {
    const m    = typeMeta(item.type);
    const date = formatDate(item.date);
    const locked = item.password ? '🔒 ' : '';
    const tags = (item.tags || []).map(t =>
      `<span class="tag">${t}</span>`
    ).join('');
    const linkCell = item.url
      ? `<button class="preview-btn" onclick="openPreview(${item.id})">▶ 미리보기</button>`
      : `<span class="no-link">—</span>`;

    return `
      <tr class="file-row" data-id="${item.id}">
        <td class="col-icon"><span class="file-icon-cell ${m.cls}">${m.icon}</span></td>
        <td class="col-name">
          <span class="file-name">${locked}${escapeHtml(item.name)}</span>
          <div class="tag-row">${tags}</div>
        </td>
        <td class="col-uploader">${escapeHtml(item.uploader)}</td>
        <td class="col-link">${linkCell}</td>
        <td class="col-date">${date}</td>
        <td class="col-memo">${escapeHtml(item.memo || '—')}</td>
      </tr>
    `;
  }).join('');
}

function renderChips(list) {
  const allTags = {};
  list.forEach(f => (f.tags || []).forEach(t => {
    allTags[t] = (allTags[t] || 0) + 1;
  }));
  const top = Object.entries(allTags).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const chips = document.getElementById('filter-chips');
  chips.innerHTML = top.map(([tag, cnt]) =>
    `<button class="chip" onclick="quickSearch('${escapeAttr(tag)}')">${tag} <span class="chip-cnt">${cnt}</span></button>`
  ).join('');
}

function quickSearch(tag) {
  document.getElementById('search-input').value = tag;
  renderFiles();
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  renderFiles();
  document.getElementById('search-input').focus();
}

function toggleDateSort() {
  const sel = document.getElementById('sort-select');
  if (sel.value === 'oldest') { sel.value = 'newest'; document.getElementById('date-arrow').textContent = '↓'; }
  else                        { sel.value = 'oldest'; document.getElementById('date-arrow').textContent = '↑'; }
  renderFiles();
}

// ── 미리보기 패널 ────────────────────────────────────────────────

// URL 종류 감지 → { mode, embedUrl }
// mode: 'iframe' | 'gdocs' | 'notion' | 'image' | 'pdf_direct' | 'blocked'
function detectPreviewMode(url) {
  if (!url) return { mode: 'blocked', reason: 'URL이 없습니다.' };

  try { new URL(url); } catch { return { mode: 'blocked', reason: '올바른 URL이 아닙니다.' }; }

  const u = url.toLowerCase();

  // ── Google Drive / Docs / Sheets / Slides ──
  // drive.google.com/file/d/FILE_ID/view  →  /preview
  if (/drive\.google\.com\/file\/d\/([^/]+)/.test(url)) {
    const embedUrl = url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
    return { mode: 'iframe', embedUrl };
  }
  // docs.google.com/document|spreadsheets|presentation
  if (/docs\.google\.com\/(document|spreadsheets|presentation)/.test(url)) {
    // /edit → /preview  or append /preview
    let embedUrl = url.replace(/\/edit.*$/, '/preview').replace(/\/pub.*$/, '/preview');
    if (!/\/preview/.test(embedUrl)) embedUrl = embedUrl.replace(/\?.*$/, '') + '/preview';
    return { mode: 'iframe', embedUrl };
  }

  // ── OneDrive / SharePoint ──
  if (/onedrive\.live\.com|sharepoint\.com|1drv\.ms/.test(u)) {
    // OneDrive embed: ?embed=1
    let embedUrl = url;
    if (!embedUrl.includes('embed=1')) {
      embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'embed=1';
    }
    return { mode: 'iframe', embedUrl };
  }

  // ── Notion ──
  if (/notion\.so|notion\.site/.test(u)) {
    // Notion은 X-Frame-Options: SAMEONLY → iframe 차단
    // 대신 안내 카드 + 새 탭 열기
    return { mode: 'notion', embedUrl: url };
  }

  // ── Figma ──
  if (/figma\.com/.test(u)) {
    const embedUrl = 'https://www.figma.com/embed?embed_host=share&url=' + encodeURIComponent(url);
    return { mode: 'iframe', embedUrl };
  }

  // ── YouTube ──
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) {
    return { mode: 'iframe', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  // ── 이미지 직링크 ──
  if (/\.(png|jpg|jpeg|gif|svg|webp)(\?.*)?$/i.test(u)) {
    return { mode: 'image', embedUrl: url };
  }

  // ── PDF 직링크 ──
  if (/\.pdf(\?.*)?$/i.test(u)) {
    return { mode: 'pdf_direct', embedUrl: url };
  }

  // ── Dropbox ──
  if (/dropbox\.com/.test(u)) {
    // dl=0 → dl=1 로 바꾸면 직접 다운로드, raw=1 로 하면 미리보기 가능한 경우 있음
    const embedUrl = url.replace('dl=0', 'raw=1').replace('dl=1', 'raw=1');
    if (/\.(png|jpg|jpeg|gif|pdf)/.test(u)) return { mode: 'iframe', embedUrl };
    return { mode: 'blocked', reason: 'Dropbox 파일은 새 탭에서 다운로드됩니다.' };
  }

  // ── 기본: 새 탭 안내 ──
  return { mode: 'blocked', reason: '이 URL은 보안 정책상 미리보기가 제한됩니다.\n새 탭에서 열어주세요.' };
}

let currentPreviewId = null;

function openPreview(id) {
  const item = allFiles.find(f => f.id === id);
  if (!item) return;

  // 비밀번호 잠금 처리
  if (item.password) { openItemPw(id, true); return; }

  _showPreview(item);
}

function _showPreview(item) {
  currentPreviewId = item.id;
  const m = typeMeta(item.type);

  // 패널 열기
  const panel = document.getElementById('preview-panel');
  const listPanel = document.getElementById('list-panel');
  panel.style.display = 'flex';
  listPanel.classList.add('has-preview');

  // 헤더
  document.getElementById('preview-icon').textContent = m.icon;
  document.getElementById('preview-title').textContent = item.name;
  const openBtn = document.getElementById('preview-open-btn');
  openBtn.href = item.url || '#';

  // 하단 메타
  const tags = (item.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('');
  document.getElementById('preview-info').innerHTML = `
    <span style="color:var(--text-2);font-size:12px">업로더: ${escapeHtml(item.uploader)} · ${formatDate(item.date)}</span>
    <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">${tags}</div>
    ${item.memo ? `<div style="margin-top:6px;font-size:12px;color:var(--text-2)">${escapeHtml(item.memo)}</div>` : ''}
  `;

  // 로딩 상태 초기화
  document.getElementById('preview-loading').style.display = 'flex';
  document.getElementById('preview-iframe').style.display = 'none';
  document.getElementById('preview-blocked').style.display = 'none';
  document.getElementById('preview-iframe').src = '';

  if (!item.url) {
    showPreviewBlocked('URL이 등록되지 않은 항목입니다.', item.url);
    return;
  }

  const { mode, embedUrl, reason } = detectPreviewMode(item.url);

  if (mode === 'iframe' || mode === 'pdf_direct') {
    const iframe = document.getElementById('preview-iframe');
    iframe.onload = () => {
      document.getElementById('preview-loading').style.display = 'none';
      iframe.style.display = 'block';
    };
    iframe.onerror = () => showPreviewBlocked('iframe 로드에 실패했습니다.', item.url);
    iframe.src = embedUrl;
    // 10초 타임아웃
    setTimeout(() => {
      if (document.getElementById('preview-loading').style.display !== 'none') {
        document.getElementById('preview-loading').style.display = 'none';
        iframe.style.display = 'block'; // 로드됐을 수도 있으니 그냥 표시
      }
    }, 10000);

  } else if (mode === 'image') {
    document.getElementById('preview-loading').style.display = 'none';
    const iframe = document.getElementById('preview-iframe');
    // 이미지는 iframe 대신 img 태그로 표시
    iframe.style.display = 'none';
    const body = document.getElementById('preview-body');
    let imgEl = document.getElementById('preview-img');
    if (!imgEl) {
      imgEl = document.createElement('img');
      imgEl.id = 'preview-img';
      imgEl.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;';
      body.appendChild(imgEl);
    }
    imgEl.style.display = 'block';
    imgEl.src = embedUrl;
    imgEl.onerror = () => showPreviewBlocked('이미지를 불러올 수 없습니다.', item.url);

  } else if (mode === 'notion') {
    document.getElementById('preview-loading').style.display = 'none';
    showNotionCard(item);

  } else {
    document.getElementById('preview-loading').style.display = 'none';
    showPreviewBlocked(reason || '미리보기를 지원하지 않는 URL입니다.', item.url);
  }
}

function showPreviewBlocked(reason, url) {
  document.getElementById('preview-loading').style.display = 'none';
  document.getElementById('preview-iframe').style.display = 'none';
  const el = document.getElementById('preview-blocked');
  el.style.display = 'flex';
  document.getElementById('blocked-reason').textContent = reason;
  const btn = document.getElementById('blocked-open-btn');
  if (url) { btn.href = url; btn.style.display = 'inline-block'; }
  else btn.style.display = 'none';
  // 이미지 정리
  const imgEl = document.getElementById('preview-img');
  if (imgEl) imgEl.style.display = 'none';
}

function showNotionCard(item) {
  const el = document.getElementById('preview-blocked');
  el.style.display = 'flex';
  document.getElementById('preview-loading').style.display = 'none';
  document.getElementById('preview-iframe').style.display = 'none';
  el.innerHTML = `
    <div style="text-align:center;padding:2rem 1rem;">
      <div style="font-size:40px;margin-bottom:16px">📋</div>
      <p style="font-size:15px;font-weight:600;margin-bottom:8px;color:var(--text)">${escapeHtml(item.name)}</p>
      <p style="font-size:13px;color:var(--text-2);margin-bottom:20px">
        Notion 페이지는 보안 정책으로 인해<br>사이트 내 미리보기가 제한됩니다.
      </p>
      <a href="${item.url}" target="_blank" rel="noopener"
         style="display:inline-block;padding:10px 20px;background:var(--accent);color:white;border-radius:8px;font-size:13px;font-weight:500;text-decoration:none;">
        Notion에서 열기 ↗
      </a>
    </div>
  `;
}

function closePreview() {
  document.getElementById('preview-panel').style.display = 'none';
  document.getElementById('list-panel').classList.remove('has-preview');
  document.getElementById('preview-iframe').src = '';
  const imgEl = document.getElementById('preview-img');
  if (imgEl) imgEl.style.display = 'none';
  currentPreviewId = null;
}

function openItemPw(id, forPreview = false) {
  pendingItemId = id;
  pendingForPreview = forPreview;
  const item = allFiles.find(f => f.id === id);
  document.getElementById('item-pw-label').textContent =
    `"${item.name}"은 비밀번호로 보호되어 있습니다.`;
  document.getElementById('item-pw-input').value = '';
  document.getElementById('item-pw-error').style.display = 'none';
  document.getElementById('item-pw-bg').style.display = 'flex';
  setTimeout(() => document.getElementById('item-pw-input').focus(), 80);
}

function submitItemPw() {
  const item = allFiles.find(f => f.id === pendingItemId);
  const entered = document.getElementById('item-pw-input').value;
  if (entered === item.password) {
    closeItemPw();
    if (pendingForPreview) _showPreview(item);
    else window.open(item.url, '_blank', 'noopener');
  } else {
    document.getElementById('item-pw-error').style.display = 'block';
    document.getElementById('item-pw-input').value = '';
  }
}

function closeItemPw() {
  document.getElementById('item-pw-bg').style.display = 'none';
  pendingItemId = null;
}

function onItemPwBgClick(e) {
  if (e.target === document.getElementById('item-pw-bg')) closeItemPw();
}

// ── 추가 모달 ────────────────────────────────────────────────────
function openModal() {
  document.getElementById('modal-bg').style.display = 'flex';
  setType('file');
  ['m-name','m-url','m-tags','m-memo','m-item-pw'].forEach(id => {
    document.getElementById(id).value = '';
  });
  setTimeout(() => document.getElementById('m-name').focus(), 80);
}

function closeModal() {
  document.getElementById('modal-bg').style.display = 'none';
}

function onModalBgClick(e) {
  if (e.target === document.getElementById('modal-bg')) closeModal();
}

function setType(t) {
  activeType = t;
  ['file','folder','link'].forEach(type => {
    document.getElementById('btn-type-' + type).classList.toggle('active', type === t);
  });
  document.getElementById('field-link').style.display = t === 'link' ? 'block' : 'none';
}

function submitItem() {
  const name = document.getElementById('m-name').value.trim();
  if (!name) { document.getElementById('m-name').focus(); showToast('이름을 입력해주세요', true); return; }

  const url = document.getElementById('m-url').value.trim();
  if (activeType === 'link' && !url) {
    document.getElementById('m-url').focus(); showToast('URL을 입력해주세요', true); return;
  }

  const tagsRaw = document.getElementById('m-tags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  // 파일 확장자로 유형 자동 감지
  let type = activeType;
  if (activeType === 'file') {
    const ext = name.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) type = 'pdf';
    else if (['doc','docx','hwp','txt'].includes(ext)) type = 'doc';
    else if (['xls','xlsx','csv'].includes(ext)) type = 'sheet';
    else if (['png','jpg','jpeg','gif','svg','webp'].includes(ext)) type = 'img';
  }

  const newItem = {
    id:       Date.now(),
    type,
    name,
    uploader: currentUser,
    url,
    tags,
    memo:     document.getElementById('m-memo').value.trim(),
    password: CONFIG.itemLockEnabled ? document.getElementById('m-item-pw').value.trim() : '',
    date:     Date.now(),
  };

  dbAdd(newItem);
  allFiles = dbGetAll();
  closeModal();
  renderFiles();
  showToast(`"${name}" 추가 완료`);
}

// ── 유틸 ─────────────────────────────────────────────────────────
function formatDate(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escapeAttr(s) {
  return String(s||'').replace(/'/g,"\\'");
}

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = (isError ? '⚠ ' : '✓ ') + msg;
  t.style.background = isError ? '#ef4444' : '#185FA5';
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}
