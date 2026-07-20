import crypto from 'node:crypto';
import { safeUrl } from '../utils/http.js';

export const stripHtml = (text = '') => String(text).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
export const normalizeTitle = (title = '') => stripHtml(title).toLowerCase().normalize('NFKC').replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
export const fingerprint = (article) => crypto.createHash('sha256').update(normalizeTitle(article.title).split(' ').sort().join(' ')).digest('hex').slice(0, 24);

function parseDate(value) {
  if (!value) return null;
  const compact = String(value || '').match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);
  const normalized = compact ? `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeArticle(input, fallbackSource = '未知来源') {
  const title = stripHtml(input.title || input.name || '');
  const url = safeUrl(input.url || input.link || input.guid || '');
  if (!title || !url) return null;
  const date = parseDate(input.publishedAt || input.pubDate || input.isoDate || input.seendate);
  if (!date) return null;
  return {
    id: crypto.createHash('sha1').update(url).digest('hex').slice(0, 16), title,
    source: stripHtml(input.source || input.domain || input.sourceName || fallbackSource), url,
    publishedAt: date.toISOString(),
    summary: stripHtml(input.summary || input.contentSnippet || input.description || input.content || '').slice(0, 1200),
    language: input.language || '', region: input.region || '', crossSources: [], raw: undefined
  };
}
