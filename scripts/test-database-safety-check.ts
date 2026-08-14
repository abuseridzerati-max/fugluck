import { assertDisposableTestDatabase } from "./test-database-safety.ts";

let passed = 0;
let failed = 0;

function expectRejected(label: string, testUrl: string | undefined, appUrl: string | undefined): void {
  try {
    assertDisposableTestDatabase(testUrl, appUrl);
    failed++;
    console.error(`FAIL ${label}: unexpectedly accepted`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Refusing PostgreSQL integration test") && !message.includes("secret")) {
      passed++;
      console.log(`PASS ${label}`);
    } else {
      failed++;
      console.error(`FAIL ${label}: unsafe error shape`);
    }
  }
}

function expectAccepted(label: string, testUrl: string, appUrl: string): void {
  try {
    const result = assertDisposableTestDatabase(testUrl, appUrl);
    if (result.databaseName.endsWith("_test")) {
      passed++;
      console.log(`PASS ${label}`);
    } else {
      failed++;
      console.error(`FAIL ${label}: normalized name was not test-only`);
    }
  } catch (error) {
    failed++;
    console.error(`FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const production = "postgresql://prod_user:prod_password@db.example.com/arcadeclash";

expectRejected("missing TEST_DATABASE_URL", undefined, production);
expectRejected("missing DATABASE_URL", "postgresql://localhost/arcadeclash_atomic_test", undefined);
expectRejected("malformed test URL", "not a URL", production);
expectRejected("non-PostgreSQL protocol", "https://db.example.com/arcadeclash_atomic_test", production);
expectRejected("exact production URL", production, production);
expectRejected(
  "same destination with different credentials",
  "postgresql://other:credentials@db.example.com/arcadeclash",
  production,
);
expectRejected(
  "same destination with query parameters",
  "postgresql://other@db.example.com/arcadeclash?sslmode=require",
  "postgresql://prod@db.example.com/arcadeclash",
);
expectRejected(
  "same destination with query parameters in different order",
  "postgresql://other@db.example.com/arcadeclash?application_name=test&sslmode=require",
  "postgresql://prod@db.example.com/arcadeclash?sslmode=disable&application_name=prod",
);
expectRejected(
  "explicit default port equals implicit default port",
  "postgresql://other@db.example.com:5432/arcadeclash",
  "postgresql://prod@db.example.com/arcadeclash",
);
expectRejected(
  "host casing differences are equivalent",
  "postgresql://other@DB.EXAMPLE.COM/arcadeclash",
  production,
);
expectRejected(
  "encoded database name is equivalent",
  "postgresql://other@db.example.com/arcade%63lash",
  production,
);
expectRejected("normal-looking arcadeclash database name", "postgresql://test-host/arcadeclash", production);
expectRejected("postgres database name", "postgresql://test-host/postgres", production);
expectRejected("generic test database name", "postgresql://test-host/integration_test", production);

expectAccepted(
  "isolated arcadeclash_atomic_test database",
  "postgresql://test_user:test_password@test-db.example.com/arcadeclash_atomic_test?sslmode=require",
  production,
);
expectAccepted(
  "same host with different approved database is isolated structurally",
  "postgresql://test_user@db.example.com:5432/arcadeclash_test",
  production,
);
expectAccepted(
  "encoded approved test database name",
  "postgresql://test_user@test-db.example.com/arcadeclash_atomic_%74est",
  production,
);

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
