import { normalizeTitle } from './normalize.js';

const tokens = (title) => new Set(normalizeTitle(title).split(/\s+/).filter((x) => x.length > 2));
export function similarity(a, b) {
  const aa = tokens(a), bb = tokens(b); if (!aa.size || !bb.size) return 0;
  const intersection = [...aa].filter((x) => bb.has(x)).length;
  return intersection / (aa.size + bb.size - intersection);
}
export function deduplicate(articles, threshold = 0.46) {
  const groups = [];
  for (const article of articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))) {
    const exact = groups.find((g) => g.primary.url === article.url);
    const similar = exact || groups.find((g) => Math.abs(new Date(g.primary.publishedAt) - new Date(article.publishedAt)) < 48 * 3600_000 && similarity(g.primary.title, article.title) >= threshold);
    if (similar) {
      if (!similar.articles.some((a) => a.source === article.source)) similar.articles.push(article);
      if ((article.summary?.length || 0) > (similar.primary.summary?.length || 0)) similar.primary.summary = article.summary;
    } else groups.push({ primary: { ...article }, articles: [article] });
  }
  return groups.map(({ primary, articles }) => ({ ...primary, crossSources: articles.slice(0, 4).map(({ source, url, publishedAt }) => ({ source, url, publishedAt })), sourceCount: new Set(articles.map((a) => a.source)).size }));
}
