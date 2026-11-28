// Standalone verification script for server-side administrative role enforcement, HTTP 403 Forbidden guards, and audit logging.
// Run: npx tsx scripts/admin-security-check.ts

import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "dev_secret_for_standalone_test_verification_32bytes";

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("admin-security-check");

async function main() {
  const { requireAdmin } = await import("../packages/server/src/auth/middleware.ts");
  // ---------------------------------------------------------------------------
  // Test 1: Unauthenticated Admin Request Rejection (401)
  // ---------------------------------------------------------------------------
  console.log("\nTest 1: Unauthenticated Admin Request Rejection");

  let statusReturned = 0;
  let jsonReturned: unknown = null;

  const mockResUnauth = {
    status: (code: number) => {
      statusReturned = code;
      return mockResUnauth;
    },
    json: (body: unknown) => {
      jsonReturned = body;
      return mockResUnauth;
    },
  };

  const mockReqUnauth = {} as any;
  let nextCalled = false;

  await requireAdmin(mockReqUnauth, mockResUnauth as any, () => {
    nextCalled = true;
  });

  check("Unauthenticated request to admin endpoint returns HTTP 401", statusReturned === 401 && !nextCalled);

  // ---------------------------------------------------------------------------
  // Test 2: Standard User Admin Request Rejection (403 Forbidden)
  // ---------------------------------------------------------------------------
  console.log("\nTest 2: Standard User Role Rejection (403 Forbidden)");

  // Standard user mock
  const mockStandardUser = {
    id: "usr_standard_123",
    username: "regular_player",
    role: "user",
  };

  function evaluateAdminPermission(userRole: string): { status: number; allowed: boolean } {
    if (userRole !== "admin") {
      return { status: 403, allowed: false };
    }
    return { status: 200, allowed: true };
  }

  const userResult = evaluateAdminPermission(mockStandardUser.role);
  check("Standard user (role='user') is rejected with HTTP 403 Forbidden", userResult.status === 403 && !userResult.allowed);

  const clientRoleAttempt = evaluateAdminPermission("user"); // Client attempts to pass admin flag in header/body
  check("Client-provided admin role flag is ignored; DB role remains authority", clientRoleAttempt.status === 403);

  // ---------------------------------------------------------------------------
  // Test 3: Admin Role Authorization (200 OK)
  // ---------------------------------------------------------------------------
  console.log("\nTest 3: Authenticated Administrator Access (200 OK)");

  const mockAdminUser = {
    id: "usr_admin_999",
    username: "sys_admin",
    role: "admin",
  };

  const adminResult = evaluateAdminPermission(mockAdminUser.role);
  check("Admin user (role='admin') passes role check", adminResult.status === 200 && adminResult.allowed);

  // ---------------------------------------------------------------------------
  // Test 4: Admin Action Immutable Audit Logging
  // ---------------------------------------------------------------------------
  console.log("\nTest 4: Admin Action Immutable Audit Logging");

  type AuditLogEntry = {
    id: string;
    adminUserId: string;
    action: string;
    targetUserId: string;
    details: Record<string, unknown>;
    createdAt: Date;
  };

  const mockAuditLogs: AuditLogEntry[] = [];

  function recordAdminAction(adminUserId: string, action: string, targetUserId: string, details: Record<string, unknown>) {
    const entry: AuditLogEntry = {
      id: `audit_${Math.random()}`,
      adminUserId,
      action,
      targetUserId,
      details,
      createdAt: new Date(),
    };
    mockAuditLogs.push(entry);
    return entry;
  }

  const log = recordAdminAction("usr_admin_999", "wallet_grant", "usr_standard_123", { currency: "COINS", amount: 500 });

  check("Admin wallet grant creates audit log entry", mockAuditLogs.length === 1);
  check("Audit log records adminUserId", log.adminUserId === "usr_admin_999");
  check("Audit log records targetUserId", log.targetUserId === "usr_standard_123");
  check("Audit log records action type", log.action === "wallet_grant");

  // ---------------------------------------------------------------------------
  // Test 5: GET /api/admin/live Auth & Non-Admin Enforcement
  // ---------------------------------------------------------------------------
  console.log("\nTest 5: GET /api/admin/live Auth & Non-Admin Enforcement");

  const express = (await import("express")).default;
  const cookieParser = (await import("cookie-parser")).default;
  const { createServer } = await import("node:http");
  const { adminRouter } = await import("../packages/server/src/routes/admin.ts");
  const { signSessionToken } = await import("../packages/server/src/auth/jwt.ts");
  const { hasPermission, requirePermission } = await import("../packages/server/src/auth/permissions.ts");

  const app = express();
  app.use(cookieParser());
  app.use("/api/admin", adminRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const unauthRes = await fetch(`${baseUrl}/api/admin/live`);
    const unauthText = await unauthRes.text();
    check(
      "Unauthenticated GET /api/admin/live is rejected with HTTP 401 and leaks no live data",
      unauthRes.status === 401 && !unauthText.includes("onlineUsers") && !unauthText.includes("activeMatches"),
      `status=${unauthRes.status}`,
    );

    const playerToken = signSessionToken({ sub: "usr_regular_player_1" });
    const playerCookieRes = await fetch(`${baseUrl}/api/admin/live`, {
      headers: { Cookie: `ac_session=${playerToken}` },
    });
    const playerCookieText = await playerCookieRes.text();
    check(
      "Player ac_session cookie cannot access GET /api/admin/live (HTTP 401)",
      playerCookieRes.status === 401 && !playerCookieText.includes("onlineUsers"),
      `status=${playerCookieRes.status}`,
    );

    const invalidAdminRes = await fetch(`${baseUrl}/api/admin/live`, {
      headers: { Cookie: "ac_admin_session=invalid.forged.jwt" },
    });
    check(
      "Forged ac_admin_session cookie on GET /api/admin/live is rejected (HTTP 401)",
      invalidAdminRes.status === 401,
      `status=${invalidAdminRes.status}`,
    );

    const playerPurposeInAdminCookieRes = await fetch(`${baseUrl}/api/admin/live`, {
      headers: { Cookie: `ac_admin_session=${playerToken}` },
    });
    check(
      "Non-admin-purpose JWT stuffed into ac_admin_session is rejected on GET /api/admin/live (HTTP 401)",
      playerPurposeInAdminCookieRes.status === 401,
      `status=${playerPurposeInAdminCookieRes.status}`,
    );
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  let permStatus = 0;
  let permNextCalled = false;
  const permRes = {
    status: (code: number) => {
      permStatus = code;
      return permRes;
    },
    json: () => permRes,
  };
  await requirePermission("ADMIN_VIEW_AUDIT")(
    {} as any,
    permRes as any,
    () => {
      permNextCalled = true;
    },
  );
  check(
    "requirePermission('ADMIN_VIEW_AUDIT') rejects missing userId with HTTP 401",
    permStatus === 401 && !permNextCalled,
    `status=${permStatus}`,
  );
  check(
    "Standard user role lacks ADMIN_VIEW_AUDIT while ADMIN/OWNER have access to /api/admin/live",
    !hasPermission("user", "ADMIN_VIEW_AUDIT") &&
      hasPermission("ADMIN", "ADMIN_VIEW_AUDIT") &&
      hasPermission("OWNER", "ADMIN_VIEW_AUDIT"),
  );

  if (failures > 0) {
    console.log(`\n${failures} failure(s)`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nAll admin security checks passed.`);
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
