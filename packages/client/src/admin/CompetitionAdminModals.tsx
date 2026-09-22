import React, { useState, useEffect } from 'react'
import type {
  CompetitionTemplateAdmin,
  CompetitionInstanceAdminDetail,
} from './adminTypes'

const ELIGIBLE_GAMES = [
  { id: 'space-blaster', name: 'Space Blaster' },
  { id: 'pixel-ninja-dash', name: 'Pixel Ninja Dash' },
  { id: 'cyber-hopper', name: 'Cyber Hopper' },
  { id: 'neon-runner', name: 'Neon Runner' },
]

function formatGEL(minor: number): string {
  return `TEST ₾${(minor / 100).toFixed(2)}`
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '16px',
}

const modalStyle: React.CSSProperties = {
  backgroundColor: '#161922',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  padding: '24px',
  maxWidth: '680px',
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto',
  color: '#fff',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: '#0d1017',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
  marginTop: '4px',
  marginBottom: '12px',
  boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  backgroundColor: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '10px 18px',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  backgroundColor: '#ef4444',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '10px 18px',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnCancel: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: '#94a3b8',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '6px',
  padding: '10px 18px',
  fontWeight: 600,
  cursor: 'pointer',
  marginRight: '12px',
}

// ---------------------------------------------------------------------------
// 1. Create Template Modal
// ---------------------------------------------------------------------------
export function CreateTemplateModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (params: any) => Promise<void>
}) {
  const [gameId, setGameId] = useState(ELIGIBLE_GAMES[0].id)
  const [title, setTitle] = useState('')
  const format = 'HEAD_TO_HEAD'
  const [capacity, setCapacity] = useState(2)
  const [entryFeeGel, setEntryFeeGel] = useState('5.00')
  const [prize1Gel, setPrize1Gel] = useState('9.00')
  const [rulesVersion, setRulesVersion] = useState('1.0.0')
  const [jurisdiction, setJurisdiction] = useState('GE')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const entryMinor = Math.max(0, Math.round((parseFloat(entryFeeGel) || 0) * 100))
  const prizeMinor = Math.max(0, Math.round((parseFloat(prize1Gel) || 0) * 100))
  const totalEntriesMinor = entryMinor * capacity
  const marginMinor = Math.max(0, totalEntriesMinor - prizeMinor)
  const subsidyMinor = Math.max(0, prizeMinor - totalEntriesMinor)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Template title is required.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        gameId,
        title: title.trim(),
        format,
        participantCapacity: capacity,
        currency: 'GEL',
        entryFeeMinor: entryMinor,
        prizes: [{ placement: 1, amountMinor: prizeMinor, currency: 'GEL' }],
        rulesVersion,
        skillAssessmentVersion: '1.0.0',
        jurisdiction,
        enabled: true,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create template.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="create-template-title">
      <div style={modalStyle}>
        <h2 id="create-template-title" style={{ margin: '0 0 16px 0', fontSize: '20px' }}>
          Create Competition Template
        </h2>

        <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '12px', color: '#93c5fd' }}>
          <strong>TEST / SANDBOX GEL:</strong> Templates operate in simulated sandbox mode only. Zero real money is charged or awarded.
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: '13px', color: '#94a3b8' }}>
            Eligible Game:
            <select
              style={inputStyle}
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
            >
              {ELIGIBLE_GAMES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} (Candidate)
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: '13px', color: '#94a3b8' }}>
            Template Title:
            <input
              type="text"
              style={inputStyle}
              placeholder="e.g. Standard Duel or Weekend Freeroll"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8' }}>
              Format:
              <input type="text" style={inputStyle} value={format} readOnly disabled />
            </label>
            <label style={{ fontSize: '13px', color: '#94a3b8' }}>
              Capacity:
              <input
                type="number"
                min="2"
                max="2"
                style={inputStyle}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 2)}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8' }}>
              Entry Fee (TEST GEL):
              <input
                type="number"
                step="0.01"
                min="0"
                style={inputStyle}
                value={entryFeeGel}
                onChange={(e) => setEntryFeeGel(e.target.value)}
                required
              />
            </label>
            <label style={{ fontSize: '13px', color: '#94a3b8' }}>
              1st Place Prize (TEST GEL):
              <input
                type="number"
                step="0.01"
                min="0"
                style={inputStyle}
                value={prize1Gel}
                onChange={(e) => setPrize1Gel(e.target.value)}
                required
              />
            </label>
          </div>

          {/* Independent Economics Card */}
          <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Informational Operational Economics
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
              <span style={{ color: '#94a3b8' }}>Expected Entries at Capacity:</span>
              <span style={{ fontWeight: 600 }}>{formatGEL(totalEntriesMinor)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
              <span style={{ color: '#94a3b8' }}>Predetermined Prizes:</span>
              <span style={{ fontWeight: 600 }}>{formatGEL(prizeMinor)}</span>
            </div>
            {marginMinor > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#10b981' }}>
                <span>Expected Platform Margin:</span>
                <span style={{ fontWeight: 600 }}>+{formatGEL(marginMinor)}</span>
              </div>
            )}
            {subsidyMinor > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#f59e0b' }}>
                <span>Promotional Subsidy (Platform Cost):</span>
                <span style={{ fontWeight: 600 }}>-{formatGEL(subsidyMinor)}</span>
              </div>
            )}
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
              Note: Entry fee and prize are independent. The server will not auto-adjust prizes based on entries.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8' }}>
              Rules Version:
              <input
                type="text"
                style={inputStyle}
                value={rulesVersion}
                onChange={(e) => setRulesVersion(e.target.value)}
              />
            </label>
            <label style={{ fontSize: '13px', color: '#94a3b8' }}>
              Jurisdiction:
              <input
                type="text"
                style={inputStyle}
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button type="button" style={btnCancel} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" style={btnPrimary} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. Edit Template Modal
// ---------------------------------------------------------------------------
export function EditTemplateModal({
  isOpen,
  template,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  template: CompetitionTemplateAdmin | null
  onClose: () => void
  onSubmit: (templateId: string, params: any) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [rulesVersion, setRulesVersion] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [prize1Gel, setPrize1Gel] = useState('0.00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (template) {
      setTitle(template.title)
      setRulesVersion(template.rulesVersion)
      setJurisdiction(template.jurisdiction)
      setEnabled(template.enabled)
      const p1 = template.prizes?.find((p) => p.placement === 1)
      setPrize1Gel(p1 ? (p1.amountMinor / 100).toFixed(2) : '0.00')
    }
  }, [template])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !template) return null

  const prizeMinor = Math.max(0, Math.round((parseFloat(prize1Gel) || 0) * 100))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(template.id, {
        title: title.trim(),
        rulesVersion,
        jurisdiction,
        enabled,
        prizes: [{ placement: 1, amountMinor: prizeMinor, currency: 'GEL' }],
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update template.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="edit-template-title">
      <div style={modalStyle}>
        <h2 id="edit-template-title" style={{ margin: '0 0 16px 0', fontSize: '20px' }}>
          Edit Template: {template.title}
        </h2>

        {/* Snapshot Immutability Warning */}
        <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#fde68a', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
          <strong>⚠️ Template Immutability Guard:</strong> Changes apply strictly to <strong>FUTURE</strong> competition instances. Existing pending, locked, active, and completed instances permanently retain their snapshotted terms.
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: '13px', color: '#94a3b8' }}>
            Title:
            <input
              type="text"
              style={inputStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>

          <label style={{ fontSize: '13px', color: '#94a3b8' }}>
            1st Place Prize (TEST GEL):
            <input
              type="number"
              step="0.01"
              min="0"
              style={inputStyle}
              value={prize1Gel}
              onChange={(e) => setPrize1Gel(e.target.value)}
              required
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8' }}>
              Rules Version:
              <input
                type="text"
                style={inputStyle}
                value={rulesVersion}
                onChange={(e) => setRulesVersion(e.target.value)}
              />
            </label>
            <label style={{ fontSize: '13px', color: '#94a3b8' }}>
              Jurisdiction:
              <input
                type="text"
                style={inputStyle}
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
              />
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', marginBottom: '16px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span style={{ fontSize: '14px', color: '#e2e8f0' }}>Enabled (Open for continuous player registrations)</span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" style={btnCancel} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" style={btnPrimary} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. Instance Detail Modal (with Snapshot Comparison & Reconciliation)
// ---------------------------------------------------------------------------
export function InstanceDetailModal({
  isOpen,
  detail,
  onClose,
  onCancelCompetition,
  onVoidCompetition,
}: {
  isOpen: boolean
  detail: CompetitionInstanceAdminDetail | null
  onClose: () => void
  onCancelCompetition: (instanceId: string) => void
  onVoidCompetition: (instanceId: string) => void
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !detail) return null

  const { instance, currentTemplate, participants, reconciliation } = detail

  const isPending = instance.status === 'PENDING_ENTRANTS'
  const isVoidable = ['LOCKED', 'ACTIVE', 'VERIFYING'].includes(instance.status)
  const isTerminal = ['SETTLED', 'CANCELLED', 'VOIDED'].includes(instance.status)

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="instance-detail-title">
      <div style={{ ...modalStyle, maxWidth: '800px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 id="instance-detail-title" style={{ margin: 0, fontSize: '20px' }}>
              Instance Detail: <span style={{ fontFamily: 'monospace', fontSize: '18px', color: '#38bdf8' }}>{instance.id}</span>
            </h2>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Game: <strong>{instance.gameId}</strong> | Format: {instance.format}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, backgroundColor: instance.status === 'SETTLED' ? 'rgba(16, 185, 129, 0.2)' : instance.status === 'ACTIVE' ? 'rgba(59, 130, 246, 0.2)' : instance.status === 'CANCELLED' || instance.status === 'VOIDED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: instance.status === 'SETTLED' ? '#34d399' : instance.status === 'ACTIVE' ? '#60a5fa' : instance.status === 'CANCELLED' || instance.status === 'VOIDED' ? '#f87171' : '#fbbf24' }}>
              {instance.status}
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>×</button>
          </div>
        </div>

        {/* Snapshot vs Current Template Comparison */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Immutable Snapshot vs Current Template Terms
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ backgroundColor: '#1e293b', padding: '10px 14px', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600, marginBottom: '6px' }}>
                📸 INSTANCE SNAPSHOT (Binding)
              </div>
              <div style={{ fontSize: '13px' }}>Entry Fee: <strong>{formatGEL(instance.entryFeeMinor)}</strong></div>
              <div style={{ fontSize: '13px' }}>
                Prize(s): <strong>{instance.prizes?.map((p) => `P${p.placement}: ${formatGEL(p.amountMinor)}`).join(', ') || 'None'}</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Rules: {instance.rulesVersion} | Jurisdiction: {instance.jurisdiction}
              </div>
            </div>
            <div style={{ backgroundColor: '#1e293b', padding: '10px 14px', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#a855f7', fontWeight: 600, marginBottom: '6px' }}>
                📋 CURRENT TEMPLATE VALUE
              </div>
              {currentTemplate ? (
                <>
                  <div style={{ fontSize: '13px' }}>Entry Fee: <strong>{formatGEL(currentTemplate.entryFeeMinor)}</strong></div>
                  <div style={{ fontSize: '13px' }}>
                    Prize(s): <strong>{currentTemplate.prizes?.map((p) => `P${p.placement}: ${formatGEL(p.amountMinor)}`).join(', ') || 'None'}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Status: {currentTemplate.enabled ? 'Enabled' : 'Disabled'}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Template no longer exists</div>
              )}
            </div>
          </div>
        </div>

        {/* Participants Table */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#e2e8f0' }}>
            Registered Participants ({participants.length} / {instance.participantCapacity})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Seat</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Username</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Score</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Rank</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Prize Won</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '8px' }}>#{p.seatIndex + 1}</td>
                  <td style={{ padding: '8px', fontWeight: 600 }}>{p.username}</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)' }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {p.score !== null ? p.score : '—'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{p.rank ?? '—'}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: p.prizeWonMinor > 0 ? '#10b981' : '#94a3b8' }}>
                    {p.prizeWonMinor > 0 ? formatGEL(p.prizeWonMinor) : '—'}
                  </td>
                </tr>
              ))}
              {participants.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                    No registered participants.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Reconciliation Panel */}
        <div style={{ backgroundColor: '#0f172a', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Instance Accounting Reconciliation
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', backgroundColor: reconciliation.reconciled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: reconciliation.reconciled ? '#34d399' : '#f87171' }}>
              {reconciliation.reconciled ? 'BALANCED (Zero Discrepancy)' : 'DISCREPANCY DETECTED'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '12px' }}>
            <div>
              <div style={{ color: '#94a3b8' }}>Captured Entries:</div>
              <div style={{ fontWeight: 600 }}>{formatGEL(reconciliation.totalCapturedMinor)}</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8' }}>Prizes Paid:</div>
              <div style={{ fontWeight: 600 }}>{formatGEL(reconciliation.totalPrizesMinor)}</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8' }}>Platform Margin:</div>
              <div style={{ fontWeight: 600 }}>{formatGEL(reconciliation.platformMarginMinor)}</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8' }}>Subsidy / Discrepancy:</div>
              <div style={{ fontWeight: 600, color: reconciliation.discrepancyMinor !== 0 ? '#ef4444' : '#10b981' }}>
                {formatGEL(reconciliation.discrepancyMinor)}
              </div>
            </div>
          </div>
        </div>

        {/* Operational Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {isPending && (
              <button
                type="button"
                style={btnDanger}
                onClick={() => {
                  onCancelCompetition(instance.id)
                  onClose()
                }}
              >
                Cancel Competition (Release Reservations)
              </button>
            )}
            {isVoidable && (
              <button
                type="button"
                style={btnDanger}
                onClick={() => {
                  onVoidCompetition(instance.id)
                  onClose()
                }}
              >
                Void Competition (Refund Captured Entries)
              </button>
            )}
            {isTerminal && (
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Terminal instance. No operational state modifications allowed.
              </span>
            )}
          </div>
          <button type="button" style={btnCancel} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. Safe Cancel Confirmation Modal
// ---------------------------------------------------------------------------
export function CancelCompetitionModal({
  isOpen,
  instanceId,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  instanceId: string | null
  onClose: () => void
  onConfirm: (instanceId: string, reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !instanceId) return null

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('An explicit operational reason is required.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onConfirm(instanceId, reason.trim())
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to cancel instance.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
      <div style={modalStyle}>
        <h2 id="cancel-modal-title" style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#ef4444' }}>
          Cancel Competition Instance
        </h2>
        <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5', margin: '0 0 16px 0' }}>
          Cancelling instance <strong>{instanceId}</strong> will immediately transition it to <strong>CANCELLED</strong> and release all reserved entry funds back to participants. No prizes or platform fees will be awarded.
        </p>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <label style={{ fontSize: '13px', color: '#94a3b8' }}>
          Mandatory Operational Reason:
          <input
            type="text"
            style={inputStyle}
            placeholder="e.g. Unfilled queue timeout or maintenance shutdown"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" style={btnCancel} onClick={onClose} disabled={submitting}>
            Keep Open
          </button>
          <button type="button" style={btnDanger} onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. Safe Void Confirmation Modal
// ---------------------------------------------------------------------------
export function VoidCompetitionModal({
  isOpen,
  instanceId,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  instanceId: string | null
  onClose: () => void
  onConfirm: (instanceId: string, reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !instanceId) return null

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('An explicit operational reason is required.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onConfirm(instanceId, reason.trim())
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to void instance.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="void-modal-title">
      <div style={modalStyle}>
        <h2 id="void-modal-title" style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#ef4444' }}>
          Void Competition Instance
        </h2>
        <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5', margin: '0 0 16px 0' }}>
          Voiding instance <strong>{instanceId}</strong> will transition it to <strong>VOIDED</strong> and issue 100% refunds of all captured entry funds to participants. No platform fee will be retained.
        </p>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <label style={{ fontSize: '13px', color: '#94a3b8' }}>
          Mandatory Operational Reason:
          <input
            type="text"
            style={inputStyle}
            placeholder="e.g. Server restart during active match or client network failure"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" style={btnCancel} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" style={btnDanger} onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Voiding...' : 'Confirm Void & Refund'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 6. Grant Sandbox Test Funds Modal
// ---------------------------------------------------------------------------
export function GrantSandboxFundsModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (params: { targetUserId: string; amountMinor: number; reason: string }) => Promise<void>
}) {
  const [targetUserId, setTargetUserId] = useState('')
  const [amountGel, setAmountGel] = useState('50.00')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const amountMinor = Math.max(0, Math.round((parseFloat(amountGel) || 0) * 100))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUserId.trim()) {
      setError('Target user ID is required.')
      return
    }
    if (amountMinor <= 0) {
      setError('Amount must be greater than zero.')
      return
    }
    if (!reason.trim()) {
      setError('An explicit operational reason is required.')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        targetUserId: targetUserId.trim(),
        amountMinor,
        reason: reason.trim(),
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to grant test funds.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="grant-funds-title">
      <div style={modalStyle}>
        <h2 id="grant-funds-title" style={{ margin: '0 0 16px 0', fontSize: '20px' }}>
          Grant Sandbox Test GEL
        </h2>

        <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '12px', color: '#93c5fd' }}>
          <strong>TEST FUNDING ONLY — NO REAL MONEY:</strong> Credits simulated sandbox funds from the platform treasury account to the target user ledger account.
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: '13px', color: '#94a3b8' }}>
            Target User ID:
            <input
              type="text"
              style={inputStyle}
              placeholder="e.g. user uuid"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              required
            />
          </label>

          <label style={{ fontSize: '13px', color: '#94a3b8' }}>
            Amount (TEST GEL):
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="10000.00"
              style={inputStyle}
              value={amountGel}
              onChange={(e) => setAmountGel(e.target.value)}
              required
            />
          </label>

          <label style={{ fontSize: '13px', color: '#94a3b8' }}>
            Operational Reason:
            <input
              type="text"
              style={inputStyle}
              placeholder="e.g. QA testing account provisioning"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button type="button" style={btnCancel} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" style={btnPrimary} disabled={submitting}>
              {submitting ? 'Granting...' : 'Grant Test Funds'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
