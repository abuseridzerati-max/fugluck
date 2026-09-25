import { getAppEnvironment, getRuntimeMode } from "./environment";

export function getHealthPayload(env: NodeJS.ProcessEnv = process.env) {
  return {
    ok: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: getAppEnvironment(env),
    runtimeMode: getRuntimeMode(env),
    version: "0.0.1",
  };
}
