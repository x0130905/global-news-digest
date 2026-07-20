import { logger } from './logger.js';

export async function fetchWithRetry(url, {
  timeoutMs = 15000,
  retries = 3,
  retryBaseDelayMs = 300,
  retryMaxDelayMs = 30000,
  ...options
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': 'GlobalNewsDigest/1.0 (+RSS reader)',
          accept: 'application/json, application/rss+xml, application/xml, text/xml, */*',
          ...options.headers
        }
      });
      if (!response.ok) {
        const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 500);
        const error = new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
        error.retryAfterMs = Math.max(0, Number(response.headers.get('retry-after') || 0) * 1000);
        throw error;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delay = Math.min(retryMaxDelayMs, Math.max(error.retryAfterMs || 0, retryBaseDelayMs * (2 ** (attempt - 1))));
        logger.warn('Request failed; preparing retry', { url: new URL(url).origin, attempt, delay, error });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}
