import type { PublicUser } from '@fugluck/shared'

const SANDBOX_VISIBLE_ROLES = new Set(['OWNER', 'SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'])

export function canViewSandboxGelUi(user: PublicUser | null | undefined): boolean {
  if (import.meta.env.VITE_SHOW_SANDBOX_GEL === 'true') return true
  return Boolean(user?.role && SANDBOX_VISIBLE_ROLES.has(user.role))
}
