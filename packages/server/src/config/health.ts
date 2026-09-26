import { getAppEnvironment, getRuntimeMode } from "./environment";
import { getBuildRevision } from './deploymentIdentity';
import { getCommercialSafety } from './commercialSafety';

export function getHealthPayload(env: NodeJS.ProcessEnv = process.env) {
  return {
    ok: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: getAppEnvironment(env),
    runtimeMode: getRuntimeMode(env),
    revision: getBuildRevision(env),
    commercial: getCommercialSafety(env),
    version: "0.0.1",
  };
}
