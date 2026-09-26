export function getClientDeployment(env: Record<string, string | undefined>) {
  const hosted = env.VERCEL === '1';
  const environment = env.VITE_APP_ENV ?? (hosted ? 'unconfigured' : 'development');
  const revision = env.VERCEL_GIT_COMMIT_SHA ?? env.GIT_SHA ?? 'local';
  if (hosted || environment === 'staging' || environment === 'production') {
    if (!['staging', 'production'].includes(environment)) throw new Error('Hosted client requires explicit VITE_APP_ENV.');
    if (!/^[a-f0-9]{40}$/i.test(revision)) throw new Error('Hosted client requires a full Git revision.');
    if (environment === 'production') throw new Error('Production client/API target has not been accepted for Phase 7.');
    if (env.VERCEL_ENV === 'production') throw new Error('Staging must not be deployed as Vercel Production.');
    if (env.VITE_API_URL !== 'https://api-staging.fugluck.com') throw new Error('Staging client must use its registered staging API.');
  } else if (!['development', 'test'].includes(environment)) throw new Error('Invalid VITE_APP_ENV.');
  return { environment, revision };
}
