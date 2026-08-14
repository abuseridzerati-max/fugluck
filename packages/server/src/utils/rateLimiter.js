class SlidingWindowRateLimiter {
    records = new Map();
    cleanupInterval;
    constructor() {
        // Periodically prune stale keys every 2 minutes so memory stays bounded
        this.cleanupInterval = setInterval(() => this.pruneStaleRecords(), 2 * 60 * 1000);
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }
    checkRateLimit(key, maxRequests, windowMs) {
        const now = Date.now();
        const windowStart = now - windowMs;
        let record = this.records.get(key);
        if (!record) {
            record = { timestamps: [] };
            this.records.set(key, record);
        }
        // Filter out timestamps older than the sliding window
        record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
        if (record.timestamps.length >= maxRequests) {
            const oldestInWindow = record.timestamps[0];
            const retryAfterMs = oldestInWindow ? oldestInWindow + windowMs - now : windowMs;
            return { allowed: false, remaining: 0, retryAfterMs: Math.max(1000, retryAfterMs) };
        }
        record.timestamps.push(now);
        const remaining = maxRequests - record.timestamps.length;
        return { allowed: true, remaining, retryAfterMs: 0 };
    }
    resetKey(key) {
        this.records.delete(key);
    }
    pruneStaleRecords() {
        const now = Date.now();
        const maxWindowMs = 15 * 60 * 1000; // prune entries inactive for >15 minutes
        for (const [key, record] of this.records.entries()) {
            if (record.timestamps.length === 0 || record.timestamps[record.timestamps.length - 1] < now - maxWindowMs) {
                this.records.delete(key);
            }
        }
    }
}
export const globalRateLimiter = new SlidingWindowRateLimiter();
export function createRateLimiterMiddleware(options) {
    const { windowMs, maxRequests, message = "Too many requests. Please try again later.", keyGenerator } = options;
    return (req, res, next) => {
        const clientKey = keyGenerator ? keyGenerator(req) : req.userId ? `usr:${req.userId}` : `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
        const key = `${req.baseUrl}${req.path}:${clientKey}`;
        const { allowed, retryAfterMs } = globalRateLimiter.checkRateLimit(key, maxRequests, windowMs);
        if (!allowed) {
            res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
            res.status(429).json({ error: message });
            return;
        }
        next();
    };
}
export function checkSocketRateLimit(socketId, eventName, maxRequests, windowMs) {
    const key = `sock:${socketId}:${eventName}`;
    const { allowed } = globalRateLimiter.checkRateLimit(key, maxRequests, windowMs);
    return allowed;
}
