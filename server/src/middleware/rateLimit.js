'use strict';

const buckets = new Map();

function rateLimit({ windowMs = 60_000, max = 120, keyFn } = {}) {
  return (req, res, next) => {
    if (
      process.env.E2E_DISABLE_RATE_LIMIT === 'true' ||
      process.env.DISABLE_RATE_LIMIT === 'true'
    ) {
      return next();
    }
    const key = (keyFn ? keyFn(req) : req.ip) || 'anonymous';
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      return res.status(429).json({
        error: true,
        code: 'RATE_LIMITED',
        message: 'Demasiados pedidos. Tente novamente dentro de momentos.',
        requestId: req.requestId,
      });
    }

    return next();
  };
}

module.exports = { rateLimit };
