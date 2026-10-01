import { apiFetch } from './api';
const GUEST_ID_KEY = 'fugluck_guest_id'
const LEGACY_GUEST_ID_KEY = 'arcadeclash_guest_id'

function randomGuestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  }
  return Math.random().toString(36).slice(2, 14).padEnd(12, '0')
}

export function getOrCreateGuestId(): string {
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY) || localStorage.getItem(LEGACY_GUEST_ID_KEY)
    if (existing && /^[a-zA-Z0-9_-]{6,32}$/.test(existing)) {
      if (!localStorage.getItem(GUEST_ID_KEY)) localStorage.setItem(GUEST_ID_KEY, existing)
      return existing
    }
    const id = randomGuestId()
    localStorage.setItem(GUEST_ID_KEY, id)
    return id
  } catch {
    return randomGuestId()
  }
}
const GUEST_PROOF_KEY = 'fugluck_guest_proof';
let inFlightGuestProof: Promise<string> | undefined;
export async function getGuestProof(): Promise<string> {
  try {
    const cached=JSON.parse(localStorage.getItem(GUEST_PROOF_KEY) ?? 'null');
    if(typeof cached?.token==='string' && cached.expiresAt > Date.now()+60_000) return cached.token;
  } catch { /* Storage can be unavailable. Keep guest play available. */ }
  if (inFlightGuestProof) return inFlightGuestProof;
  inFlightGuestProof=apiFetch<{token:string;expiresInMs:number}>('/api/auth/guest-ticket',{method:'POST'}).then(proof=>{
    try {localStorage.setItem(GUEST_PROOF_KEY,JSON.stringify({token:proof.token,expiresAt:Date.now()+proof.expiresInMs}));} catch { /* optional storage */ }
    return proof.token;
  });
  try {return await inFlightGuestProof;} finally {inFlightGuestProof=undefined;}
}
