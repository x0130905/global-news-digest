import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(rootDir, name), 'utf8'));
const integer = (name, fallback, min = 1, max = 100) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} 必须是 ${min}-${max} 的整数`);
  return value;
};
const bool = (value) => /^(1|true|yes)$/i.test(String(value ?? ''));

export function loadConfig({ argv = process.argv.slice(2) } = {}) {
  const dryRun = argv.includes('--dry-run') || bool(process.env.DRY_RUN);
  const config = {
    rootDir, dryRun, sampleFallback: argv.includes('--sample-fallback'),
    timezone: process.env.REPORT_TIMEZONE || 'Asia/Shanghai',
    language: process.env.REPORT_LANGUAGE || 'zh-CN',
    maxGlobal: integer('MAX_GLOBAL_NEWS', 10, 1, 20),
    maxChina: integer('MAX_CHINA_NEWS', 5, 1, 10),
    maxUsa: integer('MAX_US_NEWS', 5, 1, 10),
    minDaily: integer('MIN_DAILY_NEWS', 21, 21, 100),
    timeoutMs: integer('REQUEST_TIMEOUT_MS', 15000, 1000, 60000),
    concurrency: integer('FETCH_CONCURRENCY', 5, 1, 10),
    email: {
      user: process.env.EMAIL_USER || '', password: process.env.EMAIL_APP_PASSWORD || '',
      to: (process.env.EMAIL_TO || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean)
    },
    ai: { provider: process.env.AI_PROVIDER || 'auto', geminiKey: process.env.GEMINI_API_KEY || '', groqKey: process.env.GROQ_API_KEY || '' },
    sources: readJson('config/sources.json'), keywords: readJson('config/keywords.json'),
    topics: readJson('config/topics.json'), requestedTopic: process.env.REPORT_TOPIC || '',
    reliability: readJson('config/source-reliability.json'),
    outputDir: path.join(rootDir, 'output'), historyFile: path.join(rootDir, 'data/history.json')
  };
  try { new Intl.DateTimeFormat('zh-CN', { timeZone: config.timezone }).format(); } catch { throw new Error(`无效时区: ${config.timezone}`); }
  if (!dryRun && (!config.email.user || !config.email.password || !config.email.to.length)) throw new Error('正式发送需要 EMAIL_USER、EMAIL_APP_PASSWORD 和 EMAIL_TO');
  return config;
}

export { rootDir };
