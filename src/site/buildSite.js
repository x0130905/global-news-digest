import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config.js';
import { run } from '../index.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function uniqueItems(report) {
  return [...new Map([...(report.featured || []), ...report.global, ...report.china, ...report.usa, ...report.watch, ...(report.more || [])].map((item) => [item.id, item])).values()];
}

export function publishReport(report, publicDir = path.join(rootDir, 'public')) {
  const dataDir = path.join(publicDir, 'data'); fs.mkdirSync(dataDir, { recursive: true });
  const latest = { ...report, items: uniqueItems(report) };
  const archiveDir = path.join(dataDir, 'archive'); fs.mkdirSync(archiveDir, { recursive: true });
  const indexFile = path.join(archiveDir, 'index.json');
  let archive = [];
  try { archive = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch { archive = []; }
  // 首次升级时把旧的聚合档案迁移为按日文件，之后永久保存。
  try {
    const legacy = JSON.parse(fs.readFileSync(path.join(dataDir, 'archive.json'), 'utf8'));
    for (const entry of legacy) {
      if (!entry?.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) continue;
      fs.writeFileSync(path.join(archiveDir, `${entry.date}.json`), JSON.stringify(entry, null, 2));
      if (!archive.some((item) => item.date === entry.date)) archive.push({ date: entry.date, generatedAt: entry.generatedAt, topic: entry.topic, count: entry.items?.length || 0 });
    }
  } catch {}
  const snapshot = { date: report.date, generatedAt: report.generatedAt, timezone: report.timezone, topic: report.topic, overview: report.overview, metadata: report.metadata, items: latest.items };
  fs.writeFileSync(path.join(archiveDir, `${report.date}.json`), JSON.stringify(snapshot, null, 2));
  archive = [{ date: report.date, generatedAt: report.generatedAt, topic: report.topic, count: latest.items.length }, ...archive.filter((entry) => entry.date !== report.date)].sort((a, b) => b.date.localeCompare(a.date));
  fs.writeFileSync(path.join(dataDir, 'latest.json'), JSON.stringify(latest, null, 2));
  fs.writeFileSync(indexFile, JSON.stringify(archive, null, 2));
  return { latest, archive };
}

export async function buildSite() {
  // 网站永不发布模拟新闻；实时来源为空时展示真实空状态。
  const config = loadConfig({ argv: ['--dry-run'] });
  const result = await run({ config });
  if (result.report.metadata.sampleData) throw new Error('安全检查失败：网站数据不得包含模拟新闻');
  if (result.report.metadata.selected < config.minDaily) throw new Error(`新闻数量不足：需要至少 ${config.minDaily} 条，实际 ${result.report.metadata.selected} 条；已停止发布以保留上一版`);
  const published = publishReport(result.report);
  fs.writeFileSync(path.join(rootDir, 'public', 'data', 'topics.json'), JSON.stringify(config.topics, null, 2));
  console.log(JSON.stringify({ status: 'site-updated', date: result.report.date, topic: result.report.topic.name, items: published.latest.items.length, archiveDays: published.archive.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) buildSite().catch((error) => { console.error(error.message); process.exitCode = 1; });
