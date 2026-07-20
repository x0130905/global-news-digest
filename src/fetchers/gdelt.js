import { fetchWithRetry, mapLimit } from '../utils/http.js';
import { normalizeArticle } from '../processing/normalize.js';
import { logger } from '../utils/logger.js';

export function buildGdeltUrl(query, now = new Date()) {
  const start = new Date(now.getTime() - 24 * 3600_000).toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const end = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const params = new URLSearchParams({ query, mode: 'ArtList', maxrecords: '75', format: 'json', sort: 'DateDesc', startdatetime: start, enddatetime: end });
  return `https://api.gdeltproject.org/api/v2/doc/doc?${params}`;
}

export async function fetchGdelt(config) {
  if (!config.sources.gdelt.enabled) return [];
  const queries = [...new Set([...(config.currentTopic?.query ? [config.currentTopic.query] : []), ...config.sources.gdelt.queries])];
  const groups = await mapLimit(queries, Math.min(2, config.concurrency), async (query) => {
    try {
      const response = await fetchWithRetry(buildGdeltUrl(query), { timeoutMs: config.timeoutMs });
      const data = await response.json();
      return (data.articles || []).map((a) => normalizeArticle({ ...a, source: a.domain || 'GDELT', publishedAt: a.seendate, summary: '' }, 'GDELT')).filter(Boolean);
    } catch (error) { logger.warn('GDELT 查询失败，已隔离', { query, error }); return []; }
  });
  return groups.flat();
}
