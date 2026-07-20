import fs from 'node:fs';
import path from 'node:path';
import { fingerprint, normalizeTitle } from './normalize.js';
import { similarity } from './deduplicate.js';

export function loadHistory(file) {
  try { const data = JSON.parse(fs.readFileSync(file, 'utf8')); return data.version === 1 && Array.isArray(data.days) ? data : { version: 1, days: [] }; } catch { return { version: 1, days: [] }; }
}
export function reportDate(timezone, now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function lockFile(config, date) { return path.join(config.outputDir, `send-lock-${date}.json`); }
export function isLocked(config, date) { return fs.existsSync(lockFile(config, date)); }
export function markSent(config, date, messageId) { fs.writeFileSync(lockFile(config, date), JSON.stringify({ date, messageId, sentAt: new Date().toISOString() }, null, 2)); }
export function applyHistory(articles, history) {
  const recent = history.days.flatMap((d) => d.events || []);
  return articles.map((article) => {
    const fp = fingerprint(article);
    const old = recent.find((e) => e.fingerprint === fp || similarity(e.title || '', article.title) > 0.72);
    if (!old) return { ...article, fingerprint: fp, isContinuation: false };
    const hasNewDevelopment = normalizeTitle(article.title) !== normalizeTitle(old.title || '') || (article.summary?.length || 0) > (old.summaryLength || 0) + 40;
    return { ...article, fingerprint: fp, isContinuation: true, hasNewDevelopment, tags: [...new Set([...article.tags, '持续关注'])] };
  }).filter((a) => !a.isContinuation || a.hasNewDevelopment);
}
export function saveHistory(file, date, articles, history) {
  const day = { date, events: articles.map((a) => ({ fingerprint: a.fingerprint || fingerprint(a), title: a.title, summaryLength: a.summary?.length || 0, score: a.score })) };
  const days = [day, ...history.days.filter((d) => d.date !== date)].slice(0, 7);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify({ version: 1, days }, null, 2));
}
