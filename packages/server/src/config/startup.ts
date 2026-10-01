import { logger } from "../utils/safeLogger";
import { getAppEnvironment } from "./environment";
import { validateDeploymentIdentity } from './deploymentIdentity';
import { validateCommercialSafety } from './commercialSafety';
import { validateStagingMockConfig } from './stagingMockCommercial';

export type StartupValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateStartupConfig(env: NodeJS.ProcessEnv = process.env): StartupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const appEnvironment = getAppEnvironment(env);
  if (env.NODE_ENV === "production" && appEnvironment !== "staging" && appEnvironment !== "production") {
    errors.push("APP_ENV must be explicitly set to 'staging' or 'production' when NODE_ENV is 'production'.");
  } else if (env.APP_ENV && appEnvironment === "unconfigured") {
    errors.push("APP_ENV must be one of 'development', 'test', 'staging', or 'production'.");
  }

  // 1. Database URL Validation
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    errors.push("DATABASE_URL is required but not configured.");
  } else {
    try {
      const parsed = new URL(databaseUrl);
      if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
        errors.push(`DATABASE_URL protocol must be postgres: or postgresql: (received '${parsed.protocol}')`);
      }
    } catch {
      errors.push("DATABASE_URL is not a valid PostgreSQL connection URI.");
    }
  }

  // 2. JWT Secret Validation
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim().length === 0) {
    errors.push("JWT_SECRET is required but not configured.");
  } else if (jwtSecret.length < 32 && env.NODE_ENV === "production") {
    errors.push("JWT_SECRET must be at least 32 characters long in production/staging environments.");
  }

  // 3. Port Validation
  const port = env.PORT;
  if (port) {
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      errors.push(`PORT must be an integer between 1 and 65535 (received '${port}').`);
    }
  }

  // 4. CORS Origins Warning
  const clientOrigin = env.CLIENT_ORIGIN;
  const allowedOrigins = env.ALLOWED_ORIGINS;
  if (env.NODE_ENV === "production" && !clientOrigin && !allowedOrigins) {
    warnings.push("Neither CLIENT_ORIGIN nor ALLOWED_ORIGINS is set. Falling back to default production domains.");
  }

  errors.push(...validateDeploymentIdentity(env), ...validateCommercialSafety(env), ...validateStagingMockConfig(env));
  if(env.ENABLE_KNOCKOUT_TOURNAMENTS==='true'){
    if(!['development','test','staging'].includes(appEnvironment))errors.push('Knockout tournaments currently require an isolated non-production environment.');
    if(env.ENABLE_COMPETITION_AUTHORITY!=='true')errors.push('Knockout tournaments require certified server authority.');
    if(['REAL_MONEY_ENABLED','REAL_MONEY_DEPOSITS_ENABLED','REAL_MONEY_WITHDRAWALS_ENABLED','REAL_MONEY_COMPETITIONS_ENABLED'].some(key=>env[key]==='true'))errors.push('Knockout candidate cannot enable real money.');
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function enforceStartupConfig(): void {
  const result = validateStartupConfig();

  for (const warning of result.warnings) {
    logger.warn(`[startup-config-warning] ${warning}`);
  }

  if (!result.valid) {
    for (const error of result.errors) {
      logger.error(`[startup-config-error] ${error}`);
    }
    throw new Error(
      `Startup configuration validation failed with ${result.errors.length} error(s):\n- ${result.errors.join("\n- ")}`,
    );
  }
}
