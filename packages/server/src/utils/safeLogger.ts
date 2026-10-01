import type { NextFunction, Request, Response } from "express";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "pass",
  "secret",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "set-cookie",
  "verificationtoken",
  "verification_token",
  "idempotencykey",
  "jwt",
  "currentpassword", "newpassword", "resettoken", "rawtoken", "socketticket", "signature",
  "databaseurl", "serviceRoleKey".toLowerCase(), "jwtsecret", "webhooksecret", "clientsecret",
  "smtpPass".toLowerCase(), "stagingmockauthorization", "stagingmockproviderkey", "setcookie",
]);

export function redactLogText(value: string): string {
  let text = value.replace(/\bpostgres(?:ql)?:\/\/[^\s'"<>]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}/g, '[REDACTED_PASSWORD_HASH]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]');
  for (const [key, secret] of Object.entries(process.env)) {
    if (secret && secret.length >= 8 && /SECRET|PASSWORD|TOKEN|API_KEY|SERVICE_ROLE|DATABASE_URL|SMTP_PASS|STAGING_MOCK_AUTHORIZATION|STAGING_MOCK_PROVIDER_KEY/.test(key))
      text = text.split(secret).join('[REDACTED]');
  }
  return text.length > 500 ? `${text.substring(0, 500)}... [TRUNCATED ${text.length} chars]` : text;
}

export function redactSensitiveData<T>(data: T, seen = new WeakSet<object>(), depth = 0): T {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    return redactLogText(data) as T;
  }

  if (typeof data !== "object") return data;
  if (depth > 8 || seen.has(data)) return '[OMITTED]' as T;
  seen.add(data);
  if (data instanceof Error) return redactSensitiveData({name:data.name,message:data.message},seen,depth+1) as T;

  if (Array.isArray(data)) {
    if (data.length > 20) {
      const sliced = data.slice(0, 10).map(value => redactSensitiveData(value, seen, depth+1));
      sliced.push(`[... ${data.length - 10} more items]` as unknown as T);
      return sliced as unknown as T;
    }
    return data.map(value => redactSensitiveData(value, seen, depth+1)) as unknown as T;
  }

  const redactedObj: Record<string, unknown> = Object.create(null);
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (SENSITIVE_KEYS.has(normalizedKey)) {
      redactedObj[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      redactedObj[key] = redactSensitiveData(value, seen, depth+1);
    } else if (typeof value === "string") {
      redactedObj[key] = redactLogText(value);
    } else {
      redactedObj[key] = value;
    }
  }

  return redactedObj as unknown as T;
}

export const logger = {
  info: (message: string, ...meta: unknown[]) => {
    const sanitizedMeta = meta.map(value => redactSensitiveData(value));
    console.log(`[INFO] ${redactLogText(message)}`, ...sanitizedMeta);
  },
  warn: (message: string, ...meta: unknown[]) => {
    const sanitizedMeta = meta.map(value => redactSensitiveData(value));
    console.warn(`[WARN] ${redactLogText(message)}`, ...sanitizedMeta);
  },
  error: (message: string, ...meta: unknown[]) => {
    const sanitizedMeta = meta.map(value => redactSensitiveData(value));
    console.error(`[ERROR] ${redactLogText(message)}`, ...sanitizedMeta);
  },
};

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const method = req.method;
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Do not log request bodies for authentication or secret sensitive endpoints
    const isSensitivePath = path.startsWith("/api/auth/login") || path.startsWith("/api/auth/signup") || path.startsWith("/api/admin/login");

    const safeBody = isSensitivePath ? "[SENSITIVE_PATH_BODY_OMITTED]" : '[REQUEST_BODY_OMITTED]';
    const safeQuery = '[QUERY_VALUES_OMITTED]';

    if (statusCode >= 400) {
      logger.warn(`HTTP ${method} ${path} ${statusCode} - ${duration}ms`, {
        query: safeQuery,
        body: safeBody,
        ip: req.ip,
      });
    } else if (process.env.VERBOSE_LOGGING === "true") {
      logger.info(`HTTP ${method} ${path} ${statusCode} - ${duration}ms`, {
        query: safeQuery,
      });
    }
  });

  next();
}
