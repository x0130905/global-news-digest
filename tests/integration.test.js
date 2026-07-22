import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, selectSections } from '../src/index.js';
import { markSent } from '../src/processing/history.js';
import keywords from '../config/keywords.json' with { type: 'json' };
import topics from '../config/topics.json' with { type: 'json' };

test('dry-run 生成三种成品且绝不调用发信', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-')); const outputDir = path.join(root, 'output'); fs.mkdirSync(outputDir);
  const now = new Date('2026-01-02T00:00:00Z');
  const config = { dryRun: true, sampleFallback: false, timezone: 'Asia/Shanghai', maxGlobal: 10, maxChina: 5, maxUsa: 5, outputDir, historyFile: path.join(root, 'history.json'), keywords, topics, requestedTopic: 'technology-energy', reliability: { Test: 0.9, default: 0.7 }, ai: { provider: 'auto', geminiKey: '', groqKey: '' }, email: { user: '', password: '', to: [] } };
  const article = { id: '1', title: 'China announces new technology and trade talks', source: 'Test', url: 'https://example.com/a', publishedAt: '2026-01-01T23:00:00Z', summary: 'Officials announced technology cooperation and trade talks.', crossSources: [] };
  let mailed = false; const result = await run({ config, now, fetchers: { rss: async () => [article], gdelt: async () => [] }, mailer: async () => { mailed = true; } });
  assert.equal(mailed, false); assert.equal(result.report.metadata.selected, 1);
  assert.equal(result.report.topic.slug, 'technology-energy'); assert.equal(result.report.featured.length, 1);
  for (const file of ['latest.html', 'latest.txt', 'latest.json']) assert.ok(fs.statSync(path.join(outputDir, file)).size > 50);
});

test('每日新闻选择数量至少为 21 条', () => {
  const articles = Array.from({ length: 30 }, (_, index) => ({ id: String(index), score: 60 - index / 10, isNoise: false, isChina: index < 4, isUsa: index >= 4 && index < 8, tags: [] }));
  const sections = selectSections(articles, { maxChina: 5, maxUsa: 5, maxGlobal: 10, minDaily: 21 });
  const unique = new Set(Object.values(sections).flat().map((item) => item.id));
  assert.ok(unique.size >= 21);
});

test('测试邮件绕过当天正式锁且不会覆盖锁或历史', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-email-test-')); const outputDir = path.join(root, 'output'); fs.mkdirSync(outputDir);
  const now = new Date('2026-01-02T00:00:00Z'); const historyFile = path.join(root, 'history.json');
  const config = { dryRun: false, sampleFallback: false, timezone: 'Asia/Shanghai', maxGlobal: 10, maxChina: 5, maxUsa: 5, outputDir, historyFile, keywords, topics, requestedTopic: 'technology-energy', reliability: { Test: 0.9, default: 0.7 }, ai: { provider: 'auto', geminiKey: '', groqKey: '' }, email: { user: 'sender@gmail.com', password: 'app-password', to: ['reader@example.com'], testMode: true } };
  markSent(config, '2026-01-02', 'existing-formal-message'); const lockPath = path.join(outputDir, 'send-lock-2026-01-02.json'); const originalLock = fs.readFileSync(lockPath, 'utf8');
  const article = { id: '1', title: 'International leaders discuss technology and security', source: 'Test', url: 'https://example.com/a', publishedAt: '2026-01-01T23:00:00Z', summary: 'Officials announced new international talks.', crossSources: [] };
  let subject = ''; const result = await run({ config, now, fetchers: { rss: async () => [article], gdelt: async () => [] }, mailer: async (mail) => { subject = mail.subject; return { messageId: 'test-message' }; } });
  assert.match(subject, /^【测试】全球时政热点日报/); assert.equal(result.report.metadata.selected, 1); assert.equal(fs.readFileSync(lockPath, 'utf8'), originalLock); assert.equal(fs.existsSync(historyFile), false);
});
