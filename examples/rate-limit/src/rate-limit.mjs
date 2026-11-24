// A tiny fixed-window rate limiter: at most `limit` calls per key within `windowMs`.
// RATE_LIMIT_DISABLED=1 switches the limit off. That switch is what the control uses.
export function createLimiter({ limit = 5, windowMs = 60_000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return function allow(key) {
    if (process.env.RATE_LIMIT_DISABLED === '1') return true;
    const t = now();
    const entry = hits.get(key);
    if (!entry || t - entry.start >= windowMs) {
      hits.set(key, { start: t, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}
