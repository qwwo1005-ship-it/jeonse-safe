(() => {
'use strict';

/* ================= data ================= */
const C = JSON.parse(document.getElementById('content').textContent);
const by = (arr, k = 'id') => Object.fromEntries(arr.map(x => [x[k], x]));
const STAGES = C.lessons.stages;
const stageById = by(STAGES);
const lessons = STAGES.flatMap(s => s.lessons.map(l => ({ ...l, stageId: s.id })));
const lessonById = by(lessons);
const termById = by(C.glossary.terms);
const clauseById = by(C.clauses.clauses);
const ckById = by(C.checklists.checklists);
const docById = by(C.documents.documents);
const qs = C.quiz.questions;
const qById = by(qs);
const puById = by(C.policy.items);
const srcById = by(C.meta.sources);
const calcById = by(C.lessons.calculators);
const linkById = by(C.lessons.refLinks || []);
const samples = C.contracts.samples;
const sampleById = by(samples);
const examById = by(C.quiz.exams);
const allHotspots = {};
samples.forEach(s => s.hotspots.forEach(h => { if (!allHotspots[h.id]) allHotspots[h.id] = h; }));

/* ================= storage ================= */
const KEY = 'jeonse-guard-v1';
const blank = () => ({ v: 1, read: {}, contracts: [], active: null, checks: {}, clauseSel: {}, wrong: {}, results: [], hl: {} });
let store = blank();
try { const raw = localStorage.getItem(KEY); if (raw) store = Object.assign(blank(), JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } };

/* ================= state ================= */
const ROUTES = ['intro', 'terms', 'home', 'learn', 'glossary', 'docs', 'contract', 'my', 'insurance', 'exam', 'news'];
const S = {
  route: 'home', stageId: null, lessonId: null, gq: '',
  docId: null, docTab: 'guide', docSample: 0,
  sampleId: samples[0].id, cmode: 'read', trap: null,
  hsId: null, tour: null, sheet: null,
  myTab: 'plan', openEv: {}, confirmDel: false, importMsg: '',
  session: null, result: null, submitWarn: false, calcFocus: null,
  lq: null, fx: null,
};
const routeFromHash = () => { const h = (location.hash || '').replace('#', ''); return ROUTES.includes(h) ? h : h ? 'home' : 'intro'; };

/* 이용약관 동의 — 약관 버전이 바뀌면 다시 받음. 학습 기록(store)과 따로 저장해 백업 불러오기로 지워지지 않게 */
const TERMS_KEY = 'jeonse-terms';
let termsOk = false;
try { termsOk = JSON.parse(localStorage.getItem(TERMS_KEY) || 'null')?.v === C.meta.terms.version; } catch (e) { /* storage unavailable */ }

/* ================= utils ================= */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => {
  if (n == null || isNaN(n)) return '-';
  n = Math.round(n);
  if (Math.abs(n) >= 1e8) { const e = Math.floor(n / 1e8), m = Math.round((n % 1e8) / 1e4); return `${e}억${m ? ' ' + m.toLocaleString('ko-KR') + '만' : ''} 원`; }
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString('ko-KR')}만 원`;
  return `${n.toLocaleString('ko-KR')}원`;
};
const pDate = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); if (!y || !m || !d) return null; return new Date(y, m - 1, d, 12); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const DOW = '일월화수목금토';
const fmt = d => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${DOW[d.getDay()]})`;
const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 12); };
const ddays = d => Math.round((d - today()) / 864e5);
const ddayLabel = n => n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `D+${-n}`;
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const lvlName = { critical: '중요', important: '확인', info: '참고' };
const levelChip = l => `<span class="chip lvl-${esc(l)}">${lvlName[l] || l}</span>`;
const verdictColor = { red: 'red', yellow: 'yellow', green: 'green' };
const statusChip = st => { const t = C.meta.statusTags[st]; return t ? `<span class="chip ${esc(t.color)}">${esc(t.label)}</span>` : ''; };
const priChip = p => p === 'critical' ? '<span class="chip red">필수</span>' : '<span class="chip yellow">상황별</span>';
let toastTimer;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
function copyText(text, fallbackSel) {
  const done = () => toast('복사했어요');
  const fail = () => { const t = fallbackSel && document.querySelector(fallbackSel); if (t) { t.focus(); t.select(); } toast('자동 복사가 막혀 있어요. 선택된 글을 길게 눌러 복사하세요'); };
  try { navigator.clipboard.writeText(text).then(done, fail); } catch (e) { fail(); }
}

/* ================= icons ================= */
const I = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  learn: '<path d="M4 5h11a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3z"/><path d="M18 20h2V8"/><path d="M8 9h6M8 13h6"/>',
  docs: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h7M9 16h7"/>',
  contract: '<path d="M5 3h14v18H5z"/><path d="M8 7h8M8 11h8M8 15h4"/><circle cx="16" cy="17" r="2.2"/>',
  my: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 15l2 2 4-4"/>',
  insurance: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  exam: '<path d="M4 4h16v16H4z"/><path d="M8 9l2 2 4-4M8 16h8"/>',
  news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7 9h7M7 13h7"/>',
  glossary: '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M9 9h6M9 13h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>',
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
const NAV = [['home', '홈'], ['learn', '배우기'], ['docs', '서류 읽는 법'], ['contract', '계약서 예시'], ['my', '내 계약 플래너'], ['insurance', '보증보험 비교'], ['exam', '모의고사'], ['news', '최신 제도'], ['glossary', '용어사전']];
const TABS = [['home', '홈'], ['learn', '배우기'], ['docs', '서류'], ['my', '플래너'], ['exam', '시험']];

/* ================= theme ================= */
const THEMES = { '': ['auto', '화면: 기기 설정'], light: ['sun', '화면: 밝게'], dark: ['moon', '화면: 어둡게'] };
let theme = '';
try { theme = localStorage.getItem('jeonse-theme') || ''; } catch (e) { /* storage unavailable */ }
function applyTheme(fade) {
  const root = document.documentElement;
  if (fade && !reduceMotion()) { root.classList.add('theme-fade'); setTimeout(() => root.classList.remove('theme-fade'), 450); }
  if (theme) root.dataset.theme = theme; else delete root.dataset.theme;
  document.querySelectorAll('[data-act="theme"]').forEach(b => { b.innerHTML = `${icon(THEMES[theme][0])}<span>${THEMES[theme][1]}</span>`; b.setAttribute('aria-label', `${THEMES[theme][1]} (눌러서 바꾸기)`); });
}

/* ================= 디자인 =================
   확정: A(솜사탕) 톤 + C(피치 스티커) 버튼 → data-design="a".
   B·C 시안은 비교 페이지(preview.html, ?design=b|c)에서만 다시 볼 수 있게 남겨 둠. ?preview 면 약관 없이 바로 보기(저장 안 함) */
const DESIGNS = ['a', 'b', 'c'];
// 비교용 주소 옵션은 내 컴퓨터에서만 — 배포 사이트에서 ?preview 로 약관 동의를 건너뛰지 못하게
const LOCAL = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const QS = new URLSearchParams(LOCAL ? location.search : '');
const PREVIEW = QS.has('preview');
const design = DESIGNS.includes(QS.get('design')) ? QS.get('design') : 'a';
if (PREVIEW || QS.has('review')) theme = 'light'; // 시안 비교는 밝은 화면 기준
document.documentElement.dataset.design = design;
try { localStorage.removeItem('jeonse-design'); } catch (e) { /* 검토 때 남은 값 정리 */ }

/* ================= motion ================= */
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(root) {
  root.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count, suf = el.dataset.suffix || '', t0 = performance.now(), dur = 750;
    const step = t => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString('ko-KR') + suf; if (p < 1) requestAnimationFrame(step); };
    el.textContent = '0' + suf; requestAnimationFrame(step);
  });
}
const meter = (r, id) => `<div class="meter"${id ? ` id="${id}"` : ''}><div class="track"><span class="pin" style="left:${Math.min(Math.max(r || 0, 0), 100)}%"${r == null ? ' hidden' : ''}></span></div><div class="scale"><span style="left:0">0</span><span style="left:70%">70</span><span style="left:80%">80</span><span style="left:100%">100%</span></div></div>`;

/* ================= shared renderers ================= */
const go = (route, patch = {}) => { Object.assign(S, patch); if (location.hash.replace('#', '') !== route) location.hash = route; else render(true); };

function hotspotLinks(h) {
  const out = [];
  (h.lessonIds || []).forEach(id => lessonById[id] && out.push(`<button class="btn ghost" data-act="lesson" data-id="${id}">학습: ${esc(lessonById[id].title)}</button>`));
  if (h.documentId && docById[h.documentId]) out.push(`<button class="btn ghost" data-act="doc" data-id="${h.documentId}">서류: ${esc(docById[h.documentId].name)}</button>`);
  if (h.calculatorId && calcById[h.calculatorId]) out.push(`<button class="btn ghost" data-act="calc" data-id="${h.calculatorId}">${esc(calcById[h.calculatorId].title)}</button>`);
  if (h.clauseId && clauseById[h.clauseId]) out.push(`<button class="btn ghost" data-act="clauses">특약: ${esc(clauseById[h.clauseId].title)}</button>`);
  if (h.checklistId && ckById[h.checklistId]) out.push(`<button class="btn ghost" data-act="cksheet" data-id="${h.checklistId}">체크리스트: ${esc(ckById[h.checklistId].title)}</button>`);
  if ((h.quizIds || []).length) out.push(`<button class="btn" data-act="quizIds" data-ids="${h.quizIds.join(',')}">관련 문제 풀기</button>`);
  return out.length ? `<div class="row">${out.join('')}</div>` : '';
}
function hotspotCard(h, extra = '') {
  if (!h) return '';
  return `<div class="card"><div class="row">${levelChip(h.level)}<h3>${esc(h.title)}</h3></div>
    <p>${esc(h.explain)}</p>
    ${h.check?.length ? `<div><div class="eyebrow">확인할 것</div><ul class="clean ticks">${h.check.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
    ${h.redFlags?.length ? `<div><div class="eyebrow">위험신호</div><ul class="clean flags">${h.redFlags.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
    ${hotspotLinks(h)}${extra}</div>`;
}
const legend = () => `<div class="legend"><span><i class="dot lvl-critical"></i>중요</span><span><i class="dot lvl-important"></i>확인</span><span><i class="dot lvl-info"></i>참고</span></div>`;
const verdictBox = v => v ? `<div class="callout ${verdictColor[v.level] || ''} verdict"><b>${esc(v.title)}</b><ul class="clean">${v.points.map(p => `<li>· ${esc(p)}</li>`).join('')}</ul></div>` : '';

function paperDoc(sample, hsMap) {
  const mark = (id, cls = '') => id && hsMap[id] ? ` class="hs ${cls}${S.hsId === id ? ' on' : ''}" data-act="hs" data-id="${id}" tabindex="0" role="button" aria-label="${esc(hsMap[id].title)} 설명 보기"` : (cls ? ` class="${cls}"` : '');
  const dot = id => id && hsMap[id] ? `<i class="dot lvl-${hsMap[id].level}"></i>` : '';
  const stamp = sample.stamp ? (sample.stampHotspotId ? `<button class="stamp warn" data-act="hs" data-id="${sample.stampHotspotId}">${esc(sample.stamp)}</button>` : `<span class="stamp">${esc(sample.stamp)}</span>`) : '';
  const sec = s => {
    let body;
    if (s.layout === 'table') {
      body = `<div class="ptable-wrap"><table class="ptable"><thead><tr>${s.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${s.rows.map(r => `<tr${mark(r.hotspotId, r.struck ? 'struck' : '')}>${r.cells.map((c, i) => `<td>${esc(c)}${i === r.cells.length - 1 ? dot(r.hotspotId) : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    } else {
      body = `<div class="pfields">${s.fields.map(f => `<div${mark(f.hotspotId, 'pfield')}><div>${esc(f.label)}</div><div>${esc(f.value)}${dot(f.hotspotId)}</div></div>`).join('')}</div>`;
    }
    return `<div class="psec">${s.title ? `<h4>${esc(s.title)}</h4>` : ''}${body}</div>`;
  };
  return `<article class="paper" aria-label="${esc(sample.paperTitle)}">${stamp}<div class="paper-title">${esc(sample.paperTitle)}</div>
    <div class="paper-meta">${(sample.header || []).map(h => `<span${h.hotspotId ? mark(h.hotspotId) : ''}>${esc(h.label)}: ${esc(h.value)}${dot(h.hotspotId)}</span>`).join('')}</div>
    ${sample.sections.map(sec).join('')}</article>`;
}

function contractPaper(sample, hsMap, trapMode) {
  const trap = trapMode && S.trap ? C.contracts.trapExercises.find(t => t.id === S.trap.id) : null;
  const ov = trap ? by(trap.overrides, 'fieldKey') : {};
  const field = f => {
    const val = ov[f.key] ? ov[f.key].value : f.value;
    if (trap) {
      const found = S.trap.found.includes(f.key), revealed = S.trap.revealed && ov[f.key];
      return `<div class="pfield hs${found || revealed ? ' trap-found' : ''}" data-act="trapTap" data-key="${f.key}" tabindex="0" role="button"><div>${esc(f.label)}</div><div>${esc(val)}</div></div>`;
    }
    const id = f.hotspotId && hsMap[f.hotspotId] ? f.hotspotId : null;
    return id ? `<div class="pfield hs${S.hsId === id ? ' on' : ''}" data-act="hs" data-id="${id}" tabindex="0" role="button" aria-label="${esc(hsMap[id].title)} 설명 보기"><div>${esc(f.label)}</div><div>${esc(val)}<i class="dot lvl-${hsMap[id].level}"></i></div></div>`
      : `<div class="pfield"><div>${esc(f.label)}</div><div>${esc(val)}</div></div>`;
  };
  return `<article class="paper"><span class="stamp">교육용 견본</span><div class="paper-title">주택임대차표준계약서</div>
    ${sample.pages.map(p => p.sections.map(s => `<div class="psec"><h4>${esc(s.title)}</h4><div class="pfields">${s.fields.map(field).join('')}</div></div>`).join('')).join('')}</article>`;
}

function tourControls(order, hsMap) {
  if (!S.tour) return `<button class="btn primary" data-act="tourStart">핵심 ${order.length}곳 짚어보기</button>`;
  const i = S.tour.i;
  return `<div class="row"><span class="num muted">${i + 1} / ${order.length}</span>
    <button class="btn" data-act="tourMove" data-d="-1" ${i === 0 ? 'disabled' : ''}>이전</button>
    <button class="btn primary" data-act="tourMove" data-d="1">${i === order.length - 1 ? '마치기' : '다음'}</button>
    <button class="btn ghost" data-act="tourEnd">투어 닫기</button></div>`;
}
const narrow = () => window.matchMedia('(max-width: 1100px)').matches;

// 휴대폰에서 견본 보기: '한눈에'(PC와 같은 폭으로 그린 뒤 화면 폭에 맞게 축소 → 가로 스크롤 없음) / '크게'(원래 크기)
// PC는 그대로(버튼도 안 보임)
const phone = () => window.matchMedia('(max-width: 860px)').matches;
const paperModes = () => `<div class="paper-modes"><div class="seg" role="group" aria-label="견본 크기"><button data-act="paperMode" data-m="fit" aria-pressed="${S.paperMode !== 'full'}">한눈에 보기</button><button data-act="paperMode" data-m="full" aria-pressed="${S.paperMode === 'full'}">크게 보기</button></div><span class="small muted">${S.paperMode === 'full' ? '옆으로 밀어 자세히 읽어요' : '색 점을 누르면 설명이 나와요'}</span></div>`;
const PAPER_W = 640; // 표가 가로로 넘치지 않는 폭
function fitPapers() {
  document.querySelectorAll('#main .paper').forEach(p => {
    if (!phone() || S.paperMode === 'full') { p.classList.remove('fit'); p.style.zoom = ''; p.style.removeProperty('--z'); return; }
    p.classList.add('fit');
    const z = Math.max(0.42, Math.min(1, p.parentElement.clientWidth / PAPER_W));
    p.style.zoom = z; p.style.setProperty('--z', z);
  });
}

/* ================= views ================= */
function vHome() {
  const readN = Object.keys(store.read).filter(id => lessonById[id]).length;
  const best = store.results.reduce((m, r) => Math.max(m, r.score), 0);
  const wrongN = Object.keys(store.wrong).length;
  const c = activeContract();
  let next = '';
  if (c) {
    const evs = buildEvents(c).filter(e => ddays(e.date) >= 0).slice(0, 3);
    next = `<section class="card stack"><div class="row" style="justify-content:space-between"><h2>내 계약 · 다가오는 일정</h2><button class="btn ghost" data-act="nav" data-r="my">플래너 열기</button></div>
      <p class="muted small">${esc(c.name)}</p>
      ${evs.length ? `<ul class="clean">${evs.map(e => `<li class="row"><span class="dday${ddays(e.date) <= 3 ? ' soon' : ''}">${ddayLabel(ddays(e.date))}</span><span class="num small muted">${fmt(e.date)}</span><b>${esc(e.title)}</b></li>`).join('')}</ul>` : '<p class="muted">남은 일정이 없어요.</p>'}</section>`;
  }
  const where = [['집 보러 다녀요', 'stage_02'], ['계약을 앞두고 있어요', 'stage_03'], ['오늘 계약해요', 'stage_04'], ['이사를 앞두고 있어요', 'stage_06'], ['살고 있어요', 'stage_08'], ['보증금을 못 받고 있어요', 'stage_09']];
  return `<div class="page">
  <section class="hero"><div><div class="eyebrow">전세사기 예방 교육 · ${esc(C.meta.baseDate)} 기준</div><h1>전세지킴이</h1>
    <p>등기부등본 읽는 법부터 계약서 특약, 이사 날 체크리스트, 보증금을 돌려받는 날까지. 한 단계씩 따라오면 내 보증금을 지키는 방법이 보여요.</p></div>
    <div class="big-seal" aria-hidden="true">보증금<br>지킴</div></section>
  <section class="stack"><h2>지금 어디쯤인가요?</h2><div class="where">${where.map(([t, id]) => `<button data-act="stage" data-id="${id}">${t}</button>`).join('')}</div></section>
  ${next}
  <section class="grid">
    <div class="card stat"><span class="eyebrow">학습 진도</span><b><span data-count="${readN}">${readN}</span> / ${lessons.length}</b><div class="bar"><i style="width:${Math.round(readN / lessons.length * 100)}%"></i></div></div>
    <div class="card stat"><span class="eyebrow">모의고사 최고 점수</span><b>${best ? `<span data-count="${best}" data-suffix="점">${best}점</span>` : '-'}</b><span class="small muted">${store.results.length}회 응시</span></div>
    <div class="card stat"><span class="eyebrow">오답노트</span><b><span data-count="${wrongN}">${wrongN}</span>문항</b><button class="btn ghost" data-act="examStart" data-id="wrong" ${wrongN ? '' : 'disabled'}>다시 풀기</button></div>
  </section>
  <section class="stack"><div class="row" style="justify-content:space-between"><h2>최신 제도</h2><button class="btn ghost" data-act="nav" data-r="news">전체 보기</button></div>
    <div class="grid">${C.policy.items.slice(0, 4).map(p => `<button class="linkcard" data-act="nav" data-r="news">${statusChip(p.status)}<h3>${esc(p.title)}</h3></button>`).join('')}</div></section>
  <section class="stack"><h2>바로 가기</h2><div class="grid">
    ${[['docs', '서류 읽는 법', '등기부등본·건축물대장·확인설명서 등 10종을 견본으로 읽어봐요.'], ['contract', '계약서 예시', '아파트·빌라·다가구·오피스텔 월세 계약서의 중요한 칸과 위험 찾기.'], ['my', '내 계약 플래너', '날짜를 넣으면 할 일과 체크리스트, 특약 문구가 만들어져요.'], ['insurance', '보증보험 비교', 'HUG·HF·SGI 비교와 126% 룰·보증료 계산기.'], ['exam', '모의고사', `${qs.length}문항 문제은행으로 실전 모의고사와 오답노트.`], ['glossary', '용어사전', '대항력, 확정일자 같은 말을 쉬운 말로.']]
      .map(([r, t, d]) => `<button class="linkcard" data-act="nav" data-r="${r}"><h3>${t}</h3><p>${d}</p></button>`).join('')}</div></section>
  <p class="small muted">${esc(C.meta.disclaimer)}</p></div>`;
}

function vLearn() {
  if (S.lessonId && lessonById[S.lessonId]) return vLesson(lessonById[S.lessonId]);
  if (S.stageId && stageById[S.stageId]) return vStage(stageById[S.stageId]);
  return `<div class="page"><div class="head"><div class="eyebrow">배우기</div><h1>계약 전부터 보증금 받는 날까지 9단계</h1><p>순서대로 따라오면 돼요. 단계마다 학습카드와 체크리스트, 단원 퀴즈가 있어요.</p></div>
  <div class="steps">${STAGES.map(s => { const done = s.lessons.every(l => store.read[l.id]); const n = s.lessons.filter(l => store.read[l.id]).length;
    return `<button class="step" data-act="stage" data-id="${s.id}"><span class="n${done ? ' done' : ''}">${s.order}</span><div><h3>${esc(s.title)}</h3><p class="small muted">${esc(s.subtitle)}</p><div class="bar thin"><i style="width:${Math.round(n / s.lessons.length * 100)}%"></i></div></div><span class="small muted num">${n}/${s.lessons.length}</span></button>`; }).join('')}</div>
  ${hlNote()}
  <button class="btn" data-act="nav" data-r="glossary">${icon('glossary')} 용어사전 열기</button></div>`;
}
function hlNote() {
  const ent = Object.entries(store.hl).filter(([id, a]) => lessonById[id] && a.length);
  if (!ent.length) return `<div class="callout small">학습카드 요약 문장을 누르면 밑줄이 그어지고, 여기 <b>밑줄 노트</b>에 모여 복습할 수 있어요.</div>`;
  return `<section class="stack"><h2>내 밑줄 노트 <span class="small muted num">${ent.reduce((t, [, a]) => t + a.length, 0)}</span></h2><div class="card stack hl-note">${ent.map(([id, a]) => `<div class="stack" style="gap:4px"><button class="btn ghost small" style="align-self:flex-start" data-act="lesson" data-id="${id}">${stageById[lessonById[id].stageId].order}단계 · ${esc(lessonById[id].title)} →</button><ul class="clean">${a.slice().sort((x, y) => x - y).map(i => `<li><span class="mine-ink">${esc(lessonById[id].summary[i])}</span></li>`).join('')}</ul></div>`).join('')}</div></section>`;
}
function vStage(s) {
  return `<div class="page"><div class="row"><button class="btn ghost" data-act="learnHome">← 9단계 목록</button></div>
  <div class="head"><div class="eyebrow">${s.order}단계 · 약 ${s.estimatedMinutes}분</div><h1>${esc(s.title)}</h1><p>${esc(s.subtitle)}</p></div>
  <div class="grid">${s.lessons.map(l => `<button class="linkcard" data-act="lesson" data-id="${l.id}"><div class="row">${levelChip(l.riskLevel === 'critical' ? 'critical' : l.riskLevel === 'important' ? 'important' : 'info')}${store.read[l.id] ? '<span class="chip green">읽음</span>' : ''}</div><h3>${esc(l.title)}</h3><p>${esc(l.oneLine || l.summary[0])}</p></button>`).join('')}</div>
  <div class="row">${s.checklistIds.map(id => `<button class="btn" data-act="cksheet" data-id="${id}">체크리스트: ${esc(ckById[id].title)}</button>`).join('')}
    ${s.contractSampleId ? `<button class="btn" data-act="sample" data-id="${s.contractSampleId}">계약서 예시 보기</button>` : ''}
    <button class="btn primary" data-act="examStart" data-id="unit" data-stage="${s.id}">단원 퀴즈 풀기</button></div></div>`;
}
// 학습 문장 꾸미기: 어려운 용어 → 누르면 쉬운 설명(카드마다 처음 한 번), 숫자·기준·따옴표 → 형광펜(문장마다 최대 2곳)
const KEY_SRC = `'[^']{1,30}'|"[^"]{1,30}"|다음 날 0시|\\d[\\d,.]*\\s?(?:%|억|천만|만|원|일|개월|년|시|배|명)(?:\\s?원)?`;
const ALIAS = C.glossary.terms.flatMap(t => (t.aliases || []).map(a => [a, t.id])).sort((a, b) => b[0].length - a[0].length);
const aliasId = Object.fromEntries(ALIAS);
const RICH_RE = new RegExp(`(${ALIAS.map(([a]) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})|(${KEY_SRC})`, 'g');
function rich(text, seen, hl = true) {
  let out = '', last = 0, n = 0;
  for (const m of String(text).matchAll(RICH_RE)) {
    let rep = null;
    const inWord = m[1] && /[가-힣]/.test(text[m.index - 1] || ''); // '부동산공시가격알리미'처럼 더 긴 단어 속이면 건너뜀
    if (m[1] && !inWord && seen && !seen.has(aliasId[m[1]])) { seen.add(aliasId[m[1]]); rep = `<button class="term" data-act="term" data-id="${aliasId[m[1]]}">${esc(m[1])}</button>`; }
    else if (m[2] && hl && n < 2) rep = `<mark class="hl" style="--d:${n++}">${esc(m[2])}</mark>`;
    if (rep == null) continue;
    out += esc(text.slice(last, m.index)) + rep; last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}
function pickLessonQ(lessonId, exclude) {
  const all = qs.filter(q => q.lessonId === lessonId); if (!all.length) return null;
  const pool = all.length > 1 ? all.filter(q => q.id !== exclude) : all;
  return { lesson: lessonId, id: pool[Math.floor(Math.random() * pool.length)].id, a: null };
}
function lessonQuiz(l) {
  if (!S.lq || S.lq.lesson !== l.id) S.lq = pickLessonQ(l.id);
  if (!S.lq) return '';
  const q = qById[S.lq.id], a = S.lq.a, done = a != null, ox = q.type === 'OX';
  return `<section class="card stack lq" data-io><div class="row" style="justify-content:space-between"><div class="eyebrow">30초 확인 문제</div>${done ? '<button class="btn ghost small" data-act="lqNext">다른 문제 →</button>' : ''}</div>
    <p class="qprompt">${esc(q.prompt)}</p>
    <div class="opts${ox ? ' ox' : ''}">${q.options.map((o, i) => `<button class="opt ${done ? (i === q.answer ? 'right' : i === a ? 'wrong' : '') : ''}" data-act="lqAnswer" data-i="${i}" ${done ? 'disabled' : ''}>${ox ? '' : `<span class="k">${i + 1}</span>`}<span>${esc(o)}</span></button>`).join('')}</div>
    ${done ? `<div class="callout ${a === q.answer ? 'green' : 'red'}"><b>${a === q.answer ? '정답이에요!' : `정답은 ${esc(q.options[q.answer])}`}</b><br>${esc(q.explanation)}${a !== q.answer ? '<br><span class="small muted">오답노트에 담았어요. 모의고사 탭에서 다시 풀 수 있어요.</span>' : ''}</div>` : ''}</section>`;
}
function vLesson(l) {
  const s = stageById[l.stageId];
  const firstRead = !store.read[l.id];
  store.read[l.id] = true; save();
  if (firstRead && s.lessons.every(x => store.read[x.id])) setTimeout(() => toast(`${s.order}단계 '${s.title}'를 모두 읽었어요!`), 700);
  const idx = lessons.findIndex(x => x.id === l.id);
  const prev = lessons[idx - 1], next = lessons[idx + 1];
  const mine = store.hl[l.id] || [];
  const pos = s.lessons.findIndex(x => x.id === l.id) + 1;
  const seen = new Set();
  return `<div class="page lesson"><div class="row"><button class="btn ghost" data-act="stage" data-id="${s.id}">← ${s.order}단계 ${esc(s.title)}</button></div>
  <div class="head"><div class="eyebrow">${s.order}단계 학습카드 · ${pos}/${s.lessons.length}</div><h1>${esc(l.title)}</h1></div>
  ${l.oneLine ? `<p class="one-line" data-io>${rich(l.oneLine, seen)}</p>` : ''}
  ${l.easy ? `<div class="easy" data-io><span class="easy-tag">쉽게 말하면</span><p>${rich(l.easy, seen, false)}</p></div>` : ''}
  <div class="stack" style="gap:6px"><div class="eyebrow">이것만 기억해요</div><ol class="summary">${l.summary.map((x, i) => `<li class="hl-line${mine.includes(i) ? ' mine' : ''}" data-io data-act="hl" data-i="${i}" role="button" tabindex="0" aria-pressed="${mine.includes(i)}" style="--i:${i}"><span class="ink">${rich(x, seen)}</span></li>`).join('')}</ol>
    ${Object.keys(store.hl).length ? '' : '<p class="small muted hint">점선 단어를 누르면 쉬운 설명이 나와요. 문장을 누르면 밑줄이 그어져요.</p>'}</div>
  ${l.example ? `<div class="callout" data-io><b>예를 들면</b><br>${rich(l.example, seen, false)}</div>` : ''}
  ${l.warning ? `<div class="callout red stack" data-io role="note"><div class="row"><span class="chip red">주의</span><b>${esc(l.warning.title)}</b></div><p>${rich(l.warning.text, seen, false)}</p>${l.warning.actions?.length ? `<div><b>지금 할 일</b><ul class="clean ticks">${l.warning.actions.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}</div>` : ''}
  <details class="more" data-io><summary>자세히 알아보기</summary><p class="body">${rich(l.body, seen, false)}</p></details>
  ${(l.keyTerms || []).some(t => termById[t] && !seen.has(t)) ? `<div class="stack"><div class="eyebrow">함께 알면 좋은 용어</div><div class="row">${l.keyTerms.filter(t => termById[t] && !seen.has(t)).map(t => `<button class="term" data-act="term" data-id="${t}">${esc(termById[t].term)}</button>`).join(' · ')}</div></div>` : ''}
  ${l.policyUpdateIds?.length ? `<div class="stack"><div class="eyebrow">관련 최신 제도</div>${l.policyUpdateIds.map(id => puById[id] ? `<div class="row">${statusChip(puById[id].status)}<button class="btn ghost" data-act="nav" data-r="news">${esc(puById[id].title)}</button></div>` : '').join('')}</div>` : ''}
  ${l.relatedClauseIds?.length ? `<div class="stack"><div class="eyebrow">관련 특약</div><div class="row">${l.relatedClauseIds.map(id => `<span class="chip plain">${esc(clauseById[id]?.title)}</span>`).join('')}<button class="btn" data-act="clauses">특약 문구 보기</button></div></div>` : ''}
  ${l.contractHotspotIds?.length ? `<div class="row"><button class="btn" data-act="sample" data-id="contract_apt_jeonse_01">계약서 예시에서 확인하기</button></div>` : ''}
  ${refLinks(l.linkIds, '바로 확인하기')}
  ${l.calculatorId ? `<div class="row"><button class="btn" data-act="calc" data-id="${l.calculatorId}">${esc(calcById[l.calculatorId].title)} 열기</button></div>` : ''}
  ${l.contacts ? `<div class="card"><div class="eyebrow">연락처</div><ul class="clean">${l.contacts.map(c => `<li><b>${esc(c.name)}</b> <span class="num">${esc(c.phone)}</span></li>`).join('')}</ul></div>` : ''}
  ${relatedDocsForLesson(l.id)}
  ${lessonQuiz(l)}
  <div class="done-stamp" data-io aria-hidden="true"><span>학습<br>완료</span></div>
  <div class="lesson-nav">${prev ? `<button class="btn" data-act="lesson" data-id="${prev.id}">← ${esc(prev.title)}</button>` : '<span></span>'}${next ? `<button class="btn primary" data-act="lesson" data-id="${next.id}">${esc(next.title)} →</button>` : `<button class="btn primary" data-act="nav" data-r="exam">모의고사 보러 가기 →</button>`}</div></div>`;
}
function relatedDocsForLesson(id) {
  const ds = C.documents.documents.filter(d => (d.lessonIds || []).includes(id));
  return ds.length ? `<div class="stack"><div class="eyebrow">이 카드와 함께 읽을 서류</div><div class="row">${ds.map(d => `<button class="btn" data-act="doc" data-id="${d.id}">${esc(d.name)}</button>`).join('')}</div></div>` : '';
}

function vGlossary() {
  const q = S.gq.trim();
  const list = C.glossary.terms.filter(t => !q || (t.term + t.easy + t.detail).includes(q));
  return `<div class="page"><div class="head"><div class="eyebrow">용어사전</div><h1>어려운 말을 쉬운 말로</h1></div>
  <div class="field"><label for="gq">찾기</label><input id="gq" data-bind="gq" placeholder="예: 대항력, 확정일자" value="${esc(S.gq)}"></div>
  <div class="stack">${list.map(t => `<div class="card stack"><h3>${esc(t.term)}</h3><p><b>${esc(t.easy)}</b></p><p class="muted">${esc(t.detail)}</p>${t.example ? `<p class="small">예) ${esc(t.example)}</p>` : ''}</div>`).join('') || '<div class="empty">찾는 용어가 없어요.</div>'}</div></div>`;
}

function vDocs() {
  if (S.docId && docById[S.docId]) return vDoc(docById[S.docId]);
  return `<div class="page"><div class="head"><div class="eyebrow">서류 읽는 법</div><h1>전세 계약에서 만나는 서류 10가지</h1><p>처음 보면 낯설지만, 볼 곳은 정해져 있어요. 서류마다 '읽는 법'을 먼저 보고 견본으로 직접 눌러보세요.</p></div>
  <p class="small muted">${esc(C.documents.notice)}</p>
  <div class="grid">${C.documents.readingOrder.map(id => docById[id]).map((d, i) => `<button class="linkcard" data-act="doc" data-id="${d.id}"><div class="row">${priChip(d.priority)}<span class="small muted">${esc(d.when)}</span></div><h3>${i + 1}. ${esc(d.name)}</h3><p>${esc(d.aka)} — ${esc(d.short)}</p></button>`).join('')}</div></div>`;
}
function vDoc(d) {
  const tabs = `<div class="seg" role="group" aria-label="보기 선택"><button data-act="docTab" data-t="guide" aria-pressed="${S.docTab === 'guide'}">읽는 법</button><button data-act="docTab" data-t="sample" aria-pressed="${S.docTab === 'sample'}">견본 눌러보기</button></div>`;
  let body;
  if (S.docTab === 'guide') {
    body = `<p style="max-width:68ch">${esc(d.why)}</p>
    <div class="table-wrap"><table class="data"><tbody>
      <tr><th>언제 보나요</th><td>${esc(d.when)}</td></tr>
      <tr><th>어디서</th><td>${d.where.map(w => w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.name)}</a>` : esc(w.name)).join(' · ')}</td></tr>
      <tr><th>비용</th><td>${esc(d.cost)}</td></tr><tr><th>누가</th><td>${esc(d.who)}</td></tr></tbody></table></div>
    <h2>구성 한눈에 보기</h2>
    <div class="table-wrap"><table class="data"><thead><tr><th>부분</th><th>쉬운 말</th><th>무엇이 있나</th><th>확인할 것</th></tr></thead><tbody>${d.structure.map(s => `<tr><td><b>${esc(s.part)}</b></td><td>${esc(s.plain)}</td><td>${esc(s.what)}</td><td>${esc(s.check)}</td></tr>`).join('')}</tbody></table></div>
    <div class="grid"><div class="card stack"><h3>3초 체크</h3><ul class="clean ticks">${d.quickCheck.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="card stack"><h3>이런 게 보이면 멈추세요</h3><ul class="clean flags">${d.redFlags.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
    ${d.tips?.length ? `<div class="callout"><b>알아두면 좋은 점</b><ul class="clean">${d.tips.map(t => `<li>· ${esc(t)}</li>`).join('')}</ul></div>` : ''}
    <div class="row"><button class="btn primary" data-act="docTab" data-t="sample">견본으로 연습하기</button>${(d.lessonIds || []).map(id => `<button class="btn" data-act="lesson" data-id="${id}">학습: ${esc(lessonById[id]?.title)}</button>`).join('')}
      ${qs.some(q => q.documentId === d.id) ? `<button class="btn" data-act="quizDoc" data-id="${d.id}">이 서류 문제 풀기</button>` : ''}</div>`;
  } else {
    const smp = d.samples[Math.min(S.docSample, d.samples.length - 1)];
    const hsMap = by(d.hotspots);
    const order = (d.tourOrder || []).filter(id => JSON.stringify(smp).includes(`"${id}"`));
    const cur = S.hsId && hsMap[S.hsId];
    body = `${d.samples.length > 1 ? `<div class="seg" role="group" aria-label="견본 선택">${d.samples.map((s, i) => `<button data-act="docSample" data-i="${i}" aria-pressed="${i === S.docSample}">${esc(s.title)}</button>`).join('')}</div>` : ''}
    <div class="callout"><b>${esc(smp.title)}</b><br>${esc(smp.scenario)}</div>
    ${paperModes()}
    <div class="viewer">${paperDoc(smp, hsMap)}
      <aside class="panel">${legend()}<p class="small muted">색 점이 있는 칸을 누르면 설명이 나와요.</p>${tourControls(order, hsMap)}
        ${cur && !narrow() ? hotspotCard(cur) : ''}${verdictBox(smp.verdict)}</aside></div>`;
    S._tourOrder = order;
  }
  return `<div class="page"><div class="row"><button class="btn ghost" data-act="docsHome">← 서류 목록</button></div>
  <div class="head"><div class="row">${priChip(d.priority)}<span class="eyebrow">${esc(d.aka)}</span></div><h1>${esc(d.name)}</h1><p>${esc(d.short)}</p></div>${tabs}${body}</div>`;
}

function vContract() {
  const smp = sampleById[S.sampleId] || samples[0];
  const hsMap = by(smp.hotspots);
  const traps = C.contracts.trapExercises.filter(t => t.baseSampleId === smp.id);
  const ctx = smp.context || {};
  const order = smp.viewerTour || [];
  S._tourOrder = order;
  const nums = [['시세', ctx.marketPrice, ctx.marketPriceNote], ['공시가격', ctx.officialPrice], ['선순위 근저당', ctx.seniorDebt ?? ctx.registry?.eulgu?.reduce((a, e) => a + e.maxAmount, 0)], ['선순위 보증금', ctx.seniorDeposits]].filter(x => x[1]);
  let panel, paper;
  if (S.cmode === 'trap') {
    if (!traps.length) {
      paper = `<div class="empty">이 예시에는 위험 찾기 문제가 아직 없어요.<div class="row" style="justify-content:center;margin-top:10px">${C.contracts.trapExercises.map(t => `<button class="btn" data-act="sample" data-id="${t.baseSampleId}" data-mode="trap">${esc(t.label)}</button>`).join('')}</div></div>`;
      panel = '';
    } else {
      const t = traps.find(x => x.id === S.trap?.id) || traps[0];
      if (!S.trap || S.trap.id !== t.id) S.trap = { id: t.id, found: [], wrong: 0, revealed: false };
      paper = contractPaper(smp, hsMap, true);
      const score = S.trap.found.length * t.scoring.perCorrect + S.trap.wrong * t.scoring.perWrongTap;
      const all = S.trap.found.length === t.overrides.length;
      panel = `<div class="card stack"><h3>${esc(t.title)}</h3><p class="small">${esc(t.instruction)}</p>
        <div class="row"><span class="chip green">찾음 ${S.trap.found.length}/${t.overrides.length}</span><span class="chip plain">헛짚음 ${S.trap.wrong}</span><b class="num">${score}점</b></div>
        ${all ? '<div class="callout green">모두 찾았어요! 실제 계약서에서도 이 칸들을 먼저 보세요.</div>' : ''}
        <div class="row"><button class="btn" data-act="trapReveal">${S.trap.revealed ? '정답 숨기기' : '정답 보기'}</button><button class="btn ghost" data-act="trapReset">다시 하기</button></div></div>
        ${t.overrides.filter(o => S.trap.found.includes(o.fieldKey) || S.trap.revealed).map(o => `<div class="callout red small">${esc(o.answer)}</div>`).join('')}`;
    }
  } else {
    paper = contractPaper(smp, hsMap, false);
    const cur = S.hsId && hsMap[S.hsId];
    panel = `${legend()}${S.cmode === 'tour' ? tourControls(order, hsMap) : '<p class="small muted">색 점이 있는 칸을 누르면 설명이 나와요.</p>'}${cur && !narrow() ? hotspotCard(cur) : ''}${verdictBox(smp.verdict)}`;
  }
  return `<div class="page"><div class="head"><div class="eyebrow">계약서 예시</div><h1>계약서, 어디를 봐야 할까?</h1><p>법무부 주택임대차표준계약서 구성으로 만든 교육용 견본이에요. 주택 유형별로 위험한 칸이 달라요.</p></div>
  <div class="seg" role="group" aria-label="예시 선택">${samples.map(s => `<button data-act="sample" data-id="${s.id}" aria-pressed="${s.id === smp.id}">${esc(s.label)}</button>`).join('')}</div>
  <div class="card stack"><div class="row">${smp.verdict ? `<span class="chip ${verdictColor[smp.verdict.level]}">${smp.verdict.level === 'red' ? '위험' : smp.verdict.level === 'yellow' ? '주의' : '양호'}</span>` : ''}<h3>${esc(smp.title)}</h3></div><p class="muted">${esc(smp.summary || '')}</p>
    ${nums.length ? `<div class="row">${nums.map(([k, v, note]) => `<span class="chip plain">${k} <span class="num">${won(v)}</span>${note ? ` (${esc(note)})` : ''}</span>`).join('')}</div>` : ''}
    ${ctx.calc?.explain ? `<p class="small">${esc(ctx.calc.explain)}</p>` : ''}
    ${(ctx.documentIds || []).length ? `<div class="row"><span class="small muted">함께 볼 서류</span>${ctx.documentIds.map(id => `<button class="btn ghost" data-act="doc" data-id="${id}" data-t="sample">${esc(docById[id].name)}</button>`).join('')}</div>` : ''}</div>
  <div class="seg" role="group" aria-label="보기 방식"><button data-act="cmode" data-m="read" aria-pressed="${S.cmode === 'read'}">계약서 보기</button><button data-act="cmode" data-m="tour" aria-pressed="${S.cmode === 'tour'}">핵심 투어</button><button data-act="cmode" data-m="trap" aria-pressed="${S.cmode === 'trap'}">위험 찾기 게임</button></div>
  ${S.cmode === 'trap' && traps.length > 1 ? `<div class="seg">${traps.map(t => `<button data-act="trapPick" data-id="${t.id}" aria-pressed="${S.trap?.id === t.id}">${esc(t.label)}</button>`).join('')}</div>` : ''}
  ${paperModes()}
  <div class="viewer">${paper}<aside class="panel">${panel}</aside></div>
  <details class="card"><summary><b>양식 이야기: 표준계약서 vs 중개업계 양식</b></summary><div class="stack" style="margin-top:10px">${C.contracts.forms.map(f => `<div><h3>${esc(f.name)} ${f.recommended ? '<span class="chip green">추천</span>' : ''}</h3><ul class="clean">${(f.pros || f.watchOut || []).map(x => `<li>· ${esc(x)}</li>`).join('')}</ul>${f.note ? `<p class="small muted">${esc(f.note)}</p>` : ''}</div>`).join('')}<p class="small muted">${esc(C.contracts.notice)}</p></div></details></div>`;
}

/* ---------- planner ---------- */
const REGIONS = { seoul: ['서울', 165e6, 55e6, true], dense: ['수도권 과밀억제권역·세종·용인·화성·김포', 145e6, 48e6, true], metroOther: ['그 밖의 수도권', 75e6, 25e6, true], city: ['광역시 등(안산·광주·파주·이천·평택 포함)', 85e6, 28e6, false], other: ['그 밖의 지역', 75e6, 25e6, false] };
const HOUSE = { APARTMENT: '아파트', VILLA: '빌라(다세대·연립)', OFFICETEL: '오피스텔', MULTI_FAMILY: '다가구', DETACHED: '단독' };
const FLAGS = C.clauses.conditions.filter(c => c.key !== 'all' && c.key !== 'isApartment');
const newContract = () => ({ id: 'c' + Date.now().toString(36), name: '새 계약', house: 'APARTMENT', region: 'dense', lease: 'JEONSE', deposit: '', rent: '', market: '', official: '', debt: '', seniorDep: '', visit: '', contract: '', balance: '', end: '', flags: { usesInsurance: true } });
const exampleContract = () => ({ id: 'cex' + Date.now().toString(36), example: true, name: '예시 · 샘플마을아파트 1203호', house: 'APARTMENT', region: 'dense', lease: 'JEONSE', deposit: 32000, rent: '', market: 50000, official: 36000, debt: 6000, seniorDep: '', visit: '2026-10-25', contract: '2026-11-02', balance: '2026-12-15', end: '2028-12-14', flags: { usesLoan: true, usesInsurance: true, hasMortgage: true, needsRepair: true } });
function activeContract() { return store.contracts.find(c => c.id === store.active) || store.contracts[0] || null; }
const man = v => (v === '' || v == null || isNaN(+v)) ? null : +v * 1e4;

function buildEvents(c) {
  const base = { VISIT: pDate(c.visit), CONTRACT: pDate(c.contract), BALANCE: pDate(c.balance), END: pDate(c.end) };
  const ev = [];
  C.checklists.checklists.forEach(ck => { const b = base[ck.eventType]; if (b) ev.push({ id: 'ck:' + ck.id, date: addDays(b, ck.offsetDays || 0), title: ck.title, ck: ck.id }); });
  if (base.CONTRACT) ev.push({ id: 'r:report', date: addDays(base.CONTRACT, 30), title: '임대차 신고 마감(계약일 + 30일, 대상 계약)', note: '신고하면 확정일자가 자동 부여돼요.' });
  if (base.BALANCE) ev.push({ id: 'r:daehang', date: addDays(base.BALANCE, 1), title: '대항력 발생일 — 등기부 다시 확인', note: '현행법상 전입신고 다음 날 0시에 대항력이 생겨요. 그 사이 권리 변동이 없었는지 보세요.' });
  if (base.BALANCE && base.END && base.END > base.BALANCE) {
    const half = new Date(base.BALANCE.getTime() + (base.END - base.BALANCE) / 2);
    ev.push({ id: 'r:hug', date: addDays(half, -30), title: 'HUG 보증 신청 마감 임박(계약기간 1/2 30일 전)', note: '아직 보증보험이 없다면 서두르세요.' });
    for (let d = addMonths(base.BALANCE, 6), k = 1; d < addDays(base.END, -60); d = addMonths(base.BALANCE, 6 * ++k)) ev.push({ id: 'r:reg' + k, date: d, title: '정기 점검 — 등기부등본 확인', note: '집주인 변경·경매개시·새 근저당이 없는지 확인해요.' });
  }
  if (base.END) {
    ev.push({ id: 'r:notice', date: addDays(base.END, -60), title: '갱신·이사 의사 통지 마감(만료 2개월 전)', note: '기록이 남는 방식으로 통지하세요.' });
    ev.push({ id: 'r:end', date: base.END, title: '계약 만료일 — 보증금 반환·이사', note: '보증금을 받기 전에는 전출하지 마세요. 먼저 나가야 하면 임차권등기명령.' });
  }
  return ev.sort((a, b) => a.date - b.date);
}
function ckItems(c, ckId) { return ckById[ckId].items.filter(it => !it.condition || c.flags[it.condition]); }
function evDone(c, e) { if (!e.ck) return !!(store.checks[c.id] || {})['ev:' + e.id]; const ch = store.checks[c.id] || {}; const req = ckItems(c, e.ck).filter(i => i.required); return req.length > 0 && req.every(i => ch[i.id]); }

function diagnose(c) {
  const dep = man(c.deposit), debt = man(c.debt) || 0, sd = man(c.seniorDep) || 0, mp = man(c.market), op = man(c.official);
  const R = REGIONS[c.region] || REGIONS.other;
  const out = { items: [] };
  if (dep && mp) out.ratio = (dep + debt + sd) / mp * 100;
  if (dep) {
    const total = dep + debt + sd;
    if (c.house !== 'APARTMENT' && op) { out.hugLimit = op * 1.26; out.hugPass = total <= out.hugLimit; out.hugBasis = '공시가격 × 126%'; }
    else if (mp) { out.hugLimit = mp * 0.9; out.hugPass = total <= out.hugLimit; out.hugBasis = '시세 × 90%'; }
    out.capLimit = R[3] ? 7e8 : 5e8; out.capPass = dep <= out.capLimit;
    out.small = dep <= R[1]; out.smallAmt = Math.min(R[2], dep); out.smallTh = R[1];
  }
  if (c.flags.isTrust) out.items.push(['red', '신탁등기 주택이에요. 신탁원부와 수탁자 동의서 없이 계약하지 마세요.', 'doc_trust']);
  if (c.flags.isMultiFamily) out.items.push(['yellow', '다가구예요. 선순위 보증금(확정일자 부여현황)과 전입세대를 꼭 확인하세요.', 'doc_fixeddate']);
  if (c.flags.isAgent) out.items.push(['yellow', '대리인 계약이에요. 위임장·인감증명서 확인과 소유자 직접 통화를 하세요.', null]);
  if (c.flags.hasMortgage && !c.debt) out.items.push(['yellow', '근저당이 있다고 체크했어요. 채권최고액을 입력하면 위험도가 정확해져요.', 'doc_registry']);
  if (c.house === 'OFFICETEL') out.items.push(['blue', '오피스텔은 전입신고가 가능한지 꼭 확인하고, 전입신고 보장 특약을 넣으세요.', 'doc_building']);
  return out;
}

function vMy() {
  const c = activeContract();
  const head = `<div class="head"><div class="eyebrow">내 계약 플래너</div><h1>날짜만 넣으면 할 일이 정리돼요</h1><p>계약일·잔금일·만기일을 넣으면 그날 할 일, 체크리스트, 특약 문구, 위험 진단이 만들어져요. 이 기기 브라우저에만 저장돼요.</p></div>`;
  if (!c) return `<div class="page">${head}<div class="empty stack"><p>아직 등록한 계약이 없어요.</p><div class="row" style="justify-content:center"><button class="btn primary" data-act="cNew">내 계약 만들기</button><button class="btn" data-act="cExample">예시 계약으로 둘러보기</button></div></div>
    <div class="card stack"><h2>특약 문구만 보고 싶다면</h2><p class="muted">계약을 만들지 않아도 특약 라이브러리 전체를 볼 수 있어요.</p><div><button class="btn" data-act="myTab" data-t="library">특약 라이브러리 열기</button></div></div>${S.myTab === 'library' ? vLibrary() : ''}</div>`;
  const tabs = [['plan', '일정·체크리스트'], ['risk', '위험 진단'], ['clauses', '특약 만들기'], ['info', '계약 정보'], ['backup', '백업']];
  const tab = tabs.some(t => t[0] === S.myTab) ? S.myTab : 'plan';
  let body = '';
  if (tab === 'plan') body = vPlan(c);
  if (tab === 'risk') body = vRisk(c);
  if (tab === 'clauses') body = vClauses(c);
  if (tab === 'info') body = vInfo(c);
  if (tab === 'backup') body = vBackup();
  return `<div class="page">${head}
  <div class="row"><div class="field" style="min-width:min(100%,280px)"><label for="csel">계약 선택</label><select id="csel" data-bind="active">${store.contracts.map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <button class="btn" data-act="cNew" style="align-self:end">+ 새 계약</button>
    ${S.confirmDel ? `<span class="row" style="align-self:end"><span class="small">'${esc(c.name)}'을(를) 지울까요?</span><button class="btn primary" data-act="cDelYes">지우기</button><button class="btn" data-act="cDelNo">취소</button></span>` : `<button class="btn ghost" data-act="cDel" style="align-self:end">이 계약 지우기</button>`}</div>
  ${c.example ? '<div class="callout yellow small">예시 데이터예요. \'계약 정보\'에서 내 계약으로 바꿔 쓰거나 새 계약을 만드세요.</div>' : ''}
  <div class="seg" role="group" aria-label="플래너 메뉴">${tabs.map(([k, t]) => `<button data-act="myTab" data-t="${k}" aria-pressed="${tab === k}">${t}</button>`).join('')}</div>${body}</div>`;
}
function vPlan(c) {
  const evs = buildEvents(c);
  if (!evs.length) return `<div class="empty">'계약 정보'에서 날짜를 넣으면 일정이 생겨요.<div style="margin-top:10px"><button class="btn primary" data-act="myTab" data-t="info">날짜 넣기</button></div></div>`;
  const ch = store.checks[c.id] || {};
  return `<div class="timeline">${evs.map(e => {
    const n = ddays(e.date), done = evDone(c, e), open = S.openEv[e.id] ?? (n >= 0 && n <= 7 && !!e.ck);
    const items = e.ck ? ckItems(c, e.ck) : [];
    const cnt = items.filter(i => ch[i.id]).length;
    return `<div class="ev${n === 0 ? ' today' : ''}${n < 0 ? ' past' : ''}${done ? ' done' : ''}">
      <div class="ev-head"><span class="dday${n >= 0 && n <= 3 ? ' soon' : ''}">${ddayLabel(n)}</span><span class="d">${fmt(e.date)}</span><b>${esc(e.title)}</b>${e.ck ? `<span class="small muted num">${cnt}/${items.length}</span>` : ''}</div>
      ${e.note ? `<p class="small muted">${esc(e.note)}</p>` : ''}
      ${e.ck ? `<button class="btn ghost small" data-act="evToggle" data-id="${e.id}">${open ? '체크리스트 접기' : '체크리스트 펼치기'}</button>` : `<label class="check${done ? ' done' : ''}"><input type="checkbox" data-act="evCheck" data-id="${e.id}" ${done ? 'checked' : ''}><span class="t">완료</span></label>`}
      ${e.ck && open ? `<div class="card" data-evbody="${e.id}" style="padding:8px;margin-top:6px">${ckById[e.ck].fieldMode ? '<p class="small muted" style="padding:4px 10px">현장 모드: 이 화면을 켜두고 하나씩 체크하세요.</p>' : ''}${items.map(it => `<label class="check${ch[it.id] ? ' done' : ''}"><input type="checkbox" data-act="ckItem" data-id="${it.id}" ${ch[it.id] ? 'checked' : ''}><span><span class="t">${esc(it.text)}</span> ${it.required ? '' : '<span class="chip plain">권장</span>'}
        ${it.helpLessonId ? `<button class="btn ghost small" data-act="lesson" data-id="${it.helpLessonId}">왜?</button>` : ''}${it.contractHotspotId ? `<button class="btn ghost small" data-act="hsSheet" data-id="${it.contractHotspotId}">계약서 칸</button>` : ''}${it.calculatorId ? `<button class="btn ghost small" data-act="calc" data-id="${it.calculatorId}">계산기</button>` : ''}</span></label>`).join('')}</div>` : ''}</div>`;
  }).join('')}</div>`;
}
function vRisk(c) {
  const d = diagnose(c);
  if (!c.deposit) return `<div class="empty">'계약 정보'에서 보증금과 시세(또는 공시가격)를 넣으면 진단해 드려요.<div style="margin-top:10px"><button class="btn primary" data-act="myTab" data-t="info">정보 넣기</button></div></div>`;
  const r = d.ratio;
  const band = r == null ? null : r <= 70 ? ['green', '비교적 안전'] : r <= 80 ? ['yellow', '주의'] : ['red', '위험'];
  return `<div class="grid">
    <div class="card stack"><div class="eyebrow">보증금 + 앞선 빚 ÷ 시세</div>${r != null ? `<div class="row"><b class="num" style="font-size:2rem">${r.toFixed(1)}%</b><span class="chip ${band[0]}">${band[1]}</span></div>
      ${meter(r)}
      <p class="small muted">보증금 ${won(man(c.deposit))} + 근저당 ${won(man(c.debt) || 0)}${c.seniorDep ? ` + 선순위 보증금 ${won(man(c.seniorDep))}` : ''} ÷ 시세 ${won(man(c.market))}</p>` : '<p class="muted">시세를 넣으면 계산돼요.</p>'}</div>
    <div class="card stack"><div class="eyebrow">HUG 가격 기준 (${esc(d.hugBasis || '-')})</div>${d.hugLimit ? `<div class="row"><b class="num" style="font-size:1.4rem">${won(d.hugLimit)}</b><span class="chip ${d.hugPass ? 'green' : 'red'}">${d.hugPass ? '이내' : '초과'}</span></div><p class="small">${d.hugPass ? '가격 기준은 통과할 가능성이 있어요. 그래도 원룸·빌라·다가구는 거절되는 사례가 있으니 위반건축물·압류·신탁을 확인하고 보증기관에 가입 가능 여부를 직접 물어보세요.' : '보증금과 앞선 빚의 합이 한도를 넘어요. 보증보험이 거절될 가능성이 커요.'}</p>` : '<p class="muted">공시가격(빌라 등) 또는 시세(아파트)를 넣어주세요.</p>'}
      ${d.capLimit ? `<p class="small">보증금 한도(${REGIONS[c.region][3] ? '수도권' : '그 외'}): ${won(d.capLimit)} — <b>${d.capPass ? '이내' : '초과(SGI 검토)'}</b></p>` : ''}</div>
    <div class="card stack"><div class="eyebrow">소액임차인 최우선변제</div><p><b>${esc(REGIONS[c.region][0])}</b> 기준: 보증금 ${won(d.smallTh)} 이하</p>${d.small ? `<span class="chip green">해당 가능</span><p class="small">대항력을 갖추면 경매 때 최대 ${won(d.smallAmt)}까지 먼저 받을 수 있어요. 기준 시점은 선순위 근저당 설정일이에요.</p>` : '<span class="chip plain">해당 없음</span><p class="small">보증금이 기준보다 커요. 보증보험이 더 중요해요.</p>'}</div>
  </div>
  ${d.items.length ? `<div class="stack">${d.items.map(([lv, t, doc]) => `<div class="callout ${lv}">${esc(t)}${doc ? ` <button class="btn ghost" data-act="doc" data-id="${doc}">${esc(docById[doc].name)} 읽는 법</button>` : ''}</div>`).join('')}</div>` : ''}
  <p class="small muted">이 진단은 교육용 참고 계산이에요. 실제 보증 가능 여부는 보증기관 심사, 안심전세앱 위험진단과 서류 확인으로 판단하세요.</p>`;
}
function clauseList(c) {
  const active = new Set(['all', ...Object.keys(c.flags).filter(k => c.flags[k])]);
  if (c.house === 'APARTMENT') active.add('isApartment');
  return C.clauses.clauses.filter(cl => cl.conditions.some(k => active.has(k)));
}
function clauseText(c, cl) {
  const sel = (store.clauseSel[c.id] || {})[cl.id];
  if (sel && sel.text != null) return sel.text;
  let t = cl.text;
  if (cl.id === 'cl_keep_rights' && c.debt) t = t.replace('금 ○○○원', `금 ${won(man(c.debt)).replace(' 원', '원')}`);
  if (cl.id === 'cl_multi_family_disclosure' && c.seniorDep) t = t.replace('금 ○○○원', `금 ${won(man(c.seniorDep)).replace(' 원', '원')}`);
  return t;
}
function clauseOn(c, cl) { const sel = (store.clauseSel[c.id] || {})[cl.id]; if (sel && sel.on != null) return sel.on; return cl.priority !== 'SITUATIONAL' || cl.conditions.some(k => k !== 'all' && c.flags[k]); }
function vClauses(c) {
  const list = clauseList(c);
  const on = list.filter(cl => clauseOn(c, cl));
  const out = on.map((cl, i) => `${i + 1}. ${clauseText(c, cl)}`).join('\n');
  const grp = { MUST: '필수', RECOMMENDED: '권장', SITUATIONAL: '상황별' };
  return `<div class="callout small">${esc(C.clauses.notice)} 내 상황(계약 정보의 체크 항목)에 맞는 특약만 골라 보여줘요.</div>
  ${['MUST', 'RECOMMENDED', 'SITUATIONAL'].map(p => { const g = list.filter(cl => cl.priority === p); return g.length ? `<section class="stack"><h2>${grp[p]} 특약</h2>${g.map(cl => { const isOn = clauseOn(c, cl); return `<div class="clause${isOn ? '' : ' off'}"><label class="row" style="cursor:pointer"><input type="checkbox" data-act="clOn" data-id="${cl.id}" ${isOn ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--stamp)"><b>${esc(cl.title)}</b></label>
    <textarea id="cl-${cl.id}" data-bind="clText" data-id="${cl.id}" aria-label="${esc(cl.title)} 문구">${esc(clauseText(c, cl))}</textarea>
    <p class="small muted">왜? ${esc(cl.why)}</p>${cl.talkToBroker ? `<p class="small">중개사에게: “${esc(cl.talkToBroker)}”</p>` : ''}${(cl.fillFields || []).length ? '<p class="small muted">○○ 부분은 내 계약에 맞게 고쳐 쓰세요.</p>' : ''}</div>`; }).join('')}</section>` : ''; }).join('')}
  <section class="card stack"><h2>완성된 특약 (${on.length}개)</h2><textarea id="clOut" readonly style="min-height:220px">${esc(out)}</textarea>
  <div class="row"><button class="btn primary" data-act="copyOut">복사하기</button><span class="small muted">복사해서 중개사에게 문자로 미리 보내두세요.</span></div>
  <div class="callout red small"><b>특약을 거부한다면</b><ul class="clean">${C.clauses.redFlagsWhenRefused.map(x => `<li>· ${esc(x)}</li>`).join('')}</ul></div></section>`;
}
function vLibrary() {
  return `<section class="stack">${C.clauses.clauses.map(cl => `<div class="clause"><div class="row"><span class="chip ${cl.priority === 'MUST' ? 'red' : cl.priority === 'RECOMMENDED' ? 'yellow' : 'plain'}">${cl.priority === 'MUST' ? '필수' : cl.priority === 'RECOMMENDED' ? '권장' : '상황별'}</span><b>${esc(cl.title)}</b><span class="small muted">${cl.conditions.map(k => C.clauses.conditions.find(x => x.key === k)?.label).filter(Boolean).join(' · ')}</span></div><p style="font-family:var(--f-doc)">${esc(cl.text)}</p><p class="small muted">왜? ${esc(cl.why)}</p></div>`).join('')}</section>`;
}
function vInfo(c) {
  const f = (k, label, type = 'text', extra = '') => `<div class="field"><label for="f-${k}">${label}</label><input id="f-${k}" type="${type}" data-bind="c" data-k="${k}" value="${esc(c[k] ?? '')}" ${extra}></div>`;
  return `<div class="card stack"><h2>기본 정보</h2><div class="form-grid">${f('name', '계약 이름(메모)')}
    <div class="field"><label for="f-house">주택 유형</label><select id="f-house" data-bind="c" data-k="house">${Object.entries(HOUSE).map(([k, v]) => `<option value="${k}" ${c.house === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="field"><label for="f-region">지역(소액임차인·보증 한도 기준)</label><select id="f-region" data-bind="c" data-k="region">${Object.entries(REGIONS).map(([k, v]) => `<option value="${k}" ${c.region === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
    <div class="field"><label for="f-lease">계약 형태</label><select id="f-lease" data-bind="c" data-k="lease"><option value="JEONSE" ${c.lease === 'JEONSE' ? 'selected' : ''}>전세</option><option value="MONTHLY" ${c.lease === 'MONTHLY' ? 'selected' : ''}>보증금 있는 월세</option></select></div></div></div>
  <div class="card stack"><h2>금액 (만 원 단위)</h2><div class="form-grid">${f('deposit', '보증금', 'number', 'inputmode="numeric" min="0"')}${c.lease === 'MONTHLY' ? f('rent', '월세', 'number', 'inputmode="numeric" min="0"') : ''}${f('market', '매매 시세', 'number', 'inputmode="numeric" min="0"')}${f('official', '공시가격', 'number', 'inputmode="numeric" min="0"')}${f('debt', '근저당 채권최고액 합계', 'number', 'inputmode="numeric" min="0"')}${f('seniorDep', '선순위 보증금 합계(다가구 등)', 'number', 'inputmode="numeric" min="0"')}</div>
    <p class="small muted">예: 3억 2천만 원 → 32000</p></div>
  <div class="card stack"><h2>날짜</h2><div class="form-grid">${f('visit', '집 보러 가는 날', 'date')}${f('contract', '계약일', 'date')}${f('balance', '잔금·이사일', 'date')}${f('end', '만기일', 'date')}</div></div>
  <div class="card stack"><h2>내 상황</h2><p class="small muted">체크한 항목에 맞춰 체크리스트와 특약이 바뀌어요.</p><div class="form-grid">${FLAGS.map(fl => `<label class="check"><input type="checkbox" data-act="flag" data-k="${fl.key}" ${c.flags[fl.key] ? 'checked' : ''}><span>${esc(fl.label)}</span></label>`).join('')}</div></div>`;
}
function vBackup() {
  const data = JSON.stringify({ contracts: store.contracts, checks: store.checks, clauseSel: store.clauseSel }, null, 0);
  return `<div class="card stack"><h2>백업하기</h2><p class="muted small">플래너 내용은 이 기기 브라우저에만 저장돼요. 아래 글을 복사해 메모앱 등에 보관하면 다른 기기에서 불러올 수 있어요.</p>
    <textarea id="bkOut" readonly>${esc(data)}</textarea><div><button class="btn" data-act="copyBk">복사하기</button></div></div>
  <div class="card stack"><h2>불러오기</h2><textarea id="bkIn" placeholder="백업한 글을 붙여넣으세요"></textarea><div class="row"><button class="btn primary" data-act="importBk">불러오기</button>${S.importMsg ? `<span class="small">${esc(S.importMsg)}</span>` : ''}</div></div>`;
}

/* ---------- insurance ---------- */
function calcCard(cl) {
  const vals = S['calc_' + cl.id] || {};
  return `<div class="card stack" id="${cl.id}"><h3>${esc(cl.title)}</h3><div class="form-grid">${cl.inputs.map(inp => {
    const unit = inp.type === 'money' ? '만 원' : inp.type === 'percent' ? '%' : '일';
    const def = vals[inp.key] ?? (inp.default != null ? (inp.type === 'money' ? inp.default / 1e4 : inp.default) : '');
    return `<div class="field"><label for="${cl.id}-${inp.key}">${esc(inp.label.replace('(원)', '').replace('(연, %)', ''))} (${unit})</label><input id="${cl.id}-${inp.key}" type="number" inputmode="decimal" step="any" min="0" data-calc="${cl.id}" data-k="${inp.key}" value="${esc(def)}"></div>`;
  }).join('')}</div>${refLinks(cl.linkIds, '값 찾아보기')}${calcOut(cl)}${cl.note ? `<p class="small muted">${esc(cl.note)}</p>` : ''}</div>`;
}
function refLinks(ids, label) {
  const ls = (ids || []).map(id => linkById[id]).filter(Boolean);
  if (!ls.length) return '';
  return `<div class="stack ref-links"><div class="eyebrow">${esc(label)}</div><ul class="clean">${ls.map(k => `<li><a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.name)} ↗</a> <span class="small muted">${esc(k.desc)}</span></li>`).join('')}</ul></div>`;
}
function calcVals(cl) {
  const v = {}; const st = S['calc_' + cl.id] || {};
  cl.inputs.forEach(inp => { let x = st[inp.key] ?? (inp.default != null ? (inp.type === 'money' ? inp.default / 1e4 : inp.default) : ''); x = x === '' ? null : +x; v[inp.key] = x == null ? null : inp.type === 'money' ? x * 1e4 : x; });
  return v;
}
// 결과 문구 + 신호등 색(lv) + 전세가율(ratio, 게이지용)
function calcResult(cl) {
  const v = calcVals(cl);
  if (cl.id === 'calc_jeonse_ratio') {
    if (!v.deposit || !v.marketPrice) return { html: '보증금과 시세를 넣어보세요.', lv: '', ratio: null };
    const r = (v.deposit + (v.seniorDebt || 0)) / v.marketPrice * 100; const b = cl.bands.find(x => r <= x.max);
    return { html: `<b class="num">${r.toFixed(1)}%</b> — ${esc(b.message)}`, lv: b.level, ratio: r };
  }
  if (cl.id === 'calc_hug_126') {
    if (!v.officialPrice || !v.deposit) return { html: '공시가격과 보증금을 넣어보세요.', lv: '' };
    const lim = v.officialPrice * 1.26, tot = v.deposit + (v.seniorDebt || 0);
    return { html: `한도 <b class="num">${won(lim)}</b> / 보증금+선순위 <b class="num">${won(tot)}</b><br>${esc(tot <= lim ? cl.resultMessages.pass : cl.resultMessages.fail)}${tot > lim ? ` (최대 보증금 약 ${won(Math.max(0, lim - (v.seniorDebt || 0)))})` : ''}`, lv: tot <= lim ? 'yellow' : 'red' };
  }
  if (cl.id === 'calc_hug_fee') {
    if (!v.deposit || !v.rate || !v.days) return { html: '값을 넣어보세요.', lv: '' };
    return { html: `예상 보증료(할인 전) <b class="num">${Math.round(v.deposit * v.rate / 100 * v.days / 365).toLocaleString('ko-KR')}원</b>`, lv: '' };
  }
  return { html: '', lv: '' };
}
function calcOut(cl) {
  const o = calcResult(cl);
  return `${cl.id === 'calc_jeonse_ratio' ? meter(o.ratio, cl.id + '-meter') : ''}<div class="callout ${o.lv}" id="${cl.id}-out" aria-live="polite">${o.html}</div>`;
}
function updateCalc(cl) {
  const o = calcResult(cl), out = document.getElementById(cl.id + '-out');
  out.className = 'callout ' + o.lv; out.innerHTML = o.html;
  const pin = document.querySelector(`#${cl.id}-meter .pin`);
  if (pin) { pin.hidden = o.ratio == null; if (o.ratio != null) pin.style.left = Math.min(Math.max(o.ratio, 0), 100) + '%'; }
}
function vInsurance() {
  const P = C.insurance.providers;
  const rows = [['상품', 'product'], ['성격', 'type'], ['이런 분께', 'bestFor'], ['보증금 한도', 'depositLimit'], ['핵심 조건', 'keyCondition'], ['보증료율', 'feeRate'], ['신청 기한', 'applyDeadline'], ['신청 방법', 'howToApply']];
  return `<div class="page"><div class="head"><div class="eyebrow">보증보험 비교</div><h1>HUG · HF · SGI, 어디에 들까?</h1><p>${esc(C.insurance.notice)}</p></div>
  <div class="table-wrap"><table class="data"><thead><tr><th></th>${P.map(p => `<th>${esc(p.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([t, k]) => `<tr><th>${t}</th>${P.map(p => `<td>${esc(Array.isArray(p[k]) ? p[k].join(', ') : (p[k] || '-'))}</td>`).join('')}</tr>`).join('')}
    <tr><th>거절 사유</th>${P.map(p => `<td>${esc((p.rejectReasons || []).join(', ') || '-')}</td>`).join('')}</tr></tbody></table></div>
  <section class="card stack"><h2>나에게 맞는 곳</h2><div class="table-wrap"><table class="data"><tbody>${C.insurance.decisionGuide.map(g => `<tr><td>${esc(g.if)}</td><td><b>${g.then === 'none' ? '계약 재검토' : esc(P.find(p => p.id === g.then)?.name)}</b></td><td class="muted">${esc(g.reason)}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="stack"><h2>계산기</h2>${C.lessons.calculators.map(calcCard).join('')}</section>
  <div class="callout"><b>${esc(C.insurance.feeFormula)}</b><br>${esc(C.insurance.feeExample.explain)}</div>
  <ul class="clean ticks">${C.insurance.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
}

/* ---------- exam ---------- */
const CAT = { BASIC: '기초', DOCS: '서류·권리분석', CLAUSE: '특약', INSURANCE: '보증보험', RESPONSE: '대응' };
function startExam(kind, opt = {}) {
  let pool = [], title = '', limit = null, mode = 'after', examId = kind;
  if (kind === 'exam_full_01' || kind === 'exam_full_02') {
    const ex = examById[kind]; title = ex.title; limit = ex.timeLimitMin;
    Object.entries(ex.distribution).forEach(([cat, n]) => { pool.push(...shuffle(qs.filter(q => q.category === cat)).slice(0, n)); });
    pool.sort((a, b) => a.stageId.localeCompare(b.stageId));
  } else if (kind === 'exam_docs') {
    const ex = examById[kind]; title = ex.title; limit = ex.timeLimitMin;
    pool = shuffle(qs.filter(q => q.documentId || q.contractHotspotId)).slice(0, ex.questionCount);
  } else if (kind === 'unit') {
    const st = stageById[opt.stage]; title = `${st.order}단계 단원 퀴즈`; mode = 'now'; examId = 'unit:' + st.id;
    pool = shuffle(qs.filter(q => q.stageId === st.id)).slice(0, 5);
  } else if (kind === 'wrong') {
    title = '오답노트 다시 풀기'; mode = 'now';
    pool = shuffle(Object.keys(store.wrong).map(id => qById[id]).filter(Boolean)).slice(0, 20);
  } else if (kind === 'ids') {
    title = opt.title || '관련 문제'; mode = 'now'; examId = 'ids';
    pool = opt.ids.map(id => qById[id]).filter(Boolean);
  }
  if (!pool.length) { toast('풀 문제가 없어요'); return; }
  const perm = {}; pool.forEach(q => { const o = q.options.map((_, i) => i); perm[q.id] = q.type === 'OX' ? o : shuffle(o); });
  S.session = { examId, title, ids: pool.map(q => q.id), i: 0, ans: {}, perm, mode, limit, start: Date.now() };
  S.result = null; S.submitWarn = false;
  go('exam');
}
function vExam() {
  if (S.session) return vSession();
  if (S.result) return vResult();
  const last = store.results.slice(-5).reverse();
  const wrongN = Object.keys(store.wrong).length;
  return `<div class="page"><div class="head"><div class="eyebrow">모의고사</div><h1>${qs.length}문항 문제은행</h1><p>실전 모의고사는 30분에 30문항, 80점 이상이면 수료 배지를 받아요. 틀린 문제는 오답노트에 모여요.</p></div>
  <div class="grid">
    ${['exam_full_01', 'exam_full_02', 'exam_docs'].map(id => { const e = examById[id]; return `<div class="card stack"><h3>${esc(e.title)}</h3><p class="small muted">${e.questionCount}문항 · ${e.timeLimitMin}분 · 합격 ${e.passScore}점</p>${e.distribution ? `<p class="small">${Object.entries(e.distribution).map(([k, v]) => `${CAT[k]} ${v}`).join(' · ')}</p>` : '<p class="small">등기부·건축물대장·확인설명서·계약서 칸 읽기</p>'}<div><button class="btn primary" data-act="examStart" data-id="${id}">시작하기</button></div></div>`; }).join('')}
    <div class="card stack"><h3>오답노트</h3><p class="small muted">${wrongN}문항 · 맞히면 노트에서 빠져요</p><div><button class="btn" data-act="examStart" data-id="wrong" ${wrongN ? '' : 'disabled'}>다시 풀기</button></div></div></div>
  <section class="stack"><h2>단원 퀴즈 (5문항, 바로 해설)</h2><div class="where">${STAGES.map(s => `<button data-act="examStart" data-id="unit" data-stage="${s.id}">${s.order}. ${esc(s.title)}</button>`).join('')}</div></section>
  ${last.length ? `<section class="stack"><h2>최근 기록</h2><div class="table-wrap"><table class="data"><thead><tr><th>날짜</th><th>시험</th><th>점수</th></tr></thead><tbody>${last.map(r => `<tr><td class="num">${esc(r.date)}</td><td>${esc(r.title)}</td><td class="num">${r.score}점 (${r.correct}/${r.total})</td></tr>`).join('')}</tbody></table></div></section>` : ''}
  ${store.results.some(r => r.cert) ? `<div class="cert"><div class="eyebrow">수료</div><h2>전세 안전 수료</h2><p class="small">실전 모의고사 80점 이상 달성</p></div>` : ''}</div>`;
}
function remain() { const s = S.session; if (!s?.limit) return null; return Math.max(0, s.limit * 60 - Math.floor((Date.now() - s.start) / 1000)); }
const mmss = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
function vSession() {
  const s = S.session, q = qById[s.ids[s.i]], a = s.ans[q.id], answered = a != null, n = s.ids.length;
  const showNow = s.mode === 'now' && answered;
  const unanswered = s.ids.filter(id => s.ans[id] == null).length;
  const ox = q.type === 'OX';
  return `<div class="page"><div class="row" style="justify-content:space-between"><div><div class="eyebrow">${esc(s.title)}</div><b class="num">${s.i + 1} / ${n}</b></div>
    <div class="row">${s.limit ? `<span class="chip plain num" id="timer">${mmss(remain())}</span>` : ''}<button class="btn ghost" data-act="examQuit">그만두기</button></div></div>
  <div class="bar"><i style="width:${(s.i + 1) / n * 100}%"></i></div>
  <div class="card qcard"><div class="row"><span class="chip plain">${CAT[q.category]}</span><span class="chip plain">${q.type === 'CALC' ? '계산' : q.type === 'SCENARIO' ? '상황' : q.type === 'OX' ? 'OX' : '객관식'}</span>${'★'.repeat(q.difficulty) ? `<span class="small muted">${'★'.repeat(q.difficulty)}</span>` : ''}</div>
    <p class="qprompt">${esc(q.prompt)}</p>
    <div class="opts${ox ? ' ox' : ''}">${(s.perm?.[q.id] || q.options.map((_, i) => i)).map((i, pos) => { const o = q.options[i]; let cls = ''; if (showNow) cls = i === q.answer ? 'right' : i === a ? 'wrong' : ''; else if (a === i) cls = 'sel';
      return `<button class="opt ${cls}" data-act="answer" data-i="${i}" ${showNow ? 'disabled' : ''}>${ox ? '' : `<span class="k">${pos + 1}</span>`}<span>${esc(o)}</span></button>`; }).join('')}</div>
    ${showNow ? `<div class="callout ${a === q.answer ? 'green' : 'red'}"><b>${a === q.answer ? '정답이에요' : `정답은 ${q.options[q.answer]}`}</b><br>${esc(q.explanation)}${q.lessonId && lessonById[q.lessonId] ? ` <button class="btn ghost" data-act="lesson" data-id="${q.lessonId}">학습카드 보기</button>` : ''}${q.documentId ? ` <button class="btn ghost" data-act="doc" data-id="${q.documentId}">${esc(docById[q.documentId].name)}</button>` : ''}</div>` : ''}</div>
  <div class="row" style="justify-content:space-between"><button class="btn" data-act="qMove" data-d="-1" ${s.i === 0 ? 'disabled' : ''}>이전</button>
    ${s.i < n - 1 ? `<button class="btn primary" data-act="qMove" data-d="1">다음</button>` : `<button class="btn primary" data-act="submit">${S.submitWarn && unanswered ? `${unanswered}문항이 비어 있어요. 그래도 제출` : '제출하기'}</button>`}</div>
  ${s.mode === 'after' ? `<div class="row small muted">${s.ids.map((id, i) => `<button class="btn ghost small" style="padding:2px 6px;${i === s.i ? 'color:var(--stamp);font-weight:800' : s.ans[id] != null ? '' : 'color:var(--muted)'}" data-act="qJump" data-i="${i}">${i + 1}</button>`).join('')}</div>` : ''}</div>`;
}
function submitExam() {
  const s = S.session; const items = s.ids.map(id => ({ q: qById[id], a: s.ans[id] }));
  const correct = items.filter(x => x.a === x.q.answer).length; const score = Math.round(correct / items.length * 100);
  items.forEach(x => { if (x.a === x.q.answer) delete store.wrong[x.q.id]; else store.wrong[x.q.id] = (store.wrong[x.q.id] || 0) + 1; });
  const ex = examById[s.examId]; const pass = ex?.passScore ? score >= ex.passScore : null;
  const cert = !!(ex?.certificate && score >= ex.certificate.minScore);
  const d = new Date(); const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  if (!s.examId.startsWith('ids')) store.results.push({ examId: s.examId, title: s.title, score, correct, total: items.length, date, cert });
  store.results = store.results.slice(-50); save();
  S.result = { title: s.title, examId: s.examId, items, score, correct, pass, cert, mode: s.mode }; S.session = null; S.submitWarn = false;
}
function vResult() {
  const r = S.result; const cats = {};
  r.items.forEach(x => { const c = cats[x.q.category] ||= [0, 0]; c[1]++; if (x.a === x.q.answer) c[0]++; });
  const wrong = r.items.filter(x => x.a !== x.q.answer);
  const color = r.pass === false ? 'var(--stamp)' : r.score >= 80 ? 'var(--ok)' : 'var(--warn)';
  return `<div class="page"><div class="head"><div class="eyebrow">${esc(r.title)} 결과</div><h1>${r.correct} / ${r.items.length} 정답</h1></div>
  <div class="row" style="gap:20px"><div class="score-ring" style="--c:${color};--p:${r.score}" role="img" aria-label="${r.score}점"><span data-count="${r.score}">${r.score}</span></div>
    <div class="stack">${r.pass != null ? `<span class="chip ${r.pass ? 'green' : 'red'}">${r.pass ? '합격' : '불합격'}</span>` : ''}<div class="table-wrap"><table class="data"><tbody>${Object.entries(cats).map(([k, [a, b]]) => `<tr><th>${CAT[k]}</th><td class="num">${a}/${b}</td></tr>`).join('')}</tbody></table></div></div></div>
  ${r.cert ? `<div class="cert"><div class="eyebrow">전세지킴이</div><h2>전세 안전 수료</h2><p>${esc(r.title)} ${r.score}점으로 수료 기준을 넘었어요.</p></div>` : ''}
  ${wrong.length ? `<section class="stack"><h2>틀린 문제 다시 보기</h2>${wrong.map(x => `<div class="card stack"><p><b>${esc(x.q.prompt)}</b></p><p class="small">내 답: ${x.a == null ? '(빈칸)' : esc(x.q.options[x.a])} · 정답: <b>${esc(x.q.options[x.q.answer])}</b></p><p class="small muted">${esc(x.q.explanation)}</p>${x.q.lessonId ? `<div><button class="btn ghost" data-act="lesson" data-id="${x.q.lessonId}">학습카드</button></div>` : ''}</div>`).join('')}</section>` : '<div class="callout green">모두 맞혔어요!</div>'}
  <div class="row"><button class="btn primary" data-act="examStart" data-id="wrong" ${Object.keys(store.wrong).length ? '' : 'disabled'}>오답노트 풀기</button><button class="btn" data-act="examHome">시험 목록</button></div></div>`;
}

function vNews() {
  return `<div class="page"><div class="head"><div class="eyebrow">최신 제도 · ${esc(C.policy.baseDate)} 기준</div><h1>지금 바뀌고 있는 것들</h1><p>시행 중인지, 아직 추진 중인지 꼭 구분해서 보세요. 추진 중인 제도는 시행 전까지 현행법 기준으로 행동해야 해요.</p></div>
  ${C.policy.items.map(p => `<div class="card stack"><div class="row">${statusChip(p.status)}${p.checkAgain ? '<span class="chip plain">시행일 재확인 필요</span>' : ''}</div><h2>${esc(p.title)}</h2><p>${esc(p.summary)}</p>
    <div><div class="eyebrow">지금 할 일</div><ul class="clean ticks">${p.whatToDoNow.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>
    <p class="small muted">출처: ${p.sourceIds.map(id => srcById[id] ? `<a href="${esc(srcById[id].url)}" target="_blank" rel="noopener">${esc(srcById[id].publisher)}</a>` : '').join(' · ')}</p></div>`).join('')}
  <p class="small muted">${esc(C.meta.disclaimer)}</p></div>`;
}

/* ================= intro (랜딩) — 스크롤이 곧 재생 헤드: 장면(frame)마다 --p(0~1)로 움직임 ================= */
function vIntro() {
  return `<div class="intro">
  <header class="in-top"><div class="brand" data-act="introStart" role="button" tabindex="0" aria-label="홈으로"><span class="seal" aria-hidden="true">전</span><b>전세지킴이</b></div><span class="in-frame num" id="inFrame" aria-hidden="true">01 / 05</span><button class="in-skip" data-act="introStart">건너뛰기 →</button></header>

  <section class="fr fr1" data-fr="1"><div class="fr-stick">
    <p class="in-kicker"><span>전세사기 예방 교육</span><span class="num">${esc(C.meta.baseDate)} 기준</span></p>
    <h1 class="in-h"><span class="ln"><span>당신의 보증금,</span></span><span class="ln"><span>지금 안전한가요?</span></span></h1>
    <div class="in-money"><span class="num" data-count="200000000">200,000,000</span><span class="unit">원</span></div>
    <p class="in-sub">평생 모은 돈이 들어가는 계약이에요.<br>하루의 틈, 서류 한 장이 결과를 바꿔요.</p>
    <div class="in-hero-cta"><button class="btn in-go" data-act="introStart">바로 시작하기</button><span>또는 아래로 내려 5장면 보기</span></div>
    <div class="in-stamp" data-at="0.3" aria-hidden="true">확인<br>필요</div>
    <div class="in-cue" aria-hidden="true"><span>스크롤</span><i></i></div>
  </div></section>

  <section class="fr fr2" data-fr="2"><div class="fr-stick">
    <p class="in-label"><span class="num">02</span> 숫자</p>
    <div class="in-big"><small>약</small><span class="num" data-scrub="36950" data-a="0.05" data-b="0.55">0</span><small>건</small></div>
    <p class="in-line">2023년 6월부터 2026년 3월까지<br>전세사기 피해자 결정을 신청한 수예요.</p>
    <p class="in-note" data-at="0.55">처음 전세를 구하는 20~30대가 특히 많았어요.<br>'처음이라서', '몰라서' 놓친 경우가 많았어요.</p>
  </div></section>

  <section class="fr fr3" data-fr="3"><div class="fr-stick">
    <p class="in-label"><span class="num">03</span> 하루의 틈</p>
    <h2 class="in-h2">사기는 <em>단 하루</em>의 틈을 노려요</h2>
    <div class="tl">
      <div class="tl-track"><i class="tl-fill"></i></div>
      <div class="tl-pt first" style="--x:0%" data-at="0.08"><b>잔금·이사</b><span>D-DAY 오후</span></div>
      <div class="tl-pt mid" style="--x:30%" data-at="0.2"><b>전입신고</b><span>같은 날</span></div>
      <div class="tl-gap" data-at="0.36"><b>같은 날 집주인이 대출(근저당)을 등기하면</b><span>은행이 내 앞 순서가 돼요</span></div>
      <div class="tl-pt last" style="--x:100%" data-at="0.6"><b>다음 날 0시</b><span>내 권리(대항력) 시작</span></div>
    </div>
    <p class="in-fix" data-at="0.72"><span class="in-tag">막는 법</span>계약서 특약에 "잔금 다음 날까지 담보 설정 금지"를 적어요.</p>
  </div></section>

  <section class="fr fr4" data-fr="4"><div class="fr-stick">
    <p class="in-label"><span class="num">04</span> 깡통전세</p>
    <h2 class="in-h2">집값보다 빚이 많으면<br>보증금이 <em>비어요</em></h2>
    <div class="cans">
      <div class="can-col"><div class="bar-area"><div class="bar-v house" style="--h:87;--b:0"><span>집값 <b>2억</b></span></div></div><p>집을 팔면 나오는 돈</p></div>
      <div class="can-col"><div class="bar-area"><div class="bar-v loan" style="--h:21.7;--b:0"><span>대출 <b>5천만</b></span></div><div class="bar-v dep" style="--h:65.3;--b:21.7"><span>내 보증금 <b>1억 8천만</b></span></div><div class="bar-v over" style="--h:13;--b:87"></div></div><p>돌려받아야 할 돈</p></div>
      <div class="h-line" data-at="0.6"><span>집값 2억</span></div>
    </div>
    <p class="in-note" data-at="0.7"><b>3천만 원</b>은 돌려받지 못할 수 있어요.</p>
  </div></section>

  <section class="fr fr5" data-fr="5"><div class="fr-stick">
    <p class="in-label"><span class="num">05</span> 막는 법</p>
    <h2 class="in-h2">확인하면, <em>막을 수 있어요</em></h2>
    <ul class="in-checks">
      <li data-at="0.12"><i aria-hidden="true"></i><div><b>등기부등본, 계약 직전에 다시 떼기</b><span>새로 생긴 대출·압류가 없는지 봐요</span></div></li>
      <li data-at="0.32"><i aria-hidden="true"></i><div><b>특약 세 줄 넣기</b><span>담보 설정 금지 · 보증보험 안 되면 무효 · 세금 체납 시 해제</span></div></li>
      <li data-at="0.52"><i aria-hidden="true"></i><div><b>보증보험 되는지 먼저 묻기</b><span>안 되는 집은 위험한 집일 수 있어요</span></div></li>
    </ul>
  </div></section>

  <section class="in-cta">
    <span class="seal in-seal" aria-hidden="true">전</span>
    <h2>9단계, 한 단계씩 따라오면 돼요.</h2>
    <p>집 보러 가기 전부터 보증금 돌려받는 날까지.<br>서류 읽는 법, 특약 문구, 체크리스트, 모의고사를 한곳에 모았어요.</p>
    <button class="btn in-go" data-act="introStart">시작하기</button>
    <p class="in-disc">${esc(C.meta.disclaimer)}</p>
  </section>
  <div class="in-progress" aria-hidden="true"><i id="inProg"></i></div>
  </div>`;
}
function introFx() {
  if (S.route !== 'intro') return;
  const still = reduceMotion(); let cur = 1;
  document.querySelectorAll('[data-fr]').forEach(sec => {
    const r = sec.getBoundingClientRect(), span = r.height - innerHeight;
    // 동작 줄이기: 움직임 없이 '완성된 장면'으로 보여줌. 단, 첫 장면은 스크롤하면 흐려지는 장면이라 시작 상태(0)로 둔다
    const first = sec.dataset.fr === '1';
    const p = still ? (first ? 0 : 1) : Math.min(1, Math.max(0, -r.top / (span > 0 ? span : 1)));
    sec.style.setProperty('--p', p.toFixed(4));
    sec.style.setProperty('--k', Math.min(1, p / 0.6).toFixed(4));
    if (r.top <= innerHeight * 0.5) cur = +sec.dataset.fr;
    sec.querySelectorAll('[data-at]').forEach(el => el.classList.toggle('on', still || p >= +el.dataset.at));
    sec.querySelectorAll('[data-scrub]').forEach(el => { const t = Math.min(1, Math.max(0, (p - +el.dataset.a) / (+el.dataset.b - +el.dataset.a))); el.textContent = Math.round(+el.dataset.scrub * (1 - Math.pow(1 - t, 3))).toLocaleString('ko-KR'); });
  });
  const f = document.getElementById('inFrame'); if (f) f.textContent = `${String(cur).padStart(2, '0')} / 05`;
  const max = document.documentElement.scrollHeight - innerHeight, pg = document.getElementById('inProg');
  if (pg) pg.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
}

/* ================= 이용약관·면책 동의 ================= */
// 핵심 3줄을 먼저 보여주고, 조항 전문은 스크롤 상자에. 동의는 버튼 하나로
function vTerms() {
  const T = C.meta.terms;
  const full = `<div class="terms-box" tabindex="0" role="region" aria-label="${esc(T.title)} 전문">${T.items.map(i => `<section><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p></section>`).join('')}</div>`;
  if (termsOk && !S.termsNext) {
    let at = ''; try { at = JSON.parse(localStorage.getItem(TERMS_KEY) || 'null')?.at || ''; } catch (e) { /* ignore */ }
    return `<div class="page terms"><div class="head"><div class="eyebrow">${esc(T.version)} 시행</div><h1>${esc(T.title)}</h1>${at ? `<p><span class="chip green">동의함</span> <span class="num small">${esc(at)}</span></p>` : ''}</div>
    ${full}<p class="small muted">${esc(T.help)}</p>
    <div class="row"><button class="btn primary" data-act="nav" data-r="home">홈으로</button><button class="btn ghost" data-act="termsWithdraw">동의 철회</button></div></div>`;
  }
  return `<div class="page terms"><div class="head"><div class="eyebrow">이용약관 · ${esc(T.version)} 시행</div><h1>${esc(T.intro)}</h1></div>
  <ul class="terms-sum">${T.summary.map((s, i) => `<li><span class="n num">${i + 1}</span><span>${esc(s)}</span></li>`).join('')}</ul>
  <details class="more"><summary>${esc(T.title)} 전문 보기 (${T.items.length}개 조항)</summary>${full}</details>
  <button class="btn primary big agree-btn" data-act="termsAgree">${esc(T.agreeAll)}</button>
  <p class="small muted">${esc(T.help)}</p></div>`;
}

/* ================= sheet ================= */
function renderSheet() {
  const host = document.getElementById('sheet');
  const wasOpen = !!host.querySelector('.sheet');
  host.classList.remove('closing');
  document.documentElement.classList.toggle('sheet-open', !!S.sheet);
  if (!S.sheet) { host.innerHTML = ''; return; }
  let inner = '';
  if (S.sheet.type === 'term') { const t = termById[S.sheet.id]; inner = `<h2>${esc(t.term)}</h2><p><b>${esc(t.easy)}</b></p><p class="muted">${esc(t.detail)}</p>${t.example ? `<p class="small">예) ${esc(t.example)}</p>` : ''}`; }
  if (S.sheet.type === 'hs') inner = hotspotCard(S.sheet.h, S.tour ? `<div style="margin-top:6px">${tourControls(S._tourOrder || [], {})}</div>` : '');
  if (S.sheet.type === 'ck') { const ck = ckById[S.sheet.id]; inner = `<h2>${esc(ck.title)}</h2><ul class="clean ticks">${ck.items.map(i => `<li>${esc(i.text)}${i.required ? '' : ' <span class="chip plain">권장</span>'}</li>`).join('')}</ul><p class="small muted">내 계약 플래너에서 날짜를 넣으면 체크하며 관리할 수 있어요.</p><div><button class="btn primary" data-act="nav" data-r="my">플래너 열기</button></div>`; }
  host.innerHTML = `<div class="sheet-bg" data-act="sheetClose"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${inner}<button class="btn" data-act="sheetClose">닫기</button></div>`;
  host.classList.toggle('settled', wasOpen); // 열린 시트 내용만 바뀔 때는 다시 튀어나오지 않게
}
function closeSheet() {
  const host = document.getElementById('sheet');
  if (!S.sheet) return;
  S.sheet = null;
  if (reduceMotion() || !host.querySelector('.sheet')) { renderSheet(); return; }
  host.classList.add('closing');
  setTimeout(() => { if (!S.sheet) renderSheet(); }, 190);
}

/* ================= render ================= */
const VIEWS = { intro: vIntro, terms: vTerms, home: vHome, learn: vLearn, glossary: vGlossary, docs: vDocs, contract: vContract, my: vMy, insurance: vInsurance, exam: vExam, news: vNews };
let lastRoute = null, lastKey = null, lastQ = null;
// 화면이 '바뀌었을 때'만 등장 애니메이션 — 체크·입력으로 다시 그릴 때는 움직이지 않게
const viewKey = () => [S.route, S.stageId, S.lessonId, S.docId, S.docTab, S.docSample, S.sampleId, S.cmode, S.trap?.id, S.myTab, store.active, S.session ? 'exam' : '', S.result ? 'result' : ''].join('|');
function render(keepScroll) {
  S.route = routeFromHash();
  // 약관 동의 전에는 인트로·약관 화면만 — 가려던 곳은 기억해 두었다가 동의 후 보내줌
  if (!termsOk && S.route !== 'intro' && S.route !== 'terms') { S.termsNext = S.route; history.replaceState(null, '', '#terms'); S.route = 'terms'; }
  document.body.dataset.route = S.route;
  document.body.classList.toggle('bare', S.route === 'intro' || S.route === 'terms');
  const main = document.getElementById('main');
  const key = viewKey(), q = S.session ? S.session.i : null;
  const anim = key !== lastKey ? 'enter' : q != null && q !== lastQ ? 'enter-q' : '';
  lastKey = key; lastQ = q;
  main.classList.remove('enter', 'enter-q');
  main.innerHTML = VIEWS[S.route]();
  if (anim && !reduceMotion()) { void main.offsetWidth; main.classList.add(anim); if (anim === 'enter') countUp(main); }
  document.querySelectorAll('[data-act="nav"][data-r]').forEach(b => { if (b.closest('.nav, .tabbar')) b.setAttribute('aria-current', b.dataset.r === S.route ? 'page' : 'false'); });
  renderSheet();
  if (S.route !== lastRoute && !keepScroll) window.scrollTo(0, 0);
  lastRoute = S.route;
  const smooth = reduceMotion() ? 'auto' : 'smooth';
  if (S.calcFocus) { const el = document.getElementById(S.calcFocus); if (el) { el.scrollIntoView({ block: 'start', behavior: smooth }); el.classList.add('focus-flash'); } S.calcFocus = null; }
  if (S.tour && S.hsId) { const el = main.querySelector(`[data-id="${S.hsId}"]`); if (el) el.scrollIntoView({ block: 'center', behavior: smooth }); }
  if (S.fx) { const el = main.querySelector(S.fx.sel); (el?.closest('.check') || el)?.classList.add(S.fx.cls); S.fx = null; }
  revealOnScroll(main, anim === 'enter');
  readProgress();
  introFx();
  fitPapers();
}
// 스크롤로 화면에 들어올 때 등장(형광펜·도장 포함). 같은 화면을 다시 그릴 때는 바로 보이게
let io = null;
function revealOnScroll(root, fresh) {
  io?.disconnect();
  const els = root.querySelectorAll('[data-io]');
  if (!fresh || reduceMotion() || !('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
  io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  els.forEach(el => io.observe(el));
}
// 학습카드 읽기 진행바
function readProgress() {
  const bar = document.getElementById('readbar');
  const on = S.route === 'learn' && !!S.lessonId;
  bar.classList.toggle('on', on);
  if (!on) return;
  const max = document.documentElement.scrollHeight - innerHeight;
  bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 1})`;
}
let rpTick = false;
window.addEventListener('scroll', () => { if (rpTick) return; rpTick = true; requestAnimationFrame(() => { rpTick = false; readProgress(); introFx(); }); }, { passive: true });
window.addEventListener('resize', () => { introFx(); fitPapers(); });
matchMedia('(max-width: 860px)').addEventListener('change', () => fitPapers()); // 회전·창 크기 변경으로 휴대폰↔PC 기준이 바뀔 때

function showHotspot(id) {
  let h = null;
  if (S.route === 'docs' && S.docId) h = by(docById[S.docId].hotspots)[id];
  else if (S.route === 'contract') h = by((sampleById[S.sampleId] || samples[0]).hotspots)[id];
  h = h || allHotspots[id];
  S.hsId = id;
  S.sheet = narrow() && h ? { type: 'hs', h } : null;
  render(true);
}

/* ================= actions ================= */
const A = {
  nav: el => go(el.dataset.r, el.dataset.r === 'learn' ? { stageId: null, lessonId: null } : el.dataset.r === 'docs' ? { docId: null } : el.dataset.r === 'exam' ? { result: S.session ? null : S.result } : {}),
  stage: el => go('learn', { stageId: el.dataset.id, lessonId: null }),
  learnHome: () => go('learn', { stageId: null, lessonId: null }),
  lesson: el => go('learn', { lessonId: el.dataset.id, stageId: lessonById[el.dataset.id].stageId, sheet: null }),
  term: el => { S.sheet = { type: 'term', id: el.dataset.id }; renderSheet(); },
  cksheet: el => { S.sheet = { type: 'ck', id: el.dataset.id }; renderSheet(); },
  sheetClose: () => closeSheet(),
  paperMode: el => { S.paperMode = el.dataset.m; render(true); },
  introStart: () => go(termsOk ? 'home' : 'terms'),
  termsAgree: () => {
    const d = new Date(), at = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    try { localStorage.setItem(TERMS_KEY, JSON.stringify({ v: C.meta.terms.version, at })); } catch (e) { /* 저장이 막혀도 이번 방문 동안은 진행 */ }
    termsOk = true; const next = S.termsNext && S.termsNext !== 'terms' ? S.termsNext : 'home'; S.termsNext = null;
    go(next); toast('동의했어요. 시작해 볼까요?');
  },
  termsWithdraw: () => { try { localStorage.removeItem(TERMS_KEY); } catch (e) { /* ignore */ } termsOk = false; go('intro'); toast('동의를 철회했어요'); },
  theme: () => { const order = ['', 'light', 'dark']; theme = order[(order.indexOf(theme) + 1) % 3]; try { localStorage.setItem('jeonse-theme', theme); } catch (e) { /* ignore */ } applyTheme(true); },
  hl: el => { const id = S.lessonId, i = +el.dataset.i; const arr = (store.hl[id] ||= []); const k = arr.indexOf(i); if (k >= 0) arr.splice(k, 1); else arr.push(i); if (!arr.length) delete store.hl[id]; save(); el.classList.toggle('mine', k < 0); el.setAttribute('aria-pressed', String(k < 0)); if (k < 0) toast('밑줄 노트에 담았어요'); },
  lqAnswer: el => { S.lq.a = +el.dataset.i; const q = qById[S.lq.id]; if (S.lq.a !== q.answer) store.wrong[q.id] = (store.wrong[q.id] || 0) + 1; save(); render(true); },
  lqNext: () => { S.lq = pickLessonQ(S.lessonId, S.lq?.id); render(true); },
  doc: el => go('docs', { docId: el.dataset.id, docTab: el.dataset.t || 'guide', docSample: 0, hsId: null, tour: null, sheet: null }),
  docsHome: () => go('docs', { docId: null, hsId: null, tour: null }),
  docTab: el => { S.docTab = el.dataset.t; S.hsId = null; S.tour = null; render(true); },
  docSample: el => { S.docSample = +el.dataset.i; S.hsId = null; S.tour = null; render(true); },
  hs: el => showHotspot(el.dataset.id),
  hsSheet: el => { const h = allHotspots[el.dataset.id]; if (h) { S.sheet = { type: 'hs', h }; renderSheet(); } },
  tourStart: () => { const o = S._tourOrder || []; if (!o.length) return; S.tour = { i: 0 }; showHotspot(o[0]); },
  tourMove: el => { const o = S._tourOrder || []; const i = S.tour.i + +el.dataset.d; if (i >= o.length) { S.tour = null; S.hsId = null; S.sheet = null; render(true); toast('투어를 마쳤어요'); return; } S.tour.i = Math.max(0, i); showHotspot(o[S.tour.i]); },
  tourEnd: () => { S.tour = null; S.hsId = null; S.sheet = null; render(true); },
  sample: el => go('contract', { sampleId: el.dataset.id, hsId: null, tour: null, trap: null, cmode: el.dataset.mode || (S.cmode === 'trap' ? 'trap' : 'read'), sheet: null }),
  cmode: el => { S.cmode = el.dataset.m; S.hsId = null; S.trap = null; S.tour = el.dataset.m === 'tour' ? null : null; render(true); if (S.cmode === 'tour') A.tourStart(); },
  trapPick: el => { S.trap = { id: el.dataset.id, found: [], wrong: 0, revealed: false }; render(true); },
  trapTap: el => {
    const t = C.contracts.trapExercises.find(x => x.id === S.trap.id); const k = el.dataset.key;
    if (t.overrides.some(o => o.fieldKey === k)) { if (!S.trap.found.includes(k)) { S.trap.found.push(k); toast('찾았어요!'); } }
    else { S.trap.wrong++; el.classList.add('trap-miss'); setTimeout(() => render(true), 300); return; }
    render(true);
  },
  trapReveal: () => { S.trap.revealed = !S.trap.revealed; render(true); },
  trapReset: () => { S.trap = { id: S.trap.id, found: [], wrong: 0, revealed: false }; render(true); },
  calc: el => go('insurance', { calcFocus: el.dataset.id, sheet: null }),
  clauses: () => go('my', { myTab: activeContract() ? 'clauses' : 'library' }),
  myTab: el => { S.myTab = el.dataset.t; S.confirmDel = false; render(true); },
  cNew: () => { const c = newContract(); store.contracts.push(c); store.active = c.id; save(); S.myTab = 'info'; S.confirmDel = false; render(true); },
  cExample: () => { const c = exampleContract(); store.contracts.push(c); store.active = c.id; save(); S.myTab = 'plan'; render(true); },
  cDel: () => { S.confirmDel = true; render(true); },
  cDelNo: () => { S.confirmDel = false; render(true); },
  cDelYes: () => { const c = activeContract(); store.contracts = store.contracts.filter(x => x.id !== c.id); delete store.checks[c.id]; delete store.clauseSel[c.id]; store.active = store.contracts[0]?.id || null; save(); S.confirmDel = false; render(true); toast('지웠어요'); },
  evToggle: el => { const c = activeContract(); const e = buildEvents(c).find(x => x.id === el.dataset.id); const n = ddays(e.date); const cur = S.openEv[e.id] ?? (n >= 0 && n <= 7 && !!e.ck); S.openEv[e.id] = !cur; if (!cur) S.fx = { sel: `[data-evbody="${e.id}"]`, cls: 'reveal' }; render(true); },
  copyOut: () => { const t = document.getElementById('clOut'); copyText(t.value, '#clOut'); },
  copyBk: () => { const t = document.getElementById('bkOut'); copyText(t.value, '#bkOut'); },
  importBk: () => {
    const raw = document.getElementById('bkIn').value.trim();
    try { const d = JSON.parse(raw); if (!Array.isArray(d.contracts)) throw new Error('형식'); store.contracts = d.contracts; store.checks = d.checks || {}; store.clauseSel = d.clauseSel || {}; store.active = store.contracts[0]?.id || null; save(); S.importMsg = `계약 ${d.contracts.length}건을 불러왔어요.`; }
    catch (e) { S.importMsg = '불러오지 못했어요. 백업에서 복사한 글 전체를 그대로 붙여넣었는지 확인하세요.'; }
    render(true);
  },
  examStart: el => { const id = el.dataset.id; startExam(id, { stage: el.dataset.stage }); },
  quizIds: el => { S.sheet = null; startExam('ids', { ids: el.dataset.ids.split(','), title: '관련 문제' }); },
  quizDoc: el => startExam('ids', { ids: qs.filter(q => q.documentId === el.dataset.id).map(q => q.id), title: `${docById[el.dataset.id].name} 문제` }),
  answer: el => { const s = S.session; const q = s.ids[s.i]; if (s.mode === 'now' && s.ans[q] != null) return; s.ans[q] = +el.dataset.i; S.submitWarn = false; render(true); },
  qMove: el => { const s = S.session; s.i = Math.min(s.ids.length - 1, Math.max(0, s.i + +el.dataset.d)); render(true); },
  qJump: el => { S.session.i = +el.dataset.i; render(true); },
  submit: () => { const s = S.session; const un = s.ids.filter(id => s.ans[id] == null).length; if (un && !S.submitWarn) { S.submitWarn = true; render(true); return; } submitExam(); render(); window.scrollTo(0, 0); },
  examQuit: () => { S.session = null; render(true); },
  examHome: () => { S.result = null; render(true); },
};
const CHANGE = {
  ckItem: el => {
    const c = activeContract(); (store.checks[c.id] ||= {})[el.dataset.id] = el.checked; save();
    if (el.checked) S.fx = { sel: `[data-act="ckItem"][data-id="${el.dataset.id}"]`, cls: 'pop' };
    render(true);
    const ck = C.checklists.checklists.find(x => x.items.some(i => i.id === el.dataset.id));
    if (el.checked && ck) { const req = ckItems(c, ck.id).filter(i => i.required); if (req.length && req.every(i => store.checks[c.id][i.id])) toast(`'${ck.title}' 필수 항목을 모두 확인했어요`); }
  },
  evCheck: el => { const c = activeContract(); (store.checks[c.id] ||= {})['ev:' + el.dataset.id] = el.checked; save(); if (el.checked) S.fx = { sel: `[data-act="evCheck"][data-id="${el.dataset.id}"]`, cls: 'pop' }; render(true); },
  flag: el => { const c = activeContract(); c.flags[el.dataset.k] = el.checked; save(); render(true); },
  clOn: el => { const c = activeContract(); const m = (store.clauseSel[c.id] ||= {}); m[el.dataset.id] = { ...(m[el.dataset.id] || {}), on: el.checked }; save(); render(true); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (el.tagName === 'INPUT') return; // handled by change
  if (A[act]) { e.preventDefault(); A[act](el, e); }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Escape' && S.sheet) closeSheet();
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.act && CHANGE[el.dataset.act]) return CHANGE[el.dataset.act](el);
  const b = el.dataset.bind;
  if (b === 'active') { store.active = el.value; save(); S.confirmDel = false; render(true); }
  if (b === 'c') { const c = activeContract(); c[el.dataset.k] = el.value; if (el.dataset.k !== 'name') delete c.example; save(); render(true); }
  if (b === 'clText') { const c = activeContract(); const m = (store.clauseSel[c.id] ||= {}); m[el.dataset.id] = { ...(m[el.dataset.id] || {}), text: el.value }; save(); render(true); }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.bind === 'gq') { S.gq = el.value; const pos = el.selectionStart; render(true); const n = document.getElementById('gq'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) { /* ignore */ } }
  if (el.dataset.calc) { const k = 'calc_' + el.dataset.calc; (S[k] ||= {})[el.dataset.k] = el.value; updateCalc(calcById[el.dataset.calc]); }
});
window.addEventListener('hashchange', () => { S.sheet = null; render(); });
window.addEventListener('resize', () => { if (!narrow() && S.sheet?.type === 'hs') { S.sheet = null; render(true); } });
setInterval(() => { if (!S.session?.limit) return; const t = remain(); const el = document.getElementById('timer'); if (el) el.textContent = mmss(t); if (t <= 0) { submitExam(); render(); toast('시간이 끝나 자동 제출했어요'); } }, 1000);

/* ================= shell ================= */
document.getElementById('nav').innerHTML = NAV.map(([r, t]) => `<button data-act="nav" data-r="${r}">${icon(r)}<span>${t}</span></button>`).join('');
document.getElementById('tabbar').innerHTML = TABS.map(([r, t]) => `<button data-act="nav" data-r="${r}">${icon(r)}<span>${t}</span></button>`).join('');
document.getElementById('more').innerHTML = NAV.filter(([r]) => !TABS.some(t => t[0] === r)).map(([r, t]) => `<button class="chip plain" data-act="nav" data-r="${r}" style="cursor:pointer">${t}</button>`).join('');
document.getElementById('foot').textContent = `콘텐츠 기준일 ${C.meta.baseDate} · v${C.meta.contentVersion}`;
document.querySelectorAll('.rail .brand, .mobile-top .brand').forEach(b => { b.dataset.act = 'nav'; b.dataset.r = 'home'; b.setAttribute('role', 'button'); b.tabIndex = 0; b.setAttribute('aria-label', '홈으로'); });
document.querySelector('.rail-foot').insertAdjacentHTML('beforeend', '<button class="btn ghost small" data-act="nav" data-r="terms" style="padding:0">이용약관·면책 고지</button>');
if (PREVIEW) termsOk = true;
applyTheme(false);
render();
})();
