import type { Request, Response, NextFunction } from 'express';
import { isOriginAllowed } from './cors';

export function httpSecurity(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'none'; object-src 'none'");
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  const mutable = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const origin = req.header('origin');
  if (mutable && ((!isOriginAllowed(origin)) || (!origin && req.header('sec-fetch-site') === 'cross-site'))) {
    res.status(403).json({ error: 'Unapproved request origin' }); return;
  }
  if (mutable && (Number(req.header('content-length')) > 0 || req.header('transfer-encoding')) && !req.is('application/json')) {
    res.status(415).json({ error: 'JSON request body required' }); return;
  }
  next();
}
