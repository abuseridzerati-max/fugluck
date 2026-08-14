import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";
const PERMISSION_ALIAS_MAP = {
    "users.view": "USERS_VIEW",
    "users.suspend": "USERS_SUSPEND",
    "users.ban": "USERS_BAN",
    "users.unban": "USERS_UNBAN",
    "matches.view": "MATCHES_VIEW",
    "matches.void": "MATCHES_VOID",
    "matches.cancel": "MATCHES_CANCEL",
    "matches.terminate": "MATCHES_VOID",
    "matches.force_resolve": "MATCHES_VOID",
    "wallet.view": "WALLET_VIEW",
    "wallet.grant_coins": "WALLET_GRANT_COINS",
    "wallet.grant_diamonds": "WALLET_GRANT_DIAMONDS",
    "wallet.refund": "WALLET_REFUND",
    "wallet.reverse_transaction": "WALLET_REVERSE_TRANSACTION",
    "audit.view": "ADMIN_VIEW_AUDIT",
    "system.view": "ADMIN_VIEW_AUDIT",
    "admins.manage": "ADMIN_MANAGE_ADMINS",
    "permissions.manage": "ADMIN_MANAGE_ADMINS",
};
const ALL_PERMISSIONS = [
    "USERS_VIEW",
    "USERS_SUSPEND",
    "USERS_BAN",
    "USERS_UNBAN",
    "MATCHES_VIEW",
    "MATCHES_VOID",
    "MATCHES_CANCEL",
    "MATCHES_FORFEIT",
    "MATCHES_REFUND",
    "WALLET_VIEW",
    "WALLET_GRANT_COINS",
    "WALLET_GRANT_DIAMONDS",
    "WALLET_REFUND",
    "WALLET_REVERSE_TRANSACTION",
    "ADMIN_VIEW_AUDIT",
    "ADMIN_MANAGE_ADMINS",
];
export const ROLE_PERMISSIONS = {
    OWNER: ALL_PERMISSIONS,
    SUPER_ADMIN: ALL_PERMISSIONS,
    ADMIN: ALL_PERMISSIONS.filter((p) => p !== "ADMIN_MANAGE_ADMINS"),
    MODERATOR: [
        "USERS_VIEW",
        "USERS_SUSPEND",
        "MATCHES_VIEW",
        "MATCHES_VOID",
        "MATCHES_CANCEL",
        "MATCHES_FORFEIT",
        "ADMIN_VIEW_AUDIT",
    ],
    SUPPORT: ["USERS_VIEW", "MATCHES_VIEW", "WALLET_VIEW", "ADMIN_VIEW_AUDIT"],
    user: [],
};
export function hasPermission(role, permission) {
    const normalizedRole = (role in ROLE_PERMISSIONS ? role : "user");
    const canonicalPermission = PERMISSION_ALIAS_MAP[permission] ?? permission;
    return ROLE_PERMISSIONS[normalizedRole]?.includes(canonicalPermission) ?? false;
}
export function requirePermission(permission) {
    return async (req, res, next) => {
        if (!req.userId) {
            res.status(401).json({ error: "Not authenticated" });
            return;
        }
        const user = await db.query.users.findFirst({ where: eq(users.id, req.userId) });
        if (!user || user.status === "banned" || user.status === "suspended") {
            res.status(403).json({ error: "Account access restricted." });
            return;
        }
        if (!hasPermission(user.role, permission)) {
            res.status(403).json({ error: `Forbidden: Missing required permission [${permission}].` });
            return;
        }
        next();
    };
}
