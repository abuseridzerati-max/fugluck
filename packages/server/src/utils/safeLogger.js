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
]);
export function redactSensitiveData(data) {
    if (data === null || data === undefined)
        return data;
    if (typeof data === "string") {
        if (data.length > 500) {
            return `${data.substring(0, 500)}... [TRUNCATED ${data.length} chars]`;
        }
        return data;
    }
    if (typeof data !== "object")
        return data;
    if (Array.isArray(data)) {
        if (data.length > 20) {
            const sliced = data.slice(0, 10).map(redactSensitiveData);
            sliced.push(`[... ${data.length - 10} more items]`);
            return sliced;
        }
        return data.map(redactSensitiveData);
    }
    const redactedObj = {};
    for (const [key, value] of Object.entries(data)) {
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (SENSITIVE_KEYS.has(normalizedKey)) {
            redactedObj[key] = "[REDACTED]";
        }
        else if (value && typeof value === "object") {
            redactedObj[key] = redactSensitiveData(value);
        }
        else if (typeof value === "string" && value.length > 500) {
            redactedObj[key] = `${value.substring(0, 500)}... [TRUNCATED ${value.length} chars]`;
        }
        else {
            redactedObj[key] = value;
        }
    }
    return redactedObj;
}
export const logger = {
    info: (message, ...meta) => {
        const sanitizedMeta = meta.map(redactSensitiveData);
        console.log(`[INFO] ${message}`, ...sanitizedMeta);
    },
    warn: (message, ...meta) => {
        const sanitizedMeta = meta.map(redactSensitiveData);
        console.warn(`[WARN] ${message}`, ...sanitizedMeta);
    },
    error: (message, ...meta) => {
        const sanitizedMeta = meta.map((m) => {
            if (m instanceof Error) {
                return {
                    name: m.name,
                    message: m.message,
                    stack: m.stack ? m.stack.split("\n").slice(0, 4).join("\n") : undefined,
                };
            }
            return redactSensitiveData(m);
        });
        console.error(`[ERROR] ${message}`, ...sanitizedMeta);
    },
};
export function requestLoggerMiddleware(req, res, next) {
    const start = Date.now();
    const method = req.method;
    const path = req.path;
    res.on("finish", () => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        // Do not log request bodies for authentication or secret sensitive endpoints
        const isSensitivePath = path.startsWith("/api/auth/login") || path.startsWith("/api/auth/signup") || path.startsWith("/api/admin/login");
        const safeBody = isSensitivePath ? "[SENSITIVE_PATH_BODY_OMITTED]" : redactSensitiveData(req.body);
        const safeQuery = redactSensitiveData(req.query);
        if (statusCode >= 400) {
            logger.warn(`HTTP ${method} ${path} ${statusCode} - ${duration}ms`, {
                query: safeQuery,
                body: safeBody,
                ip: req.ip,
            });
        }
        else if (process.env.VERBOSE_LOGGING === "true") {
            logger.info(`HTTP ${method} ${path} ${statusCode} - ${duration}ms`, {
                query: safeQuery,
            });
        }
    });
    next();
}
