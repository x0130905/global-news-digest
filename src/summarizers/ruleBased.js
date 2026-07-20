function sentences(text) { return String(text || '').split(/(?<=[。！？.!?])\s+/).map((x) => x.trim()).filter(Boolean); }
export function ruleBasedSummary(article) {
  const sourceText = article.summary || article.title;
  const summary = sentences(sourceText).slice(0, 3).join(' ').slice(0, 420) || `据${article.source}公开信息，该事件仍需结合后续报道核实。`;
  const isChinese = /[\u3400-\u9fff]/.test(`${article.title} ${sourceText}`);
  const why = article.tags.includes('军事与安全') ? '可能影响地区安全与外交走向。' : article.tags.includes('经济') || article.tags.includes('金融') ? '可能影响市场预期、贸易或宏观经济政策。' : article.isChina && article.isUsa ? '事件同时涉及中美利益及双边关系，值得持续关注。' : article.isChina ? '事件可能影响中国的经济、外交、安全或海外利益。' : article.isUsa ? '事件可能影响美国政策及其国际外溢效应。' : '事件具有跨地区影响或可能出现进一步发展。';
  return isChinese
    ? { titleZh: article.title, summaryZh: summary, whyImportant: why, summaryMode: 'rule', translationStatus: 'original-chinese' }
    : { titleZh: '中文翻译待生成', summaryZh: '当前未获得可靠的中文译文，请阅读英文公开摘要；配置 Gemini 或 Groq 后系统会自动补全翻译。', whyImportant: why, summaryMode: 'rule', translationStatus: 'unavailable' };
}
