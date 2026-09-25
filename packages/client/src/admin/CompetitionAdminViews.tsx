import React from 'react'
import type {
  Tab,
  CompetitionOverviewMetrics,
  CompetitionTemplateAdmin,
  CompetitionInstanceAdmin,
  SandboxAccountingSummary,
  SandboxLedgerEntryAdmin,
  GameEligibilityAdminItem,
} from './adminTypes'

export function formatGEL(minor: number): string {
  return `TEST ₾${(minor / 100).toFixed(2)}`
}

const cardStyle: React.CSSProperties = {
  background: '#12131c',
  border: '1px solid #1e2030',
  borderRadius: '8px',
  padding: '16px',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#94a3b8',
  letterSpacing: '0.05em',
  marginBottom: '6px',
}

const noticeBannerStyle: React.CSSProperties = {
  backgroundColor: 'rgba(59, 130, 246, 0.1)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  borderRadius: '8px',
  padding: '12px 16px',
  marginBottom: '20px',
  fontSize: '13px',
  color: '#93c5fd',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const btnPrimaryStyle: React.CSSProperties = {
  backgroundColor: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondaryStyle: React.CSSProperties = {
  background: '#1e2030',
  border: '1px solid #334155',
  color: '#cbd5e1',
  padding: '6px 12px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
}

// ===========================================================================
// 1. Competition Overview View
// ===========================================================================
export function CompetitionOverviewView({
  metrics,
  onNavigateTab,
}: {
  metrics: CompetitionOverviewMetrics | null
  onNavigateTab: (tab: Tab) => void
}) {
  if (!metrics) {
    return <div style={{ color: '#94a3b8', padding: '24px' }}>Loading competition telemetry...</div>
  }

  const isReconciled = metrics.reconciliationDiscrepancyMinor === 0

  return (
    <div>
      <div style={noticeBannerStyle}>
        <div>
          <strong>🛡️ SANDBOX / TEST GEL ENVIRONMENT:</strong> All competitions, entry fees, and prize allocations operate strictly in simulated sandbox mode. Zero real payment rails or financial wagering exist.
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, background: '#1e3a8a', color: '#bfdbfe', padding: '3px 8px', borderRadius: '4px' }}>
          NO REAL MONEY
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Competition Domain Telemetry
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" style={btnSecondaryStyle} onClick={() => onNavigateTab('competitions_templates')}>
            Manage Templates →
          </button>
          <button type="button" style={btnSecondaryStyle} onClick={() => onNavigateTab('competitions_instances')}>
            Live Instances →
          </button>
          <button type="button" style={btnSecondaryStyle} onClick={() => onNavigateTab('competitions_accounting')}>
            Sandbox Accounting →
          </button>
        </div>
      </div>

      {/* Instance Lifecycle Status Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div style={cardStyle}>
          <div style={labelStyle}>ACTIVE TEMPLATES</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc' }}>
            {metrics.enabledTemplatesCount} <span style={{ fontSize: '14px', color: '#64748b' }}>/ {metrics.totalTemplatesCount}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#34d399', marginTop: '4px' }}>Enabled for registration</div>
        </div>

        <div style={{ ...cardStyle, border: '1px solid #f59e0b' }}>
          <div style={{ ...labelStyle, color: '#fcd34d' }}>WAITING INSTANCES</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#fcd34d' }}>{metrics.waitingInstancesCount}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Pending entrants (Cancellable)</div>
        </div>

        <div style={{ ...cardStyle, border: '1px solid #3b82f6' }}>
          <div style={{ ...labelStyle, color: '#60a5fa' }}>LOCKED / ACTIVE NOW</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#60a5fa' }}>
            {metrics.activeInstancesCount} <span style={{ fontSize: '14px', color: '#94a3b8' }}>({metrics.lockedInstancesCount} locked)</span>
          </div>
          <div style={{ fontSize: '11px', color: '#93c5fd', marginTop: '4px' }}>Matches currently running</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>VERIFYING</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#c084fc' }}>{metrics.verifyingInstancesCount}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Authority session and lifecycle records</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>SETTLED TODAY</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#34d399' }}>{metrics.settledTodayCount}</div>
          <div style={{ fontSize: '11px', color: '#34d399', marginTop: '4px' }}>Terminal & settled</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>CANCELLED / VOIDED</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#fca5a5' }}>
            {metrics.cancelledTodayCount} <span style={{ fontSize: '14px', color: '#64748b' }}>cxl / {metrics.voidedTodayCount} void</span>
          </div>
          <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>Refunded / released today</div>
        </div>
      </div>

      {/* Sandbox Financial Telemetry */}
      <h3 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Sandbox Circulation & Economics (TEST GEL)
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div style={cardStyle}>
          <div style={labelStyle}>ENTRIES RESERVED</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#fcd34d' }}>{formatGEL(metrics.entriesReservedMinor)}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Pending seat holds</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>ENTRIES CAPTURED (ESCROW)</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#60a5fa' }}>{formatGEL(metrics.entriesCapturedMinor)}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Locked & in-play matches</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>PRIZES AWARDED</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399' }}>{formatGEL(metrics.prizesAwardedMinor)}</div>
          <div style={{ fontSize: '11px', color: '#34d399', marginTop: '4px' }}>Audited winner credits</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>PROMOTIONAL SUBSIDIES</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#c084fc' }}>{formatGEL(metrics.promotionalSubsidiesMinor)}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Platform overlay funded</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>PLATFORM MARGIN</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc' }}>{formatGEL(metrics.platformMarginMinor)}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Retained sandbox margin</div>
        </div>
      </div>

      {/* System Double-Entry Reconciliation Banner */}
      <div style={{ backgroundColor: isReconciled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${isReconciled ? '#059669' : '#dc2626'}`, borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '16px' }}>{isReconciled ? '⚖️' : '🚨'}</span>
            <span style={{ fontWeight: 700, color: isReconciled ? '#34d399' : '#fca5a5', fontSize: '14px' }}>
              {isReconciled ? 'SYSTEM RECONCILIATION: BALANCED' : 'SYSTEM RECONCILIATION: DISCREPANCY DETECTED'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
            System Ledger Sum = {formatGEL(metrics.systemLedgerSumMinor)} | Global Discrepancy = {formatGEL(metrics.reconciliationDiscrepancyMinor)}
          </div>
        </div>
        <button
          type="button"
          style={btnSecondaryStyle}
          onClick={() => onNavigateTab('competitions_accounting')}
        >
          View Full Ledger & Audit →
        </button>
      </div>
    </div>
  )
}

// ===========================================================================
// 2. Competition Templates View
// ===========================================================================
export function CompetitionTemplatesView({
  templates,
  onCreateClick,
  onEditClick,
  onToggleClick,
  hasManagePerm,
}: {
  templates: CompetitionTemplateAdmin[]
  onCreateClick: () => void
  onEditClick: (template: CompetitionTemplateAdmin) => void
  onToggleClick: (template: CompetitionTemplateAdmin) => void
  hasManagePerm: boolean
}) {
  return (
    <div>
      <div style={noticeBannerStyle}>
        <div>
          <strong>INDEPENDENT ENTRY & PRIZE MODEL:</strong> Predetermined prizes are independent of entry volume. Freerolls, promotional overlay subsidies, and custom margin structures are fully supported.
        </div>
        {hasManagePerm && (
          <button type="button" style={btnPrimaryStyle} onClick={onCreateClick}>
            + Create New Template
          </button>
        )}
      </div>

      <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Template Title & ID</th>
              <th style={{ padding: '12px' }}>Game / Format</th>
              <th style={{ padding: '12px' }}>Capacity</th>
              <th style={{ padding: '12px' }}>Entry Fee</th>
              <th style={{ padding: '12px' }}>Predetermined Prizes</th>
              <th style={{ padding: '12px' }}>Economics Preview</th>
              <th style={{ padding: '12px' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  No competition templates defined.
                </td>
              </tr>
            ) : (
              templates.map((t) => {
                const p1 = t.prizes?.find((p) => p.placement === 1)
                const totalEntriesMinor = t.entryFeeMinor * t.participantCapacity
                const totalPrizesMinor = t.prizes?.reduce((acc, p) => acc + p.amountMinor, 0) || 0
                const marginMinor = Math.max(0, totalEntriesMinor - totalPrizesMinor)
                const subsidyMinor = Math.max(0, totalPrizesMinor - totalEntriesMinor)

                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #1e2030' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{t.title}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{t.id}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>Rules: {t.rulesVersion} | {t.jurisdiction}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ color: '#cbd5e1', fontWeight: 500 }}>{t.gameId}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{t.format}</div>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#f8fafc' }}>
                      {t.participantCapacity} players
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: t.entryFeeMinor === 0 ? '#34d399' : '#fbbf24' }}>
                      {t.entryFeeMinor === 0 ? 'FREE (Freeroll)' : formatGEL(t.entryFeeMinor)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600, color: '#38bdf8' }}>
                        1st: {p1 ? formatGEL(p1.amountMinor) : 'None'}
                      </div>
                      {t.prizes && t.prizes.length > 1 && (
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          +{t.prizes.length - 1} more placement(s)
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '11px' }}>
                      <div style={{ color: '#94a3b8' }}>Capacity Entries: <strong>{formatGEL(totalEntriesMinor)}</strong></div>
                      {subsidyMinor > 0 && (
                        <div style={{ color: '#c084fc', fontWeight: 600 }}>Subsidy: +{formatGEL(subsidyMinor)}</div>
                      )}
                      {marginMinor > 0 && (
                        <div style={{ color: '#34d399', fontWeight: 600 }}>Margin: {formatGEL(marginMinor)}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: t.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: t.enabled ? '#34d399' : '#f87171',
                        }}
                      >
                        {t.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {hasManagePerm && (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditClick(t)}
                              style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >
                              Edit Terms
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleClick(t)}
                              style={{
                                background: t.enabled ? '#7f1d1d' : '#065f46',
                                color: '#fff',
                                border: 'none',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              {t.enabled ? 'Disable' : 'Enable'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===========================================================================
// 3. Competition Instances View
// ===========================================================================
export function CompetitionInstancesView({
  instances,
  total,
  page,
  statusFilter,
  gameFilter,
  onStatusFilterChange,
  onGameFilterChange,
  onSearch,
  onInspect,
  onCancel,
  onVoid,
  hasCancelPerm,
  hasVoidPerm,
}: {
  instances: CompetitionInstanceAdmin[]
  total: number
  page: number
  statusFilter: string
  gameFilter: string
  onStatusFilterChange: (s: string) => void
  onGameFilterChange: (g: string) => void
  onSearch: (page: number) => void
  onInspect: (id: string) => void
  onCancel: (id: string) => void
  onVoid: (id: string) => void
  hasCancelPerm: boolean
  hasVoidPerm: boolean
}) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
        >
          <option value="">All Statuses</option>
          <option value="PENDING_ENTRANTS">PENDING_ENTRANTS</option>
          <option value="LOCKED">LOCKED</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="VERIFYING">VERIFYING</option>
          <option value="SETTLED">SETTLED</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="VOIDED">VOIDED</option>
        </select>

        <select
          value={gameFilter}
          onChange={(e) => onGameFilterChange(e.target.value)}
          style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
        >
          <option value="">All Games</option>
          <option value="space-blaster">Space Blaster</option>
          <option value="pixel-ninja-dash">Pixel Ninja Dash</option>
          <option value="cyber-hopper">Cyber Hopper</option>
          <option value="neon-runner">Neon Runner</option>
        </select>

        <button
          type="button"
          onClick={() => onSearch(1)}
          style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
        >
          Filter Instances
        </button>
      </div>

      <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Instance ID / Template</th>
              <th style={{ padding: '12px' }}>Game / Format</th>
              <th style={{ padding: '12px' }}>Status</th>
              <th style={{ padding: '12px' }}>Participants</th>
              <th style={{ padding: '12px' }}>Entry Fee</th>
              <th style={{ padding: '12px' }}>Prize Pool</th>
              <th style={{ padding: '12px' }}>Created</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {instances.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  No competition instances found.
                </td>
              </tr>
            ) : (
              instances.map((inst) => {
                const isPending = inst.status === 'PENDING_ENTRANTS'
                const isVoidable = ['LOCKED', 'ACTIVE', 'VERIFYING'].includes(inst.status)
                const isTerminal = ['SETTLED', 'CANCELLED', 'VOIDED'].includes(inst.status)

                return (
                  <tr key={inst.id} style={{ borderBottom: '1px solid #1e2030' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                        {inst.id}
                      </div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{inst.templateTitle}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{inst.gameId}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{inst.format}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background:
                            inst.status === 'SETTLED'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : inst.status === 'ACTIVE'
                              ? 'rgba(59, 130, 246, 0.2)'
                              : inst.status === 'CANCELLED' || inst.status === 'VOIDED'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(245, 158, 11, 0.2)',
                          color:
                            inst.status === 'SETTLED'
                              ? '#34d399'
                              : inst.status === 'ACTIVE'
                              ? '#60a5fa'
                              : inst.status === 'CANCELLED' || inst.status === 'VOIDED'
                              ? '#f87171'
                              : '#fbbf24',
                        }}
                      >
                        {inst.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontWeight: 600, color: inst.currentParticipants === inst.participantCapacity ? '#34d399' : '#f8fafc' }}>
                        {inst.currentParticipants}
                      </span>
                      <span style={{ color: '#64748b' }}> / {inst.participantCapacity}</span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#fbbf24' }}>
                      {formatGEL(inst.entryFeeMinor)}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#38bdf8' }}>
                      {formatGEL(inst.totalPrizeMinor)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '11px', color: '#94a3b8' }}>
                      {new Date(inst.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => onInspect(inst.id)}
                          style={{ background: '#1e2030', border: '1px solid #334155', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Inspect
                        </button>
                        {isPending && hasCancelPerm && (
                          <button
                            type="button"
                            onClick={() => onCancel(inst.id)}
                            style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            Cancel
                          </button>
                        )}
                        {isVoidable && hasVoidPerm && (
                          <button
                            type="button"
                            onClick={() => onVoid(inst.id)}
                            style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            Void
                          </button>
                        )}
                        {isTerminal && (
                          <span style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>Protected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>
        <div>Total: {total} competition instance(s)</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onSearch(page - 1)}
            style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
          >
            ← Prev
          </button>
          <span style={{ padding: '4px 8px' }}>Page {page}</span>
          <button
            type="button"
            disabled={instances.length < 20}
            onClick={() => onSearch(page + 1)}
            style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: instances.length < 20 ? 'not-allowed' : 'pointer' }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// 4. Sandbox Accounting View
// ===========================================================================
export function CompetitionAccountingView({
  summary,
  ledger,
  ledgerTotal,
  ledgerPage,
  accountFilter,
  eventFilter,
  onAccountFilterChange,
  onEventFilterChange,
  onFilterLedger,
  onGrantClick,
  hasGrantPerm,
}: {
  summary: SandboxAccountingSummary | null
  ledger: SandboxLedgerEntryAdmin[]
  ledgerTotal: number
  ledgerPage: number
  accountFilter: string
  eventFilter: string
  onAccountFilterChange: (a: string) => void
  onEventFilterChange: (e: string) => void
  onFilterLedger: (page: number) => void
  onGrantClick: () => void
  hasGrantPerm: boolean
}) {
  const isReconciled = summary ? summary.discrepancyMinor === 0 : true

  return (
    <div>
      <div style={{ ...noticeBannerStyle, background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#fef08a' }}>
        <div>
          <strong>SANDBOX ACCOUNTING — NO REAL MONEY:</strong> All accounts, ledgers, and transactions represent simulated GEL test balances. No real financial institution integration exists.
        </div>
        {hasGrantPerm && (
          <button type="button" style={{ ...btnPrimaryStyle, backgroundColor: '#d97706' }} onClick={onGrantClick}>
            + Grant Sandbox Test Funds
          </button>
        )}
      </div>

      {summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            <div style={cardStyle}>
              <div style={labelStyle}>TOTAL FUNDING GRANTS</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc' }}>{formatGEL(summary.totalFundingGrantsMinor)}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Simulated QA injections</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>AVAILABLE USER TEST FUNDS</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399' }}>{formatGEL(summary.availableUserTestFundsMinor)}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>User sandbox wallets</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>RESERVED ENTRY FUNDS</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#fcd34d' }}>{formatGEL(summary.reservedEntryFundsMinor)}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Pending competition holds</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>CAPTURED ENTRIES / ESCROW</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#60a5fa' }}>{formatGEL(summary.capturedEntryFundsMinor)}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Escrowed in active matches</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>PRIZE AWARDS</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399' }}>{formatGEL(summary.prizeAwardsMinor)}</div>
              <div style={{ fontSize: '11px', color: '#34d399', marginTop: '4px' }}>Settled contest prizes</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>TOTAL REFUNDS</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#fca5a5' }}>{formatGEL(summary.refundsMinor)}</div>
              <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>Voided / cancelled returns</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>PLATFORM SANDBOX FEES</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc' }}>{formatGEL(summary.platformFeesMinor)}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Retained margin</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>PROMOTIONAL SUBSIDIES</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#c084fc' }}>{formatGEL(summary.promotionalSubsidiesMinor)}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Platform overlay paid</div>
            </div>
          </div>

          {/* System Reconciliation */}
          <div style={{ backgroundColor: isReconciled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.2)', border: `1px solid ${isReconciled ? '#059669' : '#dc2626'}`, borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: isReconciled ? '#34d399' : '#fca5a5', fontSize: '14px', marginBottom: '4px' }}>
                  {isReconciled ? '✓ SYSTEM DOUBLE-ENTRY RECONCILIATION: BALANCED' : '⚠️ HIGH VISIBILITY WARNING: UNBALANCED DISCREPANCY'}
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                  Total Ledger Sum: <strong>{formatGEL(summary.systemLedgerSumMinor)}</strong> | Reconciled Discrepancy: <strong>{formatGEL(summary.discrepancyMinor)}</strong>
                </div>
              </div>
              <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '4px', fontWeight: 600, background: isReconciled ? '#065f46' : '#991b1b', color: '#fff' }}>
                {isReconciled ? 'HEALTHY (TEST ₾0.00)' : 'INVESTIGATION REQUIRED'}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Ledger Inspection Table */}
      <h3 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Read-Only Sandbox Accounting Ledger
      </h3>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Filter by account (e.g. user:*, platform:escrow:GEL)..."
          value={accountFilter}
          onChange={(e) => onAccountFilterChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onFilterLedger(1)}
          style={{ flex: 1, minWidth: '220px', padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
        />
        <input
          type="text"
          placeholder="Filter event type (e.g. ENTRY_RESERVE, PRIZE_AWARD)..."
          value={eventFilter}
          onChange={(e) => onEventFilterChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onFilterLedger(1)}
          style={{ width: '220px', padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
        />
        <button
          type="button"
          onClick={() => onFilterLedger(1)}
          style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
        >
          Filter Ledger
        </button>
      </div>

      <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>Entry ID / Time</th>
              <th style={{ padding: '10px' }}>Account</th>
              <th style={{ padding: '10px' }}>Event Type</th>
              <th style={{ padding: '10px' }}>Competition Ref</th>
              <th style={{ padding: '10px' }}>Amount</th>
              <th style={{ padding: '10px' }}>Balance Type</th>
              <th style={{ padding: '10px' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  No ledger entries found.
                </td>
              </tr>
            ) : (
              ledger.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #1e2030' }}>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontFamily: 'monospace', color: '#64748b' }}>{entry.id.substring(0, 8)}...</div>
                    <div style={{ color: '#94a3b8', fontSize: '10px' }}>{new Date(entry.createdAt).toLocaleString()}</div>
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', color: '#38bdf8' }}>
                    {entry.accountId}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#1e293b', color: '#fbbf24', fontWeight: 600, fontSize: '10px' }}>
                      {entry.eventType}
                    </span>
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', color: '#94a3b8' }}>
                    {entry.competitionInstanceId ? entry.competitionInstanceId.substring(0, 8) + '...' : '—'}
                  </td>
                  <td style={{ padding: '10px', fontWeight: 700, color: entry.amountMinor >= 0 ? '#34d399' : '#f87171' }}>
                    {entry.amountMinor >= 0 ? `+${formatGEL(entry.amountMinor)}` : `-${formatGEL(Math.abs(entry.amountMinor))}`}
                  </td>
                  <td style={{ padding: '10px', color: '#cbd5e1' }}>{entry.balanceType}</td>
                  <td style={{ padding: '10px', color: '#94a3b8' }}>{entry.description || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>
        <div>Total: {ledgerTotal} ledger entry/entries</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            disabled={ledgerPage <= 1}
            onClick={() => onFilterLedger(ledgerPage - 1)}
            style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: ledgerPage <= 1 ? 'not-allowed' : 'pointer' }}
          >
            ← Prev
          </button>
          <span style={{ padding: '4px 8px' }}>Page {ledgerPage}</span>
          <button
            type="button"
            disabled={ledger.length < 25}
            onClick={() => onFilterLedger(ledgerPage + 1)}
            style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: ledger.length < 25 ? 'not-allowed' : 'pointer' }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// 5. Game Eligibility View
// ===========================================================================
export function CompetitionEligibilityView({
  games,
}: {
  games: GameEligibilityAdminItem[]
}) {
  return (
    <div>
      <div style={{ ...noticeBannerStyle, background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#c7d2fe' }}>
        <div>
          <strong>TEST / SANDBOX ONLY:</strong> Level 3 TEST GEL competition authority is enabled for Space Blaster and Cyber Hopper. No real-money play is active.
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, background: '#312e81', color: '#c7d2fe', padding: '3px 8px', borderRadius: '4px' }}>
          2 GAMES ENABLED
        </span>
      </div>

      <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Game ID & Title</th>
              <th style={{ padding: '12px' }}>Practice</th>
              <th style={{ padding: '12px' }}>Casual Coins</th>
              <th style={{ padding: '12px' }}>Level 3 TEST GEL</th>
              <th style={{ padding: '12px' }}>Authority Version</th>
              <th style={{ padding: '12px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.gameId} style={{ borderBottom: '1px solid #1e2030' }}>
                <td style={{ padding: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#f8fafc' }}>{g.gameId}</div>
                </td>
                <td style={{ padding: '12px', color: g.practice ? '#34d399' : '#64748b' }}>{g.practice ? 'Available' : 'Unavailable'}</td>
                <td style={{ padding: '12px', color: g.casualCoins ? '#34d399' : '#64748b' }}>{g.casualCoins ? 'Available' : 'Unavailable'}</td>
                <td style={{ padding: '12px', color: g.testGelEligible ? '#34d399' : '#fbbf24', fontWeight: 700 }}>{g.testGelEligible ? 'Level 3 certified' : g.status === 'OUT_OF_SCOPE' ? 'Outside current scope' : 'Not certified'}</td>
                <td style={{ padding: '12px', fontFamily: 'monospace', color: '#cbd5e1' }}>{g.authorityVersion || '—'}</td>
                <td style={{ padding: '12px', color: '#cbd5e1', fontSize: '12px' }}>
                  {g.technicalNotes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
