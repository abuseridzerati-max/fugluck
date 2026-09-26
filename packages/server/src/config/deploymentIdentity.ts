import { createHash } from 'node:crypto';
import { getAppEnvironment } from './environment';

// Reviewed intended staging target; this is not evidence of a live connection.
export const STAGING_DATABASE_PROJECT = 'gzfcucvxfzzjzjtgkwpd';
export const STAGING_CLIENT_ORIGIN = 'https://staging.fugluck.com';

/** Keep remaining query parameters well-formed when TLS is supplied to pg. */
export function connectionStringWithManagedTls(value: string): string {
  const url = new URL(value);
  url.searchParams.delete('sslmode');
  return url.toString();
}

export function getBuildRevision(env: NodeJS.ProcessEnv = process.env): string | null {
  const revision = env.RENDER_GIT_COMMIT ?? env.GIT_SHA;
  return revision && /^[a-f0-9]{40}$/i.test(revision) ? revision.toLowerCase() : null;
}

export function isHostedEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production' || ['staging', 'production'].includes(env.APP_ENV ?? '') || env.RENDER === 'true';
}

/** Fingerprint routing fields, never the password or arbitrary URL parameters. */
export function getDatabaseTargetIdentity(value: string | undefined) {
  try {
    if (!value) return null;
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) return null;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    const port = url.port || '5432';
    const database = decodeURIComponent(url.pathname.slice(1));
    const username = decodeURIComponent(url.username);
    if (!hostname || !database || database.includes('/') || !username || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) return null;
    // pg accepts query-string overrides for connection fields. Reject these
    // instead of fingerprinting one destination and connecting to another.
    const permitted = new Set(['sslmode', 'application_name', 'connect_timeout', 'pgbouncer']);
    for (const key of url.searchParams.keys()) if (!permitted.has(key)) return null;
    const directRef = hostname.match(/^db\.([a-z]{20})\.supabase\.co$/)?.[1];
    const poolRef = /^aws-\d+-eu-central-1\.pooler\.supabase\.com$/.test(hostname)
      ? username.match(/\.([a-z]{20})$/)?.[1] : undefined;
    const projectRef = directRef ?? poolRef ?? null;
    return {
      fingerprint: createHash('sha256').update(JSON.stringify([hostname, String(Number(port)), database, username])).digest('hex'),
      projectRef,
      expectedStagingTarget: projectRef === STAGING_DATABASE_PROJECT && database === 'postgres' && ['5432', '6543'].includes(port),
      // Reject explicit TLS downgrade options in hosted configurations.
      tlsPermitted: !url.searchParams.has('sslmode') || ['require', 'verify-full', 'verify-ca'].includes(url.searchParams.get('sslmode')!),
    };
  } catch { return null; }
}

export function getDeploymentIdentity(env: NodeJS.ProcessEnv = process.env) {
  const target = getDatabaseTargetIdentity(env.DATABASE_URL);
  return {
    environment: getAppEnvironment(env),
    revision: getBuildRevision(env),
    database: {
      fingerprint: target?.fingerprint ?? null,
      projectRef: target?.projectRef ?? null,
      expectedFingerprintMatches: Boolean(target && env.DATABASE_TARGET_FINGERPRINT === target.fingerprint),
      intendedStagingTargetMatches: target?.expectedStagingTarget ?? false,
    },
  };
}

export function validateDeploymentIdentity(env: NodeJS.ProcessEnv): string[] {
  if (!isHostedEnvironment(env)) return [];
  const errors: string[] = [];
  const appEnv = getAppEnvironment(env);
  if (appEnv !== 'staging' && appEnv !== 'production') errors.push('Hosted services require explicit APP_ENV=staging or APP_ENV=production.');
  if (env.NODE_ENV !== 'production') errors.push('Hosted services require NODE_ENV=production for secure runtime defaults.');
  // No production API/database/financial environment has been accepted. A code
  // review must register its separate target before any production boot.
  if (appEnv === 'production') errors.push('Production service/database target is not registered; production startup is blocked.');
  if (!getBuildRevision(env)) errors.push('A full 40-character deployed Git revision is required (RENDER_GIT_COMMIT or GIT_SHA).');
  const target = getDatabaseTargetIdentity(env.DATABASE_URL);
  if (!target) errors.push('DATABASE_URL routing fields are invalid or contain unsupported connection overrides.');
  if (!target?.tlsPermitted) errors.push('Hosted database TLS must not be disabled.');
  if (!target || env.DATABASE_TARGET_FINGERPRINT !== target.fingerprint) errors.push('DATABASE_TARGET_FINGERPRINT must match the verified database routing fields.');
  if (appEnv === 'staging' && !target?.expectedStagingTarget) errors.push('Staging must use the registered Frankfurt Supabase staging project.');
  if (appEnv === 'staging') {
    if (env.CLIENT_ORIGIN !== STAGING_CLIENT_ORIGIN || env.APP_URL !== STAGING_CLIENT_ORIGIN) errors.push('Staging CLIENT_ORIGIN and APP_URL must identify the registered staging frontend.');
    const origins = (env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
    if (origins.length !== 1 || origins[0] !== STAGING_CLIENT_ORIGIN) errors.push('Staging ALLOWED_ORIGINS must contain only the registered staging frontend.');
    if (env.COOKIE_DOMAIN) errors.push('Hosted session cookies must be host-only; remove COOKIE_DOMAIN to isolate staging from production.');
    if (env.DATABASE_REGION !== 'eu-central-1') errors.push('Staging DATABASE_REGION must be explicitly set to eu-central-1.');
    if (env.RENDER_SERVICE_ID && env.RENDER_SERVICE_ID !== 'srv-da2c50c9v7es73db3dkg') errors.push('Render service identity does not match the registered staging API.');
  }
  return errors;
}
