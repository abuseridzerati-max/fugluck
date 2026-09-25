import React, { useEffect, useState } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { SandboxFundingGrantAdmin, UserDetail, UserItem } from './adminTypes'
import { formatGEL } from './CompetitionAdminViews'

const panel: React.CSSProperties = { background: '#12131c', border: '1px solid #282a36', borderRadius: 8, padding: 16 }
const field: React.CSSProperties = { background: '#0b0c12', border: '1px solid #343747', borderRadius: 6, color: '#f1f5f9', padding: '10px 12px', minHeight: 40 }
const button: React.CSSProperties = { background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', cursor: 'pointer', padding: '9px 12px', fontWeight: 650 }

export function UserDetailDrawer({ detail, onClose, onGrant, onOpenAction }: {
  detail: UserDetail
  onClose: () => void
  onGrant: (user: UserItem) => void
  onOpenAction: (action: 'suspend' | 'ban' | 'unban' | 'role' | 'grant', user: UserItem) => void
}) {
  const [section, setSection] = useState<'competitions' | 'accounting' | 'matches' | 'audit'>('competitions')
  const { user } = detail
  const money = user.sandboxBalances
  return <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000a', zIndex: 900, display: 'flex', justifyContent: 'flex-end' }}>
    <aside role="dialog" aria-modal="true" aria-label={`User details: ${user.username}`} onClick={e => e.stopPropagation()} style={{ width: 'min(760px, 100vw)', height: '100%', overflowY: 'auto', background: '#0d0e15', borderLeft: '1px solid #343747', padding: 22, boxShadow: '-20px 0 50px #0008' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div><div style={{ color: '#fbbf24', fontSize: 11, fontWeight: 800, letterSpacing: '.12em' }}>USER PROFILE</div><h2 style={{ margin: '5px 0', color: '#f8fafc' }}>{user.username}</h2><div style={{ color: '#94a3b8', fontSize: 13 }}>{user.email || 'No email'} · {user.role} · {user.status.toUpperCase()}</div></div>
        <button type="button" aria-label="Close user details" onClick={onClose} style={button}>Close</button>
      </div>
      <div style={{ ...panel, marginTop: 18 }}><div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 750, marginBottom: 10 }}>ACCOUNT DETAILS</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, fontSize: 13 }}><div><small style={{ color: '#64748b' }}>USER ID</small><div style={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{user.id}</div></div><div><small style={{ color: '#64748b' }}>CREATED</small><div>{new Date(user.createdAt).toLocaleString()}</div></div><div><small style={{ color: '#64748b' }}>ACCOUNT STATUS</small><div>{user.status.toUpperCase()}</div></div></div></div>
      <div style={{ ...panel, marginTop: 12, borderColor: '#1d4ed8' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><div><div style={{ color: '#93c5fd', fontSize: 11, fontWeight: 800, letterSpacing: '.1em' }}>TEST / SANDBOX GEL · NO REAL MONEY</div><div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>Auditable test funding only. Coins remain separate.</div></div><button type="button" onClick={() => onGrant(user)} style={{ ...button, background: '#065f46', borderColor: '#047857' }}>Grant TEST GEL</button></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 14 }}><Balance label="TEST GEL AVAILABLE" value={formatGEL(money.availableMinor)} /><Balance label="TEST GEL RESERVED" value={formatGEL(money.reservedMinor)} /><Balance label="COINS" value={user.balances.coins.toLocaleString()} /></div></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 18, borderBottom: '1px solid #282a36', paddingBottom: 10 }}>{(['competitions', 'accounting', 'matches', 'audit'] as const).map(key => <button key={key} type="button" onClick={() => setSection(key)} style={{ ...button, background: section === key ? '#263247' : 'transparent', color: section === key ? '#fbbf24' : '#94a3b8' }}>{key === 'competitions' ? `Competitions (${detail.recentCompetitions.length})` : key === 'accounting' ? `Sandbox history (${detail.recentSandboxLedger.length})` : key === 'matches' ? `Matches (${detail.recentMatches.length})` : `Audit (${detail.userAuditLogs.length})`}</button>)}</div>
      <div style={{ marginTop: 12 }}>
        {section === 'competitions' && (detail.recentCompetitions.length ? <div style={{ overflowX: 'auto' }}><table style={tableStyle}><thead><tr><th>Competition</th><th>State / Result</th><th>Entry</th><th>Prize</th><th>Registered</th></tr></thead><tbody>{detail.recentCompetitions.map(c => <tr key={`${c.instanceId}-${c.registeredAt}`}><td>{c.templateTitle || c.gameId}<div style={muted}>{c.gameId} · {c.instanceId}</div></td><td>{c.instanceStatus} / {c.participantStatus}{c.rank ? <div style={muted}>Rank {c.rank} · Score {c.score ?? '—'}</div> : null}</td><td>{formatGEL(c.entryFeeMinor)}</td><td style={{ color: '#34d399', fontWeight: 700 }}>{formatGEL(c.prizeWonMinor)}</td><td>{new Date(c.registeredAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <Empty>No competition history for this user.</Empty>)}
        {section === 'accounting' && (detail.recentSandboxLedger.length ? <div style={{ overflowX: 'auto' }}><table style={tableStyle}><thead><tr><th>Time</th><th>Activity</th><th>Amount</th><th>Bucket</th><th>Reference</th></tr></thead><tbody>{detail.recentSandboxLedger.map(row => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString()}</td><td>{row.eventType}<div style={muted}>{row.description || row.accountId}</div></td><td>{formatGEL(row.amountMinor)}</td><td>{row.balanceType}</td><td style={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{row.accountingReferenceId}</td></tr>)}</tbody></table></div> : <Empty>No sandbox accounting activity.</Empty>)}
        {section === 'matches' && (detail.recentMatches.length ? <div style={{ overflowX: 'auto' }}><table style={tableStyle}><thead><tr><th>Game / Match</th><th>Opponent</th><th>Result</th><th>Time</th></tr></thead><tbody>{detail.recentMatches.map(m => <tr key={m.id}><td>{m.gameId}<div style={muted}>{m.id}</div></td><td>{m.player1Id === user.id ? m.player2Id : m.player1Id}</td><td>{m.status}</td><td>{new Date(m.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <Empty>No match history.</Empty>)}
        {section === 'audit' && (detail.userAuditLogs.length ? <div style={{ overflowX: 'auto' }}><table style={tableStyle}><thead><tr><th>Time</th><th>Action</th><th>Reason</th></tr></thead><tbody>{detail.userAuditLogs.map(a => <tr key={a.id}><td>{new Date(a.createdAt).toLocaleString()}</td><td>{a.action}</td><td>{a.reason}</td></tr>)}</tbody></table></div> : <Empty>No audit events for this user.</Empty>)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20, paddingTop: 14, borderTop: '1px solid #282a36' }}><strong style={{ color: '#94a3b8', fontSize: 12, alignSelf: 'center' }}>ACCOUNT ACTIONS</strong><button type="button" style={button} onClick={() => onOpenAction('grant', user)}>Grant Coins</button>{user.status !== 'suspended' && user.status !== 'banned' && <button type="button" style={button} onClick={() => onOpenAction('suspend', user)}>Suspend</button>}{user.status !== 'banned' && <button type="button" style={button} onClick={() => onOpenAction('ban', user)}>Ban</button>}{(user.status === 'suspended' || user.status === 'banned') && <button type="button" style={button} onClick={() => onOpenAction('unban', user)}>Reactivate</button>}<button type="button" style={button} onClick={() => onOpenAction('role', user)}>Change role</button></div>
    </aside>
  </div>
}

function Balance({ label, value }: { label: string; value: string }) { return <div style={{ background: '#0b0c12', border: '1px solid #282a36', borderRadius: 6, padding: 12 }}><div style={{ color: '#64748b', fontSize: 10, fontWeight: 750 }}>{label}</div><div style={{ color: '#f8fafc', fontSize: 19, fontWeight: 750, marginTop: 5 }}>{value}</div></div> }
function Empty({ children }: { children: React.ReactNode }) { return <div style={{ ...panel, textAlign: 'center', color: '#94a3b8' }}>{children}</div> }
const muted: React.CSSProperties = { color: '#64748b', fontSize: 11, marginTop: 3 }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 }

export function GrantTestFundsModal({ isOpen, initialUser, onClose, onSubmit }: {
  isOpen: boolean
  initialUser?: UserItem | null
  onClose: () => void
  onSubmit: (params: { targetUserId: string; amountMinor: number; reason: string }) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<UserItem[]>([])
  const [selected, setSelected] = useState<UserItem | null>(null)
  const [amount, setAmount] = useState('100.00')
  const [reason, setReason] = useState('')
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (isOpen) { setSelected(initialUser || null); setQuery(initialUser ? `${initialUser.username} · ${initialUser.email || initialUser.id}` : ''); setMatches([]); setAmount('100.00'); setReason(''); setReview(false); setError('') } }, [isOpen, initialUser])
  useEffect(() => {
    if (!isOpen || selected || query.trim().length < 2) { setMatches([]); return }
    const timer = window.setTimeout(async () => {
      try { const data = await apiFetch<{ users: UserItem[] }>(`/api/admin/users?query=${encodeURIComponent(query.trim())}&limit=8&page=1`); setMatches(data.users || []) }
      catch (e) { setError(e instanceof ApiError ? e.message : 'User search failed.') }
    }, 200)
    return () => window.clearTimeout(timer)
  }, [isOpen, query, selected])
  if (!isOpen) return null
  const amountMinor = /^(?:0|[1-9]\d{0,4})(?:\.\d{1,2})?$/.test(amount) ? Math.round(Number(amount) * 100) : 0
  const canReview = !!selected && amountMinor > 0 && amountMinor <= 1_000_000 && !!reason.trim()
  const submit = async () => { if (!selected || !canReview) return; setBusy(true); setError(''); try { await onSubmit({ targetUserId: selected.id, amountMinor, reason: reason.trim() }); onClose() } catch (e) { setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Grant failed.') } finally { setBusy(false) } }
  return <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000b', zIndex: 1100, display: 'grid', placeItems: 'center', padding: 16 }}><section role="dialog" aria-modal="true" aria-labelledby="grant-test-gel-title" onClick={e => e.stopPropagation()} style={{ width: 'min(560px,100%)', background: '#12131c', border: '1px solid #343747', borderRadius: 10, padding: 22, maxHeight: '90vh', overflowY: 'auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><div style={{ color: '#93c5fd', fontWeight: 800, letterSpacing: '.1em', fontSize: 11 }}>TEST / SANDBOX · NO REAL MONEY</div><h2 id="grant-test-gel-title" style={{ color: '#f8fafc', margin: '5px 0 16px' }}>Grant TEST GEL</h2></div><button type="button" onClick={onClose} style={button}>Close</button></div>
    {error && <div role="alert" style={{ color: '#fecaca', background: '#7f1d1d', padding: 10, borderRadius: 6, marginBottom: 12 }}>{error}</div>}
    <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13 }}>Find user by username, email, or ID<input autoComplete="off" disabled={!!selected || review} value={selected ? `${selected.username} · ${selected.email || selected.id}` : query} onChange={e => setQuery(e.target.value)} placeholder="Type at least 2 characters" style={{ ...field, display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6 }} /></label>
    {!selected && matches.length > 0 && <div style={{ border: '1px solid #343747', borderRadius: 6, marginTop: 5, maxHeight: 190, overflowY: 'auto' }}>{matches.map(u => <button key={u.id} type="button" onClick={() => { setSelected(u); setQuery('') }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #282a36', background: '#0d0e15', color: '#f1f5f9', padding: 10, cursor: 'pointer' }}>{u.username} <span style={{ color: '#94a3b8' }}>{u.email || ''}</span><div style={{ color: '#64748b', fontSize: 10, fontFamily: 'monospace' }}>{u.id}</div></button>)}</div>}
    {!selected && query.trim().length >= 2 && !matches.length && <div style={{ color: '#64748b', fontSize: 12, padding: 8 }}>No matching users yet.</div>}
    {selected && <div style={{ ...panel, marginTop: 12, fontSize: 13 }}><strong>{selected.username}</strong> · {selected.email || selected.id}<div style={{ color: '#94a3b8', marginTop: 4 }}>Current TEST GEL: {formatGEL(selected.sandboxBalances.availableMinor)} available · {formatGEL(selected.sandboxBalances.reservedMinor)} reserved</div>{!initialUser && !review && <button type="button" onClick={() => { setSelected(null); setQuery('') }} style={{ ...button, padding: '5px 8px', marginTop: 8 }}>Change user</button>}</div>}
    <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, marginTop: 14 }}>Amount (TEST GEL)<input inputMode="decimal" disabled={review} value={amount} onChange={e => setAmount(e.target.value)} placeholder="100.00" style={{ ...field, display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6 }} /> <span style={{ color: '#64748b', fontSize: 11 }}>Up to TEST ₾10,000.00; recorded as integer tetri.</span></label>
    <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, marginTop: 12 }}>Required reason<textarea disabled={review} value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={3} placeholder="Why is this staging test account being funded?" style={{ ...field, display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, resize: 'vertical' }} /></label>
    {review && selected && <div style={{ ...panel, marginTop: 14, borderColor: '#b45309' }}><strong style={{ color: '#fbbf24' }}>Review before granting</strong><div style={{ marginTop: 8 }}>{formatGEL(amountMinor)} TEST GEL → {selected.username}</div><div style={{ color: '#94a3b8', marginTop: 4 }}>Reason: {reason}</div><div style={{ color: '#60a5fa', fontSize: 12, marginTop: 8 }}>This creates a balanced sandbox accounting transaction and an immutable audit record. This is not a deposit and has no real-world value.</div></div>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>{review && <button type="button" disabled={busy} onClick={() => setReview(false)} style={button}>Back</button>}<button type="button" disabled={busy} onClick={onClose} style={button}>Cancel</button>{review ? <button type="button" disabled={busy} onClick={() => void submit()} style={{ ...button, background: '#047857', borderColor: '#059669' }}>{busy ? 'Granting…' : `Confirm TEST ${formatGEL(amountMinor)}`}</button> : <button type="button" disabled={!canReview} onClick={() => setReview(true)} style={{ ...button, background: '#1d4ed8', borderColor: '#2563eb', opacity: canReview ? 1 : .5 }}>Review grant</button>}</div>
  </section></div>
}

export function TestFundingHistoryView({ grants, query, setQuery, loading, onSearch, onGrant }: {
  grants: SandboxFundingGrantAdmin[]; query: string; setQuery: (value: string) => void; loading: boolean; onSearch: () => void; onGrant: () => void
}) {
  return <section><div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}><div><h1 style={{ margin: 0, color: '#f8fafc' }}>Test Funding</h1><p style={{ color: '#94a3b8', margin: '5px 0 0' }}>Append-only TEST / SANDBOX GEL grants. No real money.</p></div><button type="button" onClick={onGrant} style={{ ...button, background: '#065f46', borderColor: '#047857' }}>Grant TEST FUNDS</button></div>
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSearch()} placeholder="Filter by username, email, or user ID" style={{ ...field, flex: 1 }} /><button type="button" onClick={onSearch} style={button}>Search</button></div>
    <div style={{ ...panel, padding: 0, overflowX: 'auto' }}><table style={tableStyle}><thead><tr><th>Timestamp</th><th>User</th><th>Amount</th><th>Administrator</th><th>Reason</th><th>Accounting reference</th></tr></thead><tbody>{loading ? <tr><td colSpan={6} style={{ padding: 20, color: '#94a3b8' }}>Loading funding history…</td></tr> : grants.length ? grants.map(g => <tr key={g.id}><td>{new Date(g.createdAt).toLocaleString()}</td><td>{g.targetUsername || 'Unknown'}<div style={muted}>{g.targetUserId}</div></td><td style={{ color: '#93c5fd', fontWeight: 750 }}>{formatGEL(g.amountMinor)}</td><td>{g.adminUsername || g.adminUserId}</td><td>{g.reason}</td><td style={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{g.details?.accountingReferenceId || 'Unavailable'}</td></tr>) : <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No TEST GEL grants match this search.</td></tr>}</tbody></table></div>
  </section>
}
