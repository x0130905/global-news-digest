const state = { latest: null, current: null, archiveIndex: [], items: [], filter: 'all', query: '', history: false, visible: 12, userLabels: {} };
const $ = (selector) => document.querySelector(selector);
const fmtDate = (value, options = {}) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', ...options }).format(new Date(value));
const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (value) => { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } };
const hasChinese = (value = '') => /[\u3400-\u9fff]/.test(value);

const LABEL_STORAGE_KEY = 'global-pulse-article-labels-v1';
const LABEL_TYPES = {
  red: { name: '重点', fullName: '红色 · 重点' },
  blue: { name: '跟进', fullName: '蓝色 · 跟进' },
  green: { name: '已读', fullName: '绿色 · 已读' }
};
function articleKey(item) { return String(item.id || item.url || item.title || ''); }
function loadUserLabels() {
  try {
    const saved = JSON.parse(localStorage.getItem(LABEL_STORAGE_KEY) || '{}');
    return Object.fromEntries(Object.entries(saved).filter(([key, color]) => key && LABEL_TYPES[color]));
  } catch { return {}; }
}
function saveUserLabels() {
  try { localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(state.userLabels)); } catch { /* 浏览器禁用本地存储时仍可临时使用 */ }
}
function setUserLabel(itemId, color) {
  if (!itemId || !LABEL_TYPES[color]) return;
  if (state.userLabels[itemId] === color) delete state.userLabels[itemId];
  else state.userLabels[itemId] = color;
  saveUserLabels();
  render();
}
state.userLabels = loadUserLabels();

function searchable(item) {
  const userLabel = LABEL_TYPES[state.userLabels[articleKey(item)]];
  return [item.titleZh, item.title, item.summaryZh, item.summary, item.whyImportant, item.source, ...(item.tags || []), item.topicName, userLabel?.fullName, ...(item.crossSources || []).map((source) => source.source)].join(' ').toLowerCase();
}
function getItems() {
  let items = [...state.items];
  if (state.filter === 'featured') items = items.filter((item) => item.topicMatch);
  else if (state.filter.startsWith('label:')) items = items.filter((item) => state.userLabels[articleKey(item)] === state.filter.slice(6));
  else if (state.filter !== 'all') items = items.filter((item) => (item.tags || []).some((tag) => tag.includes(state.filter)));
  if (state.query) items = items.filter((item) => searchable(item).includes(state.query));
  return items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function sources(item) {
  const list = [{ source: item.source || '未知来源', url: item.url }, ...(item.crossSources || [])];
  const seen = new Set(); const unique = list.filter((source) => { const key = safeUrl(source.url); if (key === '#' || seen.has(key)) return false; seen.add(key); return true; }).slice(0, 4);
  return `<div class="sources-panel"><strong>新闻来源</strong><div>${unique.map((source, index) => `<a class="source-chip ${index === 0 ? 'primary' : ''}" href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.source || '原始来源')} ↗</a>`).join('') || '<span class="source-chip">来源链接暂不可用</span>'}</div></div>`;
}

function labelControls(item) {
  const itemId = articleKey(item);
  const activeColor = state.userLabels[itemId];
  const buttons = Object.entries(LABEL_TYPES).map(([color, label]) => `<button type="button" class="label-button label-${color} ${activeColor === color ? 'active' : ''}" data-label-action="${color}" data-article-id="${esc(itemId)}" aria-pressed="${activeColor === color}" title="${activeColor === color ? `取消${label.fullName}标签` : `添加${label.fullName}标签`}"><i aria-hidden="true"></i>${esc(label.name)}</button>`).join('');
  return `<div class="article-labels" role="group" aria-label="文章颜色分类标签"><span>分类标签</span>${buttons}</div>`;
}

function card(item) {
  const tags = (item.tags || []).slice(0, 3).map((tag) => `<span class="tag ${tag.includes('中国') ? 'china' : tag.includes('美国') ? 'usa' : ''}">${esc(tag.replace(/^专题·/, '专题 · '))}</span>`).join('');
  const time = fmtDate(item.publishedAt, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const isEnglish = /[a-z]{3}/i.test(item.title || '') && !hasChinese(item.title || '');
  const translated = item.translationStatus === 'translated' || (hasChinese(`${item.titleZh || ''}${item.summaryZh || ''}`) && item.translationStatus !== 'unavailable');
  const accent = state.current?.topic?.accent || '#8b5cf6';
  const meta = `<div class="card-meta"><div class="meta-main"><div class="tags">${tags}</div><a class="card-source" href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">来源 · ${esc(item.source || '未知来源')}</a></div><span class="score">热度 ${Number(item.score) || 0}</span></div>`;
  const footer = `${sources(item)}<div class="source-row"><span>发布时间 · ${esc(time)}</span><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer" aria-label="阅读原文：${esc(item.title || item.titleZh)}">打开原文 ↗</a></div>`;
  if (isEnglish) return `<article class="card bilingual ${item.topicMatch ? 'featured' : ''}" style="--topic-color:${esc(accent)}">${meta}<div class="bilingual-grid"><section class="language-panel original" lang="en"><span class="language-label">EN · ORIGINAL</span><h3><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h3><p class="summary">${esc(item.summary || 'No public summary available.')}</p></section><section class="language-panel translation" lang="zh-CN"><span class="language-label">中 · ${translated ? '中文翻译' : '等待可靠翻译'}</span><h3>${esc(item.titleZh || '中文翻译待生成')}</h3><p class="summary">${esc(item.summaryZh || '暂时没有可靠的中文译文。')}</p><p class="why"><strong>为什么重要：</strong>${esc(item.whyImportant || '值得继续关注后续发展。')}</p></section></div>${labelControls(item)}${footer}</article>`;
  return `<article class="card ${item.topicMatch ? 'featured' : ''}" style="--topic-color:${esc(accent)}">${meta}<h3><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.titleZh || item.title)}</a></h3><p class="summary">${esc(item.summaryZh || item.summary || '暂无公开摘要')}</p><p class="why"><strong>为什么重要：</strong>${esc(item.whyImportant || '值得继续关注后续发展。')}</p>${labelControls(item)}${footer}</article>`;
}

function render() {
  const all = getItems(), shown = all.slice(0, state.visible);
  $('#result-count').textContent = `${all.length} 条结果`;
  const colorTitle = state.filter.startsWith('label:') ? LABEL_TYPES[state.filter.slice(6)]?.fullName : '';
  $('#result-title').textContent = state.history ? `${state.current.date} 新闻` : state.filter === 'featured' ? '今日专题报道' : colorTitle || (state.query ? '搜索结果' : '最新动态');
  $('#result-kicker').textContent = state.history ? 'PERMANENT ARCHIVE · 永久档案' : 'LATEST INTELLIGENCE';
  $('#news-grid').innerHTML = shown.map(card).join('') || '<div class="empty">这一天没有找到匹配内容。试试更短的关键词或切换筛选条件。</div>';
  $('#status').hidden = true; $('#load-more').hidden = shown.length >= all.length;
}

function applyReport(report, history = false) {
  if (report.metadata?.sampleData) throw new Error('检测到演示数据，已阻止展示');
  state.current = report; state.items = report.items || []; state.history = history; state.visible = 12;
  $('#report-date').textContent = `${report.date} · 北京时间 · 过去 24 小时`;
  $('#overview').textContent = report.overview;
  $('#topic-title').textContent = report.topic?.name || '全球焦点'; $('#sticky-topic-name').textContent = report.topic?.name || '全球焦点';
  $('#topic-description').textContent = report.topic?.description || '';
  $('#topic-banner').style.setProperty('--topic', report.topic?.accent || '#8b5cf6');
  $('#featured-count').textContent = report.featured?.length ?? state.items.filter((item) => item.topicMatch).length;
  $('#updated-at').textContent = `最近更新：${fmtDate(report.generatedAt, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
  $('#date-picker').value = report.date; $('#history-toggle').hidden = !history;
  render();
}

async function loadDate(date) {
  $('#status').hidden = false; $('#status').className = 'status'; $('#status').textContent = `正在载入 ${date} 的新闻…`;
  try {
    if (date === state.latest.date) { applyReport(state.latest, false); return; }
    if (!state.archiveIndex.some((entry) => entry.date === date)) throw new Error('所选日期尚无新闻档案');
    const response = await fetch(`data/archive/${encodeURIComponent(date)}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error('该日期档案暂时无法读取');
    applyReport(await response.json(), true);
  } catch (error) { $('#status').hidden = false; $('#status').className = 'status error'; $('#status').textContent = error.message; $('#date-picker').value = state.current?.date || state.latest.date; }
}

async function load() {
  try {
    const [latestResponse, indexResponse] = await Promise.all([fetch('data/latest.json', { cache: 'no-store' }), fetch('data/archive/index.json', { cache: 'no-store' })]);
    if (!latestResponse.ok) throw new Error('暂无日报数据');
    state.latest = await latestResponse.json(); state.archiveIndex = indexResponse.ok ? await indexResponse.json() : [{ date: state.latest.date }];
    const dates = state.archiveIndex.map((entry) => entry.date).filter(Boolean).sort();
    $('#date-picker').max = state.latest.date; if (dates.length) $('#date-picker').min = dates[0];
    $('#archive-count').textContent = `永久档案 · 已收录 ${dates.length} 天`;
    applyReport(state.latest, false);
  } catch (error) { $('#status').className = 'status error'; $('#status').textContent = `数据载入失败：${error.message}。请稍后刷新。`; }
}

$('#search').addEventListener('input', (event) => { state.query = event.target.value.trim().toLowerCase(); state.visible = 12; render(); });
$('#filter-list').addEventListener('click', (event) => { const button = event.target.closest('button[data-filter]'); if (!button) return; document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item === button)); state.filter = button.dataset.filter; state.visible = 12; render(); });
$('#news-grid').addEventListener('click', (event) => { const button = event.target.closest('button[data-label-action]'); if (!button) return; setUserLabel(button.dataset.articleId, button.dataset.labelAction); });
$('#date-picker').addEventListener('change', (event) => { if (event.target.value) loadDate(event.target.value); });
$('#history-toggle').addEventListener('click', () => loadDate(state.latest.date));
$('#load-more').addEventListener('click', () => { state.visible += 12; render(); });
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#search').focus(); } });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
load();
