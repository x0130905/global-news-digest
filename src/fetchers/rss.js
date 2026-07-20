import Parser from 'rss-parser';
import { fetchWithRetry, mapLimit } from '../utils/http.js';
import { normalizeArticle } from '../processing/normalize.js';
import { logger } from '../utils/logger.js';

export async function fetchRssSource(source, config) {
  const response = await fetchWithRetry(source.url, { timeoutMs: config.timeoutMs });
  const xml = await response.text();
  const parser = new Parser({ timeout: config.timeoutMs });
  const clean = xml.replace(/^\uFEFF/, '');
  let feed;
  try { feed = await parser.parseString(clean); }
  catch (firstError) {
    // 部分公开源会在文本中输出未转义的 &；仅修复裸 & 后再尝试一次。
    const repaired = clean.replace(/&(?!#\d+;|#x[0-9a-f]+;|[a-z][a-z0-9]+;)/gi, '&amp;');
    if (repaired === clean) throw firstError;
    feed = await parser.parseString(repaired);
  }
  return (feed.items || []).map((item) => normalizeArticle({ ...item, source: source.name, region: source.region }, source.name)).filter(Boolean);
}

export async function fetchAllRss(config) {
  const sources = config.sources.rss.filter((s) => s.enabled);
  const groups = await mapLimit(sources, config.concurrency, async (source) => {
    try { const items = await fetchRssSource(source, config); logger.info('RSS 获取完成', { source: source.name, count: items.length }); return items; }
    catch (error) { logger.warn('RSS 来源失败，已隔离', { source: source.name, error }); return []; }
  });
  return groups.flat();
}
