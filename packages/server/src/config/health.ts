import { getAppEnvironment, getRuntimeMode } from "./environment";
import { getBuildRevision } from './deploymentIdentity';
import { getCommercialSafety } from './commercialSafety';
import { stagingMockAction, stagingMockMode } from './stagingMockCommercial';

export function getHealthPayload(env: NodeJS.ProcessEnv = process.env) {
  return {
    ok: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: getAppEnvironment(env),
    runtimeMode: getRuntimeMode(env),
    revision: getBuildRevision(env),
    commercial: getCommercialSafety(env),
    stagingMockCommercial: { enabled: stagingMockMode(env), deposits: stagingMockAction('deposits',env),
      competitions: stagingMockAction('competitions',env), withdrawals: stagingMockAction('withdrawals',env),
      label: 'TEST / MOCK / STAGING — NO REAL MONEY' },
    version: "0.0.1",
  };
}
