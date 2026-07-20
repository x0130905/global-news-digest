const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
export function scoreArticle(article, reliability = {}, now = new Date()) {
  const ageHours = Math.max(0, (now - new Date(article.publishedAt)) / 3600_000);
  const freshness = Math.max(0, 25 - ageHours * 0.8);
  const sources = Math.min(20, 5 + Math.max(0, (article.sourceCount || 1) - 1) * 6);
  const sourceReliability = 20 * (reliability[article.source] ?? reliability.default ?? 0.7);
  const impactTags = new Set(['外交', '经济', '金融', '军事与安全', '能源', '公共安全', '国际组织']);
  const impact = Math.min(18, article.tags.filter((t) => impactTags.has(t)).length * 5 + 5);
  const focus = (article.isChina ? 6 : 0) + (article.isUsa ? 6 : 0);
  const urgent = article.tags.includes('突发') ? 10 : 0;
  return { ...article, score: clamp(freshness + sources + sourceReliability + impact + focus + urgent - (article.isNoise ? 50 : 0)) };
}
