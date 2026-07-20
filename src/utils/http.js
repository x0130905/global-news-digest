import { logger } from './logger.js';

export async function fetchWithRetry(url, { timeoutMs = 15000, retries = 3, ...options } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { ...options, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'GlobalNewsDigest/1.0 (+RSS reader)', accept: 'application/json, application/rss+xml, application/xml, text/xml, */*', ...options.headers } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) { const delay = 300 * (2 ** (attempt - 1)); logger.warn('请求失败，准备重试', { url: new URL(url).origin, attempt, delay, error }); await new Promise((r) => setTimeout(r, delay)); }
    }
  }
  throw lastError;
}

export function safeUrl(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
}

export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length); let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => { while (next < items.length) { const index = next++; results[index] = await worker(items[index], index); } });
  await Promise.all(runners); return results;
}
