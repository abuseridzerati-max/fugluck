export type AppEnvironment = "development" | "test" | "staging" | "production" | "unconfigured";

const APP_ENVIRONMENTS = new Set<AppEnvironment>(["development", "test", "staging", "production"]);

/** Identifies the deployment target, independently of Node's optimized runtime mode. */
export function getAppEnvironment(env: NodeJS.ProcessEnv = process.env): AppEnvironment {
  const value = env.APP_ENV;
  return value && APP_ENVIRONMENTS.has(value as AppEnvironment)
    ? (value as AppEnvironment)
    : "unconfigured";
}

/** Identifies the Node execution/build mode; this is not a deployment target. */
export function getRuntimeMode(env: NodeJS.ProcessEnv = process.env): string {
  return env.NODE_ENV || "development";
}
