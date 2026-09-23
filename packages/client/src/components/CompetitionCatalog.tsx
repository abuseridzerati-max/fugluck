import { useEffect, useRef, useState } from 'react'
import { getGameTitle, type CompetitionTemplate } from '@fugluck/shared'
import { useAuth } from '../auth/AuthContext'
import { apiFetch, ApiError } from '../lib/api'
import CompetitionConfirmationModal from './CompetitionConfirmationModal'

type CompetitionCatalogProps = {
  gameId?: string
  gameTitle?: string
  onJoinCompetition: (template: CompetitionTemplate) => void
  onClose?: () => void
}

const CATALOG_REQUEST_TIMEOUT_MS = 6_000

export default function CompetitionCatalog({
  gameId,
  gameTitle,
  onJoinCompetition,
  onClose,
}: CompetitionCatalogProps) {
  const { user, refreshUser } = useAuth()
  const [templates, setTemplates] = useState<CompetitionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<CompetitionTemplate | null>(null)
  const [faucetLoading, setFaucetLoading] = useState(false)
  const activeCatalogRequest = useRef<AbortController | null>(null)

  function loadTemplates() {
    activeCatalogRequest.current?.abort()
    const controller = new AbortController()
    activeCatalogRequest.current = controller
    const timeoutId = window.setTimeout(() => controller.abort(), CATALOG_REQUEST_TIMEOUT_MS)
    setLoading(true)
    setError(null)
    const url = gameId
      ? `/api/competitions/templates?gameId=${encodeURIComponent(gameId)}`
      : '/api/competitions/templates'

    apiFetch<{ templates: CompetitionTemplate[] }>(url, { signal: controller.signal })
      .then((res) => {
        if (activeCatalogRequest.current !== controller) return
        // Only enabled templates shown per Section 4
        setTemplates((res.templates || []).filter((t) => t.enabled))
      })
      .catch((err) => {
        if (activeCatalogRequest.current !== controller) return
        if (controller.signal.aborted) {
          setError('The competition catalog took too long to respond. Check your connection and retry.')
        } else if (err instanceof ApiError && (err.status === 404 || err.status >= 500)) {
          setError('The competition catalog is temporarily unavailable. Please retry in a moment.')
        } else {
          setError(err instanceof ApiError ? err.message : 'Failed to load competitions. Please retry.')
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
        if (activeCatalogRequest.current === controller) {
          activeCatalogRequest.current = null
          setLoading(false)
        }
      })
  }

  useEffect(() => {
    loadTemplates()
    return () => {
      activeCatalogRequest.current?.abort()
      activeCatalogRequest.current = null
    }
  }, [gameId])

  async function handleAddTestFunds() {
    setFaucetLoading(true)
    try {
      await apiFetch('/api/competitions/sandbox-faucet', {
        method: 'POST',
        body: JSON.stringify({ amountMinor: 10000 }),
      })
      await refreshUser()
    } catch {
      // Ignored in quick faucet button
    } finally {
      setFaucetLoading(false)
    }
  }

  const userBalanceMinor = user?.balances.sandboxGelMinor ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Persistent Sandbox Identity Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 2 }}>
            <span
              style={{
                background: '#10b981',
                color: '#000',
                fontSize: '10px',
                fontWeight: 'bold',
                padding: '2px 6px',
                borderRadius: '4px',
                letterSpacing: '1px',
              }}
            >
              TEST / SANDBOX GEL
            </span>
            <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
              SANDBOX SKILL COMPETITIONS
            </strong>
          </div>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>
            All competitions use simulated Test GEL. No real money is used, deposited, withdrawn, or awarded.
          </p>
        </div>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                SANDBOX TEST BALANCE
              </div>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: '#10b981' }}>
                TEST ₾{(userBalanceMinor / 100).toFixed(2)}
              </div>
            </div>
            <button
              type="button"
              className="ac-btn ac-btn--secondary"
              disabled={faucetLoading}
              onClick={handleAddTestFunds}
              title="Adds simulated sandbox funds. No real money is charged."
              style={{ fontSize: '11px', padding: '4px 10px', whiteSpace: 'nowrap' }}
            >
              {faucetLoading ? 'Adding…' : '[ ADD TEST FUNDS ]'}
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '11px',
              color: '#fca5a5',
            }}
          >
            Free competitions have no entry cost. An account is required to enter any competition; paid sandbox competitions also require enough Test GEL.
          </div>
        )}
      </div>

      {/* Catalog Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>
            {gameTitle ? `${gameTitle} Competitions` : 'Available Competitions'}
          </h3>
          <p className="ac-text-muted" style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)' }}>
            Platform-defined formats • Predetermined prizes • Server-verified skill
          </p>
        </div>
        {onClose && (
          <button type="button" className="ac-btn ac-btn--ghost" onClick={onClose} style={{ padding: 'var(--space-1) var(--space-3)' }}>
            Back
          </button>
        )}
      </div>

      {/* Loading / Error / Empty States */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
          Loading competition catalog…
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: '#f87171' }}>
          <p style={{ margin: '0 0 var(--space-3)' }}>{error}</p>
          <button type="button" className="ac-btn ac-btn--primary" onClick={loadTemplates}>
            Retry
          </button>
        </div>
      ) : templates.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            background: 'var(--color-surface-raised)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--color-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          No active sandbox competitions available for this game right now.
        </div>
      ) : (
        /* Template Cards Grid */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {templates.map((tmpl) => {
            const isFree = tmpl.entryFeeMinor === 0
            const entryText = isFree
              ? 'FREE'
              : `TEST ₾${(tmpl.entryFeeMinor / 100).toFixed(2)}`
            const prizeAmountMinor = tmpl.prizes?.[0]?.amountMinor ?? 0
            const prizeText = prizeAmountMinor > 0
              ? `TEST ₾${(prizeAmountMinor / 100).toFixed(2)}`
              : '—'
            const isPromo = tmpl.title.toLowerCase().includes('promo')
            const gameName = getGameTitle(tmpl.gameId)
            const formatLabel = tmpl.format.replace(/_/g, ' ')

            return (
              <div
                key={tmpl.id}
                className="ac-card"
                style={{
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isPromo
                    ? '1px solid rgba(168, 85, 247, 0.5)'
                    : isFree
                    ? '1px solid rgba(56, 189, 248, 0.4)'
                    : '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: 'var(--space-2)' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isPromo
                          ? 'rgba(168, 85, 247, 0.15)'
                          : isFree
                          ? 'rgba(56, 189, 248, 0.15)'
                          : 'rgba(255, 255, 255, 0.05)',
                        color: isPromo ? '#c084fc' : isFree ? '#38bdf8' : 'var(--color-text-muted)',
                        fontWeight: 'bold',
                      }}
                    >
                      {isPromo ? 'PROMOTIONAL' : isFree ? 'FREEROLL' : 'STANDARD'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, letterSpacing: '0.04em' }}>
                      OPEN FOR ENTRIES
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 4px', fontSize: 'var(--font-size-base)' }}>
                    {tmpl.title}
                  </h4>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {formatLabel} · Up to {tmpl.participantCapacity} players
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                    🎮 {gameName}
                  </div>

                  {/* Financial Terms */}
                  <div
                    style={{
                      background: 'var(--color-surface-raised, #1a1a24)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      margin: 'var(--space-3) 0',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 'var(--space-2)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ padding: '8px 4px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(148, 163, 184, 0.22)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>ENTRY COST</div>
                      <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-sm)', color: isFree ? '#38bdf8' : 'var(--color-text)' }}>
                        {entryText}
                      </div>
                    </div>
                    <div style={{ padding: '8px 4px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.35)', background: 'rgba(16, 185, 129, 0.07)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>PREDETERMINED PRIZE</div>
                      <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-sm)', color: '#10b981' }}>
                        {prizeText}
                      </div>
                    </div>
                  </div>

                  {isPromo && (
                    <div style={{ fontSize: '10px', color: '#c084fc', marginBottom: 'var(--space-2)' }}>
                      ★ Promotional Sandbox Prize
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className={`ac-btn ${isPromo ? 'ac-btn--secondary' : 'ac-btn--primary'}`}
                  onClick={() => setSelectedTemplate(tmpl)}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    marginTop: 'var(--space-2)',
                  }}
                >
                  {isFree ? 'JOIN FREE COMPETITION' : 'JOIN COMPETITION'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedTemplate && (
        <CompetitionConfirmationModal
          template={selectedTemplate}
          gameTitle={gameTitle || getGameTitle(selectedTemplate.gameId)}
          onClose={() => setSelectedTemplate(null)}
          onConfirm={() => {
            const tmpl = selectedTemplate
            setSelectedTemplate(null)
            onJoinCompetition(tmpl)
          }}
        />
      )}
    </div>
  )
}
