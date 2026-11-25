import { apiFetch } from './api';

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
