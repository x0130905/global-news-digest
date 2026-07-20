import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { selectDailyTopic, applyTopic } from '../src/processing/topic.js';
import { publishReport } from '../src/site/buildSite.js';
import topics from '../config/topics.json' with { type: 'json' };

test('每日专题按日期稳定轮换且允许手动指定', () => {
  const first = selectDailyTopic(topics, 'Asia/Shanghai', new Date('2026-01-01T00:00:00Z'));
  const same = selectDailyTopic(topics, 'Asia/Shanghai', new Date('2026-01-01T12:00:00Z'));
  const next = selectDailyTopic(topics, 'Asia/Shanghai', new Date('2026-01-02T12:00:00Z'));
  assert.equal(first.slug, same.slug); assert.notEqual(first.slug, next.slug);
  assert.equal(selectDailyTopic(topics, 'Asia/Shanghai', new Date(), 'china').slug, 'china');
});

test('专题匹配增加标签与有限热度加成', () => {
  const article = { title: 'New artificial intelligence semiconductor policy', summary: '', tags: ['科技'], score: 80 };
  const result = applyTopic(article, topics.find((topic) => topic.slug === 'technology-energy'));
  assert.equal(result.topicMatch, true); assert.ok(result.score > 80 && result.score <= 100); assert.ok(result.tags.some((tag) => tag.startsWith('专题·')));
});

test('网站按日期永久保存档案且不截断历史', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'news-site-')); fs.mkdirSync(path.join(dir, 'data'));
  const legacy = Array.from({ length: 35 }, (_, i) => ({ date: `2025-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`, generatedAt: new Date().toISOString(), topic: topics[0], items: [] }));
  fs.writeFileSync(path.join(dir, 'data', 'archive.json'), JSON.stringify(legacy));
  const item = { id: '1', title: 'x' }; const report = { date: '2026-01-01', generatedAt: new Date().toISOString(), topic: topics[0], overview: 'x', featured: [item], global: [item], china: [], usa: [], watch: [] };
  const result = publishReport(report, dir); assert.equal(result.latest.items.length, 1); assert.equal(result.archive.length, 36);
  assert.ok(fs.existsSync(path.join(dir, 'data', 'latest.json')));
  assert.ok(fs.existsSync(path.join(dir, 'data', 'archive', '2026-01-01.json'))); assert.ok(fs.existsSync(path.join(dir, 'data', 'archive', 'index.json')));
});

test('PWA 页面包含搜索、响应式视口和安全外链处理', () => {
  const root = path.resolve(import.meta.dirname, '..', 'public');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'); const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(html, /id="search"/); assert.match(html, /id="date-picker"/); assert.match(html, /command-bar/); assert.match(html, /viewport/); assert.match(html, /manifest\.webmanifest/); assert.match(app, /archive\/index\.json/); assert.match(app, /sources-panel/); assert.match(app, /noopener noreferrer/); assert.match(app, /http:.*https:/); assert.match(app, /bilingual-grid/); assert.match(app, /EN · ORIGINAL/); assert.match(app, /中文翻译/);
});
