import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config.js';
import { run } from '../index.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function uniqueItems(report) {
  return [...new Map([...(report.featured || []), ...report.global, ...report.china, ...report.usa, ...report.watch].map((item) => [item.id, item])).values()];
}

export function publishReport(report, publicDir = path.join(rootDir, 'public')) {
  const dataDir = path.join(publicDir, 'data'); fs.mkdirSync(dataDir, { recursive: true });
  const latest = { ...report, items: uniqueItems(report) };
  const archiveFile = path.join(dataDir, 'archive.json');
  let archive = [];
  try { archive = JSON.parse(fs.readFileSync(archiveFile, 'utf8')); } catch { archive = []; }
  const snapshot = { date: report.date, generatedAt: report.generatedAt, topic: report.topic, overview: report.overview, items: latest.items };
  archive = [snapshot, ...archive.filter((entry) => entry.date !== report.date)].slice(0, 30);
  fs.writeFileSync(path.join(dataDir, 'latest.json'), JSON.stringify(latest, null, 2));
  fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2));
  return { latest, archive };
}

export async function buildSite() {
  // 网站永不发布模拟新闻；实时来源为空时展示真实空状态。
  const config = loadConfig({ argv: ['--dry-run'] });
  const result = await run({ config });
  if (result.report.metadata.sampleData) throw new Error('安全检查失败：网站数据不得包含模拟新闻');
  const published = publishReport(result.report);
  fs.writeFileSync(path.join(rootDir, 'public', 'data', 'topics.json'), JSON.stringify(config.topics, null, 2));
  console.log(JSON.stringify({ status: 'site-updated', date: result.report.date, topic: result.report.topic.name, items: published.latest.items.length, archiveDays: published.archive.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) buildSite().catch((error) => { console.error(error.message); process.exitCode = 1; });
