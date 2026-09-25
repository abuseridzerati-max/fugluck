import type { CSSProperties } from 'react'
import type { AdminOperationsData } from './adminTypes'

const card: CSSProperties = { background: '#12131c', border: '1px solid #25283a', borderRadius: 10, padding: 16, minWidth: 0 }
const label: CSSProperties = { color: '#94a3b8', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }
const value: CSSProperties = { color: '#f8fafc', fontSize: 22, fontWeight: 800, marginTop: 7 }
const statusColor = (ok: boolean) => ok ? '#34d399' : '#f87171'

function Row({ name, detail }: { name: string; detail: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid #202334', color: '#cbd5e1', fontSize: 13 }}><span>{name}</span><span style={{ textAlign: 'right', overflowWrap: 'anywhere', color: '#f8fafc' }}>{detail}</span></div>
}

export default function AdminOperationsView({ data, loading, onRefresh }: { data: AdminOperationsData | null; loading: boolean; onRefresh: () => void }) {
  if (loading && !data) return <section aria-live="polite" style={card}><h2 style={{ marginTop: 0 }}>Operations health</h2><p style={{ color: '#94a3b8' }}>Loading operational status…</p></section>
  if (!data) return <section style={card}><h2 style={{ marginTop: 0 }}>Operations health</h2><p style={{ color: '#fca5a5' }}>Operational status is unavailable.</p><button type="button" className="admin-refresh" onClick={onRefresh}>Retry</button></section>

  const instances = Object.entries(data.competitions.instances).filter(([, count]) => count > 0).map(([status, count]) => `${status}: ${count}`).join(' · ') || 'No competition instances'
  const sessions = Object.entries(data.authority.sessions).filter(([, count]) => count > 0).map(([status, count]) => `${status}: ${count}`).join(' · ') || 'No authority sessions'
  const lastAdmission = data.authority.recentAdmissions[0]
  const recentRejects = data.authority.recentAdmissions.filter((admission) => !admission.accepted)
  return <section aria-label="Operations health" style={{ display: 'grid', gap: 14 }}>
    <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div><h2 style={{ margin: '0 0 4px', color: '#f8fafc' }}>Operations health</h2><p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>Read-only service, competition, authority, and accounting status. Checked {new Date(data.checkedAt).toLocaleString()}.</p></div>
      <button type="button" className="admin-refresh" onClick={onRefresh}>↻ Refresh</button>
    </header>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 12 }}>
      <div style={card}><div style={label}>Backend</div><div style={{ ...value, color: statusColor(data.backend.healthy) }}>{data.backend.healthy ? 'Healthy' : 'Unavailable'}</div><Row name="Revision" detail={data.backend.revision ?? 'Not supplied by host'} /><Row name="Uptime" detail={`${Math.floor(data.backend.uptimeSeconds / 60)} min`} /></div>
      <div style={card}><div style={label}>Database</div><div style={{ ...value, color: statusColor(data.database.healthy) }}>{data.database.healthy ? 'Connected' : 'Unavailable'}</div><Row name="Region" detail={data.database.region ?? 'Not configured'} /><Row name="Latest migration record" detail={data.database.migrationAppliedAt ? new Date(data.database.migrationAppliedAt).toLocaleString() : 'Unavailable'} /></div>
      <div style={card}><div style={label}>Frontend</div><div style={value}>{data.frontend.revision ?? 'Revision unavailable'}</div><Row name="Environment" detail={location.hostname.includes('staging') ? 'Staging' : 'Current deployment'} /></div>
      <div style={card}><div style={label}>TEST / SANDBOX GEL</div><div style={{ ...value, color: data.accounting?.reconciled ? '#34d399' : '#fca5a5' }}>{data.accounting?.reconciled ? 'Balanced' : 'Check required'}</div><Row name="Ledger discrepancy" detail={data.accounting ? `${(data.accounting.discrepancyMinor / 100).toFixed(2)} GEL` : 'Unavailable'} /><Row name="Mode" detail="Simulated only · no real money" /></div>
    </div>
    {data.sourceErrors.length > 0 && <div role="status" style={{ ...card, borderColor: '#92400e', color: '#fcd34d' }}>Some operational sources could not be read: {data.sourceErrors.join(', ')}.</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
      <div style={card}><h3 style={{ margin: '0 0 10px', color: '#f8fafc' }}>Competition activity</h3><Row name="Active competitions" detail={String(data.competitions.activeCount)} /><Row name="Instances by status" detail={instances} /><Row name="Authority sessions" detail={sessions} /><Row name="Active authority sessions" detail={String(data.authority.activeSessionCount)} /></div>
      <div style={card}><h3 style={{ margin: '0 0 10px', color: '#f8fafc' }}>Latest admission</h3>{lastAdmission ? <><Row name="Game" detail={lastAdmission.gameId} /><Row name="p95 RTT" detail={lastAdmission.p95RttMs == null ? 'Incomplete sample' : `${lastAdmission.p95RttMs.toFixed(1)} ms`} /><Row name="p95-minus-median jitter" detail={lastAdmission.jitterMs == null ? 'Incomplete sample' : `${lastAdmission.jitterMs.toFixed(1)} ms`} /><Row name="Result" detail={lastAdmission.accepted ? 'Admitted' : 'Rejected'} /><Row name="Sampled" detail={new Date(lastAdmission.sampledAt).toLocaleString()} /></> : <p style={{ color: '#94a3b8', fontSize: 13 }}>No admission measurements in this server process yet.</p>}</div>
      <div style={card}><h3 style={{ margin: '0 0 10px', color: '#f8fafc' }}>Recent admission rejects</h3>{recentRejects.length ? recentRejects.map((admission) => <div key={`${admission.instanceId}-${admission.sampledAt}`} style={{ borderBottom: '1px solid #202334', padding: '9px 0', color: '#fca5a5', fontSize: 13 }}><strong>{admission.gameId}</strong> · p95 {admission.p95RttMs == null ? 'incomplete' : `${admission.p95RttMs.toFixed(1)} ms`} · jitter {admission.jitterMs == null ? 'incomplete' : `${admission.jitterMs.toFixed(1)} ms`}<div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>{new Date(admission.sampledAt).toLocaleString()} · {admission.instanceId}</div></div>) : <p style={{ color: '#94a3b8', fontSize: 13 }}>No rejected admissions in the latest {data.authority.recentAdmissions.length} measurements.</p>}</div>
      <div style={card}><h3 style={{ margin: '0 0 10px', color: '#f8fafc' }}>Reconnects and authority errors</h3><Row name="Recent reconnects" detail={String(data.authority.recentReconnects.length)} /><Row name="Recent authority errors" detail={String(data.authority.recentErrors.length)} /><Row name="Latest error code" detail={data.authority.recentErrors[0]?.code ?? 'None recorded'} /><p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5, marginBottom: 0 }}>Telemetry is process-local, retains at most 40 records per category, and clears on restart. Error codes only are retained; payloads, credentials, cookies, and account identifiers are excluded.</p></div>
    </div>
    <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Refresh status when investigating an event. Database region and applied migration time are shown only when the server can read the configured metadata.</p>
  </section>
}
