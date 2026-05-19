export class RateLimiter {
  constructor({ maxRequests = 5, windowMs = 15 * 60 * 1000 } = {}) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.store = new Map();
  }

  check(ip) {
    this._cleanup();
    const now = Date.now();
    const entry = this.store.get(ip);

    if (!entry || now >= entry.resetAt) {
      this.store.set(ip, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  _cleanup() {
    const now = Date.now();
    for (const [ip, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(ip);
      }
    }
  }
}
