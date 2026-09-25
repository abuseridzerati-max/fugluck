type AdmissionRecord = {
  instanceId: string
  gameId: string
  sampledAt: string
  sampleCount: number
  p95RttMs: number | null
  medianRttMs: number | null
  jitterMs: number | null
  accepted: boolean
}

type ReconnectRecord = { instanceId: string; gameId: string; occurredAt: string }
type AuthorityErrorRecord = { code: string; occurredAt: string }

const LIMIT = 40
const admissions: AdmissionRecord[] = []
const reconnects: ReconnectRecord[] = []
const authorityErrors: AuthorityErrorRecord[] = []

function push<T>(items: T[], item: T) {
  items.unshift(item)
  if (items.length > LIMIT) items.length = LIMIT
}

export function recordAdmission(instanceId: string, gameId: string, summary: Omit<AdmissionRecord, 'instanceId' | 'gameId' | 'sampledAt'>) {
  push(admissions, { instanceId, gameId, sampledAt: new Date().toISOString(), ...summary })
}

export function recordAuthorityReconnect(instanceId: string, gameId: string) {
  push(reconnects, { instanceId, gameId, occurredAt: new Date().toISOString() })
}

export function recordAuthorityError(code: string) {
  // Keep machine-readable codes only. Never retain socket payloads, identity,
  // exception text, request headers, or credentials in this process-local feed.
  push(authorityErrors, { code: /^[A-Z_]{1,48}$/.test(code) ? code : 'AUTHORITY_UNAVAILABLE', occurredAt: new Date().toISOString() })
}

export function getOperationsTelemetry() {
  return {
    processLocal: true,
    admissions: [...admissions],
    reconnects: [...reconnects],
    authorityErrors: [...authorityErrors],
  }
}
