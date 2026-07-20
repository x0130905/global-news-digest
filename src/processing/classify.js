function includesAny(text, words) { return words.some((word) => text.includes(word.toLowerCase())); }
export function classify(article, keywords) {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  const isChina = includesAny(text, keywords.china);
  const isUsa = includesAny(text, keywords.usa);
  const labels = [];
  if (isChina) labels.push('中国重点');
  if (isUsa) labels.push('美国重点');
  if (includesAny(text, keywords.breaking)) labels.push('突发');
  for (const [label, words] of Object.entries(keywords.categories)) if (includesAny(text, words)) labels.push(label);
  if (!isChina && !isUsa) labels.unshift('全球焦点');
  return { ...article, isChina, isUsa, isNoise: includesAny(text, keywords.noise), tags: [...new Set(labels.length ? labels : ['全球焦点'])] };
}
