const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }

  record.count++;
  return { allowed: true, retryAfter: 0 };
}

export function rateLimitPostCreation(userId: string) {
  // Relaxed for a small community: up to 5 letters per minute. The 1-per-30s
  // cap was tripping people who drew two letters in a row.
  return rateLimit(`post:${userId}`, 5, 60_000);
}

export function rateLimitInteraction(userId: string) {
  return rateLimit(`interact:${userId}`, 10, 10_000);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store) {
    if (now > record.resetAt) store.delete(key);
  }
}, 60_000).unref();
