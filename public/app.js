const state = { latest: null, archive: [], items: [], filter: 'all', query: '', history: false, visible: 12 };
const $ = (selector) => document.querySelector(selector);
const fmtDate = (value, options = {}) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', ...options }).format(new Date(value));
const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (value) => { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } };

function searchable(item) { return [item.titleZh, item.title, item.summaryZh, item.whyImportant, item.source, ...(item.tags || []), item.topicName].join(' ').toLowerCase(); }
const hasChinese = (value = '') => /[\u3400-\u9fff]/.test(value);
function getItems() {
  let items = state.history ? state.archive.flatMap((day) => day.items.map((item) => ({ ...item, archiveDate: day.date, topicName: day.topic?.name || item.topicName }))) : state.items;
  const seen = new Set(); items = items.filter((item) => { const key = `${item.archiveDate || state.latest.date}:${item.id}`; if (seen.has(key)) return false; seen.add(key); return true; });
  if (state.filter === 'featured') items = items.filter((item) => item.topicMatch);
  else if (state.filter !== 'all') items = items.filter((item) => (item.tags || []).some((tag) => tag.includes(state.filter)));
  if (state.query) items = items.filter((item) => searchable(item).includes(state.query));
  return items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function card(item) {
  const tags = (item.tags || []).slice(0, 3).map((tag) => `<span class="tag ${tag.includes('中国') ? 'china' : tag.includes('美国') ? 'usa' : ''}">${esc(tag.replace(/^专题·/, '专题 · '))}</span>`).join('');
  const time = fmtDate(item.publishedAt, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const isEnglish = /[a-z]{3}/i.test(item.title || '') && !hasChinese(item.title || '');
  const translated = item.translationStatus === 'translated' || (hasChinese(`${item.titleZh || ''}${item.summaryZh || ''}`) && item.translationStatus !== 'unavailable');
  const meta = `<div class="card-meta"><div class="tags">${tags}</div><span class="score">热度 ${Number(item.score) || 0}</span></div>`;
  const source = `<div class="source-row"><span>${esc(item.source || '未知来源')} · ${esc(time)}</span><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer" aria-label="阅读原文：${esc(item.title || item.titleZh)}">原文 ↗</a></div>`;
  if (isEnglish) return `<article class="card bilingual ${item.topicMatch ? 'featured' : ''}" style="--topic-color:${esc(state.latest.topic?.accent || '#8b5cf6')}">${meta}<div class="bilingual-grid"><section class="language-panel original" lang="en"><span class="language-label">EN · ORIGINAL</span><h3><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h3><p class="summary">${esc(item.summary || 'No public summary available.')}</p></section><section class="language-panel translation" lang="zh-CN"><span class="language-label">中 · ${translated ? '中文翻译' : '等待可靠翻译'}</span><h3>${esc(item.titleZh || '中文翻译待生成')}</h3><p class="summary">${esc(item.summaryZh || '暂时没有可靠的中文译文。')}</p><p class="why"><strong>为什么重要：</strong>${esc(item.whyImportant || '值得继续关注后续发展。')}</p></section></div>${source}</article>`;
  return `<article class="card ${item.topicMatch ? 'featured' : ''}" style="--topic-color:${esc(state.latest.topic?.accent || '#8b5cf6')}">${meta}<h3><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.titleZh || item.title)}</a></h3><p class="summary">${esc(item.summaryZh || item.summary || '暂无公开摘要')}</p><p class="why"><strong>为什么重要：</strong>${esc(item.whyImportant || '值得继续关注后续发展。')}</p>${source}</article>`;
}

function render() {
  const all = getItems(), shown = all.slice(0, state.visible); let previousDate = '';
  $('#result-count').textContent = `${all.length} 条结果`;
  $('#result-title').textContent = state.history ? '30 天新闻档案' : state.filter === 'featured' ? '今日专题报道' : state.query ? '搜索结果' : '最新动态';
  $('#result-kicker').textContent = state.history ? 'ARCHIVE · 近 30 天' : 'LATEST INTELLIGENCE';
  $('#news-grid').innerHTML = shown.map((item) => { const date = item.archiveDate || ''; const divider = state.history && date !== previousDate ? `<div class="date-divider">${esc(date)} · ${esc(item.topicName || '每日专题')}</div>` : ''; previousDate = date; return divider + card(item); }).join('') || '<div class="empty">没有找到匹配内容。试试更短的关键词或切换筛选条件。</div>';
  $('#status').hidden = true; $('#load-more').hidden = shown.length >= all.length;
}

async function load() {
  try {
    const [latestResponse, archiveResponse] = await Promise.all([fetch('data/latest.json', { cache: 'no-store' }), fetch('data/archive.json', { cache: 'no-store' })]);
    if (!latestResponse.ok) throw new Error('暂无日报数据');
    state.latest = await latestResponse.json(); state.archive = archiveResponse.ok ? await archiveResponse.json() : []; state.items = state.latest.items || [];
    if (state.latest.metadata?.sampleData) throw new Error('检测到演示数据，已阻止展示');
    $('#report-date').textContent = `${state.latest.date} · 北京时间 · 过去 24 小时`;
    $('#overview').textContent = state.latest.overview;
    $('#topic-title').textContent = state.latest.topic?.name || '全球焦点'; $('#topic-description').textContent = state.latest.topic?.description || '';
    $('#topic-banner').style.setProperty('--topic', state.latest.topic?.accent || '#8b5cf6'); $('#featured-count').textContent = state.latest.featured?.length || 0;
    $('#updated-at').textContent = `最近更新：${fmtDate(state.latest.generatedAt, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
    render();
  } catch (error) { $('#status').className = 'status error'; $('#status').textContent = `数据载入失败：${error.message}。请稍后刷新。`; }
}

$('#search').addEventListener('input', (event) => { state.query = event.target.value.trim().toLowerCase(); state.visible = 12; render(); });
$('#filter-list').addEventListener('click', (event) => { const button = event.target.closest('button[data-filter]'); if (!button) return; document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item === button)); state.filter = button.dataset.filter; state.visible = 12; render(); });
$('#history-toggle').addEventListener('click', (event) => { state.history = !state.history; event.currentTarget.setAttribute('aria-pressed', String(state.history)); event.currentTarget.textContent = state.history ? '返回今日' : '查看 30 天历史'; state.visible = 12; render(); });
$('#load-more').addEventListener('click', () => { state.visible += 12; render(); });
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#search').focus(); } });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
load();
