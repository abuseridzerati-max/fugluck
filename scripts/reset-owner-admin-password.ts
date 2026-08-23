/**
 * Controlled Local Owner/Admin Credential Recovery Script for Fugluck
 *
 * Usage:
 *   npx tsx scripts/reset-owner-admin-password.ts --identifier <username|email> --password <new_password>
 * Or using environment variables:
 *   $env:ADMIN_IDENTIFIER="admin"
 *   $env:NEW_ADMIN_PASSWORD="SecureNewPassword123!"
 *   npx tsx scripts/reset-owner-admin-password.ts
 *
 * To list existing admin accounts:
 *   npx tsx scripts/reset-owner-admin-password.ts --list-admins
 */

import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import { eq, or, sql } from "drizzle-orm";
import { db } from "../packages/server/src/db/client.ts";
import { passwordResetTokens, users } from "../packages/server/src/db/schema.ts";
import { hashPassword, validatePasswordPolicy } from "../packages/server/src/auth/password.ts";

const VALID_ADMIN_ROLES = ["OWNER", "SUPER_ADMIN", "ADMIN"] as const;

function parseArgs(): {
  identifier?: string;
  password?: string;
  listAdmins?: boolean;
  clearLockouts?: boolean;
} {
  const args = process.argv.slice(2);
  const result: ReturnType<typeof parseArgs> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--identifier" || arg === "-u") {
      result.identifier = args[++i];
    } else if (arg === "--password" || arg === "-p") {
      result.password = args[++i];
    } else if (arg === "--list-admins" || arg === "-l") {
      result.listAdmins = true;
    } else if (arg === "--clear-lockouts" || arg === "-c") {
      result.clearLockouts = true;
    }
  }

  // Fallback to environment variables if arguments are omitted
  if (!result.identifier && process.env.ADMIN_IDENTIFIER) {
    result.identifier = process.env.ADMIN_IDENTIFIER;
  }
  if (!result.password && process.env.NEW_ADMIN_PASSWORD) {
    result.password = process.env.NEW_ADMIN_PASSWORD;
  }

  return result;
}

export async function resetOwnerAdminPassword(
  identifier: string,
  newPassword: string,
  options?: { clearLockouts?: boolean }
): Promise<{ success: boolean; username: string; role: string; message: string }> {
  const trimmedId = identifier.trim();

  // 1. Password Policy Validation
  const policyResult = validatePasswordPolicy(newPassword);
  if (!policyResult.valid) {
    throw new Error(`Password policy violation: ${policyResult.error}`);
  }

  // 2. Target User Lookup
  const targetUser = await db.query.users.findFirst({
    where: or(eq(users.username, trimmedId), eq(users.email, trimmedId), eq(users.id, trimmedId)),
  });

  if (!targetUser) {
    throw new Error(`Target account not found for identifier: "${trimmedId}".`);
  }

  // 3. Admin/Owner Role Verification
  const isPrivilegedRole = (VALID_ADMIN_ROLES as readonly string[]).includes(targetUser.role);
  if (!isPrivilegedRole) {
    throw new Error(
      `Account "${targetUser.username}" has role "${targetUser.role}", which is not an authorized administrator role (expected: ${VALID_ADMIN_ROLES.join(", ")}).`
    );
  }

  // 4. Secure Canonical Password Hashing
  const newHash = await hashPassword(newPassword);

  // 5. Atomic Update
  await db.transaction(async (tx) => {
    // Update password hash and ensure account is active
    await tx
      .update(users)
      .set({
        passwordHash: newHash,
        status: "active",
        statusReason: null,
      })
      .where(eq(users.id, targetUser.id));

    // Invalidate any existing unconsumed password reset tokens
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, targetUser.id));
  });

  // 6. Optional: Clear IP lockout table
  if (options?.clearLockouts) {
    try {
      await db.execute(sql`TRUNCATE TABLE admin_lockout_attempts;`);
    } catch {
      // Table may not exist in minimal environments
    }
  }

  return {
    success: true,
    username: targetUser.username,
    role: targetUser.role,
    message: `Password successfully updated for ${targetUser.role} account "${targetUser.username}".`,
  };
}

async function listAdminAccounts(): Promise<void> {
  const allUsers = await db.query.users.findMany();
  const admins = allUsers.filter((u) => (VALID_ADMIN_ROLES as readonly string[]).includes(u.role));

  console.log("\n=======================================================");
  console.log("Fugluck Administrator Accounts");
  console.log("=======================================================");
  if (admins.length === 0) {
    console.log("  No accounts with OWNER, SUPER_ADMIN, or ADMIN role found.");
  } else {
    for (const a of admins) {
      console.log(`  - Username: ${a.username} | Role: ${a.role} | Status: ${a.status} | ID: ${a.id}`);
    }
  }
  console.log("=======================================================\n");
}

async function main() {
  const { identifier, password, listAdmins, clearLockouts } = parseArgs();

  if (listAdmins) {
    await listAdminAccounts();
    process.exit(0);
  }

  if (!identifier || !password) {
    console.error("\n[Error] Missing required parameters.");
    console.error("Usage:");
    console.error("  npx tsx scripts/reset-owner-admin-password.ts --identifier <username> --password <new_password> [--clear-lockouts]");
    console.error("  npx tsx scripts/reset-owner-admin-password.ts --list-admins\n");
    process.exit(1);
  }

  console.log("\n--- Fugluck Admin Credential Recovery Tool ---");
  console.log(`Target Identifier: ${identifier}`);

  try {
    const result = await resetOwnerAdminPassword(identifier, password, { clearLockouts });
    console.log(`\n  [SUCCESS] ${result.message}`);
    console.log(`  Account is verified active and ready for login at /admin or /api/admin/login.\n`);
    process.exit(0);
  } catch (err: any) {
    console.error(`\n  [FAILED] ${err.message}\n`);
    process.exit(1);
  }
}

if (process.argv[1]?.includes("reset-owner-admin-password")) {
  main();
}
