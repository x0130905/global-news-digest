export function selectDailyTopic(topics, timezone, now = new Date(), requested = '') {
  if (!Array.isArray(topics) || !topics.length) throw new Error('config/topics.json 至少需要一个专题');
  if (requested) {
    const selected = topics.find((topic) => topic.slug === requested || topic.name === requested);
    if (selected) return selected;
  }
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const dayNumber = Math.floor(Date.parse(`${local}T00:00:00Z`) / 86_400_000);
  return topics[((dayNumber % topics.length) + topics.length) % topics.length];
}

export function applyTopic(article, topic) {
  const text = `${article.title} ${article.summary} ${(article.tags || []).join(' ')}`.toLowerCase();
  const matched = topic.keywords.filter((keyword) => text.includes(keyword.toLowerCase()));
  return { ...article, topic: topic.slug, topicName: topic.name, topicMatch: matched.length > 0, topicKeywords: matched.slice(0, 4), score: Math.min(100, article.score + (matched.length ? Math.min(10, 4 + matched.length * 2) : 0)), tags: matched.length ? [...new Set([...(article.tags || []), `专题·${topic.name}`])] : article.tags };
}
