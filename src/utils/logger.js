const SECRET_KEYS = /(password|secret|api.?key|token)/i;
function sanitize(value) {
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.test(k) ? '[REDACTED]' : sanitize(v)]));
  return typeof value === 'string' ? value.replace(/(key|token|password)=([^\s&]+)/gi, '$1=[REDACTED]') : value;
}
export const logger = {
  info(message, data) { console.log(JSON.stringify({ level: 'info', time: new Date().toISOString(), message, ...(data ? { data: sanitize(data) } : {}) })); },
  warn(message, data) { console.warn(JSON.stringify({ level: 'warn', time: new Date().toISOString(), message, ...(data ? { data: sanitize(data) } : {}) })); },
  error(message, data) { console.error(JSON.stringify({ level: 'error', time: new Date().toISOString(), message, ...(data ? { data: sanitize(data) } : {}) })); }
};
