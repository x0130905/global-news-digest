import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { fetchAllRss } from './fetchers/rss.js';
import { fetchGdelt } from './fetchers/gdelt.js';
import { deduplicate } from './processing/deduplicate.js';
import { classify } from './processing/classify.js';
import { scoreArticle } from './processing/score.js';
import { applyHistory, isLocked, loadHistory, markSent, reportDate, saveHistory } from './processing/history.js';
import { summarizeArticle } from './summarizers/aiSummarizer.js';
import { renderHtml } from './email/renderHtml.js';
import { renderText } from './email/renderText.js';
import { sendEmail } from './email/sendEmail.js';
import { sampleArticles } from './sampleData.js';
import { logger } from './utils/logger.js';
import { mapLimit } from './utils/http.js';
import { applyTopic, selectDailyTopic } from './processing/topic.js';

export function selectSections(articles, config) {
  const quality = articles.filter((a) => !a.isNoise && a.score >= 25).sort((a, b) => b.score - a.score);
  const sorted = quality.filter((a) => a.score >= 35);
  const used = new Set(); const take = (predicate, max) => sorted.filter((a) => predicate(a) && !used.has(a.id)).slice(0, max).map((a) => (used.add(a.id), a));
  const china = take((a) => a.isChina, config.maxChina), usa = take((a) => a.isUsa, config.maxUsa), global = take(() => true, config.maxGlobal);
  const watch = sorted.filter((a) => !used.has(a.id)).slice(0, 3).map((a) => (used.add(a.id), a));
  const needed = Math.max(0, (config.minDaily || 21) - used.size);
  const more = quality.filter((a) => !used.has(a.id)).slice(0, needed).map((a) => (used.add(a.id), a));
  return { global, china, usa, watch, more };
}

export async function run({ config = loadConfig(), now = new Date(), fetchers = { rss: fetchAllRss, gdelt: fetchGdelt }, mailer = sendEmail } = {}) {
  fs.mkdirSync(config.outputDir, { recursive: true }); const date = reportDate(config.timezone, now);
  const topic = selectDailyTopic(config.topics, config.timezone, now, config.requestedTopic); config.currentTopic = topic;
  if (!config.dryRun && isLocked(config, date)) { logger.info('今日邮件已成功发送，幂等锁阻止重复发送', { date }); return { skipped: true, reason: 'already-sent' }; }
  const history = loadHistory(config.historyFile);
  let raw = [...await fetchers.rss(config), ...await fetchers.gdelt(config)];
  const cutoff = now.getTime() - 24 * 3600_000; raw = raw.filter((a) => new Date(a.publishedAt).getTime() >= cutoff && new Date(a.publishedAt).getTime() <= now.getTime() + 10 * 60_000);
  if (!raw.length && config.sampleFallback) { raw = sampleArticles; logger.warn('实时来源无可用结果，dry-run 使用明确标注的模拟数据'); }
  const deduped = deduplicate(raw).map((a) => applyTopic(scoreArticle(classify(a, config.keywords), config.reliability, now), topic));
  const eligible = applyHistory(deduped, history);
  const candidates = selectSections(eligible, config);
  const allCandidates = [...new Map(Object.values(candidates).flat().map((a) => [a.id, a])).values()];
  const aiEnabled = Boolean(config.ai.geminiKey || config.ai.groqKey);
  const summarized = await mapLimit(allCandidates, aiEnabled ? 1 : Math.min(3, config.concurrency || 3), async (a, index) => {
    if (aiEnabled && index > 0) await new Promise((resolve) => setTimeout(resolve, config.aiRequestDelayMs || 6500));
    return { ...a, ...await summarizeArticle(a, config) };
  });
  const byId = new Map(summarized.map((a) => [a.id, a]));
  const sections = Object.fromEntries(Object.entries(candidates).map(([name, items]) => [name, items.map((a) => byId.get(a.id))]));
  const allSelected = summarized;
  const featured = allSelected.filter((a) => a.topicMatch).sort((a, b) => b.score - a.score).slice(0, 8);
  const report = { date, generatedAt: now.toISOString(), timezone: config.timezone, topic, overview: allSelected.length ? `今日专题“${topic.name}”。共筛选 ${allSelected.length} 个高价值事件，重点关注${sections.china.length ? '中国相关进展、' : ''}${sections.usa.length ? '美国相关进展及' : ''}全球外交、经济与安全动态。` : `今日专题“${topic.name}”。过去 24 小时未发现达到质量阈值且可验证的新闻条目。`, featured, ...sections, metadata: { fetched: raw.length, deduplicated: deduped.length, selected: allSelected.length, minimumRequired: config.minDaily, featured: featured.length, dryRun: config.dryRun, sampleData: raw === sampleArticles } };
  const html = renderHtml(report), text = renderText(report); const json = JSON.stringify(report, null, 2);
  fs.writeFileSync(path.join(config.outputDir, 'latest.html'), html); fs.writeFileSync(path.join(config.outputDir, 'latest.txt'), text); fs.writeFileSync(path.join(config.outputDir, 'latest.json'), json); fs.writeFileSync(path.join(config.outputDir, 'run.log'), JSON.stringify({ date, generatedAt: report.generatedAt, ...report.metadata }, null, 2));
  if (!config.dryRun) {
    const d = new Date(`${date}T00:00:00Z`); const subject = `全球时政热点日报｜${d.getUTCFullYear()}年${String(d.getUTCMonth() + 1).padStart(2, '0')}月${String(d.getUTCDate()).padStart(2, '0')}日｜中国与美国重点`;
    const info = await mailer({ config, subject, html, text }); markSent(config, date, info.messageId || 'accepted'); saveHistory(config.historyFile, date, allSelected, history);
  } else logger.info('DRY_RUN 已启用：已生成文件，未发送邮件', report.metadata);
  return { report, html, text };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) run().catch((error) => { logger.error('任务失败', error); process.exitCode = 1; });
