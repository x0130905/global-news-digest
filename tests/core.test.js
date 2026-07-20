import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeArticle } from '../src/processing/normalize.js';
import { deduplicate } from '../src/processing/deduplicate.js';
import { classify } from '../src/processing/classify.js';
import { scoreArticle } from '../src/processing/score.js';
import { applyHistory, isLocked, markSent } from '../src/processing/history.js';
import { summarizeArticle } from '../src/summarizers/aiSummarizer.js';
import { renderHtml } from '../src/email/renderHtml.js';
import keywords from '../config/keywords.json' with { type: 'json' };

test('RSS 与 GDELT 字段可标准化且危险 URL 被拒绝', () => {
  const rss = normalizeArticle({ title: '<b>World update</b>', link: 'https://news.example/a', pubDate: '2026-01-01T00:00:00Z', contentSnippet: 'Summary' }, 'RSS');
  const gdelt = normalizeArticle({ title: 'GDELT update', url: 'https://example.org/b', seendate: '20260101T010000Z', domain: 'example.org' }, 'GDELT');
  assert.equal(rss.title, 'World update'); assert.equal(rss.source, 'RSS'); assert.equal(gdelt.source, 'example.org'); assert.equal(gdelt.publishedAt, '2026-01-01T01:00:00.000Z');
  assert.equal(normalizeArticle({ title: 'Bad', url: 'javascript:alert(1)' }), null);
  assert.equal(normalizeArticle({ title: 'No date', url: 'https://example.com/no-date' }), null);
});

test('相似报道合并并保留交叉来源', () => {
  const articles = [
    { id: 'a', title: 'Major earthquake hits coastal region today', url: 'https://a.example/1', source: 'A', publishedAt: '2026-01-01T01:00:00Z', summary: 'one' },
    { id: 'b', title: 'Major earthquake hits coastal region', url: 'https://b.example/2', source: 'B', publishedAt: '2026-01-01T02:00:00Z', summary: 'two' }
  ];
  const result = deduplicate(articles, 0.4); assert.equal(result.length, 1); assert.equal(result[0].sourceCount, 2); assert.equal(result[0].crossSources.length, 2);
});

test('正确识别中国、美国及多重分类', () => {
  const both = classify({ title: 'China and United States discuss trade security', summary: '' }, keywords);
  assert.equal(both.isChina, true); assert.equal(both.isUsa, true); assert.ok(both.tags.includes('中国重点')); assert.ok(both.tags.includes('美国重点')); assert.ok(both.tags.includes('经济'));
});

test('热点评分在 0-100 且突发多源重大新闻高于噪声', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  const hot = scoreArticle({ source: 'Trusted', publishedAt: now.toISOString(), sourceCount: 4, tags: ['突发', '军事与安全', '外交'], isChina: true, isUsa: true, isNoise: false }, { Trusted: 0.95 }, now);
  const noise = scoreArticle({ source: 'Other', publishedAt: new Date(now - 23 * 3600_000), sourceCount: 1, tags: [], isNoise: true }, { default: 0.5 }, now);
  assert.ok(hot.score <= 100 && hot.score >= 80); assert.ok(noise.score >= 0 && hot.score > noise.score);
});

test('AI 接口失败后自动降级到规则摘要', async () => {
  const config = { timeoutMs: 10, ai: { provider: 'gemini', geminiKey: 'fake', groqKey: '' } };
  const article = { title: 'Test event', summary: 'Confirmed public summary.', source: 'Source', publishedAt: new Date().toISOString(), tags: [], isChina: false, isUsa: false };
  const result = await summarizeArticle(article, config, { gemini: async () => { throw new Error('offline'); } });
  assert.equal(result.summaryMode, 'rule'); assert.equal(result.translationStatus, 'unavailable'); assert.match(result.summaryZh, /中文译文/);
});

test('Gemini 使用当前模型和请求头生成中文译文', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.match(String(url), /gemini-3\.5-flash:generateContent$/); assert.equal(options.headers['x-goog-api-key'], 'fake-key');
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ titleZh: '中文标题', summaryZh: '这是忠实的中文摘要。', whyImportant: '这件事值得关注。' }) }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const config = { timeoutMs: 1000, ai: { provider: 'gemini', geminiKey: 'fake-key', groqKey: '' } };
    const article = { title: 'English headline', summary: 'Public summary.', source: 'Source', publishedAt: new Date().toISOString(), tags: [], isChina: false, isUsa: false };
    const result = await summarizeArticle(article, config); assert.equal(result.translationStatus, 'translated'); assert.equal(result.titleZh, '中文标题');
  } finally { global.fetch = originalFetch; }
});

test('历史记录过滤完全重复事件，并标记有新进展的持续事件', () => {
  const article = { title: 'Regional talks continue', summary: 'A much longer summary with clearly updated public details and new developments.', tags: [], id: '1' };
  const first = applyHistory([article], { days: [] });
  const history = { days: [{ date: '2026-01-01', events: [{ fingerprint: first[0].fingerprint, title: article.title, summaryLength: 5 }] }] };
  const continued = applyHistory([article], history); assert.equal(continued[0].isContinuation, true); assert.equal(continued[0].hasNewDevelopment, true); assert.ok(continued[0].tags.includes('持续关注'));
});

test('邮件模板转义 HTML 且完整渲染板块', () => {
  const item = { titleZh: '<script>alert(1)</script>', summaryZh: '摘要', whyImportant: '重要', score: 88, tags: ['中国重点'], url: 'https://example.com', source: '来源', publishedAt: new Date().toISOString(), crossSources: [] };
  const html = renderHtml({ date: '2026-01-01', overview: '总览', global: [item], china: [], usa: [], watch: [] });
  assert.ok(!html.includes('<script>alert')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('今日观察'));
});

test('同一天发送锁阻止重复发送', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'news-lock-')); const config = { outputDir: dir };
  assert.equal(isLocked(config, '2026-01-01'), false); markSent(config, '2026-01-01', 'id'); assert.equal(isLocked(config, '2026-01-01'), true);
});
