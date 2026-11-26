import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGameTitle, type CompetitionTemplate } from '@fugluck/shared'
import { apiFetch } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { AuthorityCompetition, type CompetitionLobbyState } from '../game-loader/AuthorityCompetition'
import { catalogPresentation, joinBlockReason, moneyLabel, publicCompetitionStatus, type CatalogRoom } from '../lib/competitionPresentation'
import { activeGames } from '../mock/homeData'
import AuthModal from './AuthModal'
import GameArtwork from './GameArtwork'
import { TrophyIcon } from './icons'
import { CompetitionDialog, CompetitionPlayerSlots, CompetitionRules, CompetitionTerms, CompetitionQualification } from './CompetitionUI'
import './competition.css'

const formatCompetitionMoney = (minor: number, currency = 'GEL') =>
  currency === 'COINS' ? `${minor.toLocaleString()} COINS` : moneyLabel(minor, currency)

const CATALOG_REQUEST_TIMEOUT_MS = 6_000

function getTierTitleKey(capacity: number): string {
  if (capacity === 2) return 'competition.tiers.cap2'
  if (capacity === 4) return 'competition.tiers.cap4'
  if (capacity === 8) return 'competition.tiers.cap8'
  if (capacity === 16) return 'competition.tiers.cap16'
  return ''
}

function getTierFallback(capacity: number): string {
  if (capacity === 2) return '2-Player Duel'
  if (capacity === 4) return '4-Player Bracket'
  if (capacity === 8) return '8-Player Knockout'
  if (capacity === 16) return '16-Player Major'
  return `${capacity}-Player Bracket`
}

export default function CompetitionCatalog({ gameId, currency = 'GEL', onClose, onShowAll }: {
  gameId?: string; gameTitle?: string; currency?: 'COINS' | 'GEL'; onClose?: () => void; onShowAll?: () => void
}) {
  const { t, i18n } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const [templates, setTemplates] = useState<CompetitionTemplate[]>([])
  const [rooms, setRooms] = useState<CatalogRoom[]>([])
  const [available, setAvailable] = useState(false)
  const [roomsKnown, setRoomsKnown] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [auth, setAuth] = useState(false)
  const [joinError, setJoinError] = useState<{ templateId: string; reason: string } | null>(null)
  const [details, setDetails] = useState<CompetitionTemplate | null>(null)
  const [activeTemplate, setActiveTemplate] = useState<CompetitionTemplate | null>(null)
  const activeTemplateRef = useRef(activeTemplate); activeTemplateRef.current = activeTemplate
  const activeCatalogRequest = useRef<AbortController | null>(null)

  function loadTemplates(quiet = false) {
    activeCatalogRequest.current?.abort()
    const controller = new AbortController(); activeCatalogRequest.current = controller
    const timer = window.setTimeout(() => controller.abort(), CATALOG_REQUEST_TIMEOUT_MS)
    if (!quiet) setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (currency === 'COINS') params.set('currency', 'COINS')
    if (gameId) params.set('gameId', gameId)
    const qs = params.toString()
    const path = qs ? `/api/competitions/templates?${qs}` : '/api/competitions/templates'
    apiFetch<{ templates: CompetitionTemplate[]; rooms?: CatalogRoom[]; playerMode?: string; joiningAvailable?: boolean }>(path, { signal: controller.signal })
      .then(res => {
        if (activeCatalogRequest.current !== controller) return
        setTemplates(res.templates.filter(template => template.enabled)); setRooms(res.rooms ?? [])
        setRoomsKnown(Array.isArray(res.rooms))
        setAvailable((currency === 'COINS' ? res.playerMode === 'coins' : res.playerMode === 'sandbox') && res.joiningAvailable === true && Array.isArray(res.rooms))
        const ownRoom = res.rooms?.find(room => room.viewerJoined && room.status === 'PENDING_ENTRANTS')
        const ownTemplate = res.templates.find(template => template.id === ownRoom?.templateId)
        if (ownRoom && ownTemplate && !activeTemplateRef.current) { sessionStorage.setItem(`authority:${ownTemplate.id}`, ownRoom.id); setActiveTemplate(ownTemplate) }
      }).catch(() => { if (activeCatalogRequest.current === controller) setError(controller.signal.aborted ? 'catalogTimeout' : 'catalogError') })
      .finally(() => { window.clearTimeout(timer); if (activeCatalogRequest.current === controller) { activeCatalogRequest.current = null; setLoading(false) } })
  }

  useEffect(() => {
    loadTemplates(); const poll = window.setInterval(() => { if (!activeCatalogRequest.current && !document.hidden) loadTemplates(true) }, 10_000)
    return () => { window.clearInterval(poll); activeCatalogRequest.current?.abort(); activeCatalogRequest.current = null }
  }, [gameId, currency, user?.id])

  useEffect(() => { activeTemplateRef.current = null; setActiveTemplate(null); setJoinError(null) }, [user?.id, currency])

  function closePlay() { activeTemplateRef.current = null; setActiveTemplate(null); loadTemplates(true) }

  function join(template: CompetitionTemplate, room?: CatalogRoom) {
    if (activeTemplateRef.current || authLoading) return
    if (!room?.viewerJoined) {
      const balanceMinor = template.currency === 'COINS' ? (user?.balances.coins ?? 0) : (user?.balances.sandboxGelMinor ?? 0)
      const reason = joinBlockReason({
        signedIn: Boolean(user), balanceMinor, entryMinor: template.entryFeeMinor,
        status: room?.status ?? 'PENDING_ENTRANTS', joined: room?.currentParticipants ?? 0, capacity: template.participantCapacity, sandbox: available
      })
      if (reason) { setJoinError({ templateId: template.id, reason: reason === 'insufficient' && template.currency === 'COINS' ? 'insufficientCoins' : reason }); if (reason === 'signIn') setAuth(true); return }
    }
    setJoinError(null)
    if (room?.viewerJoined) sessionStorage.setItem(`authority:${template.id}`, room.id)
    else sessionStorage.removeItem(`authority:${template.id}`)
    activeTemplateRef.current = template
    setActiveTemplate(template)
  }

  function catalog(lobby?: CompetitionLobbyState) {
    const visibleTemplates = activeTemplate && !templates.some(template => template.id === activeTemplate.id)
      ? [activeTemplate, ...templates]
      : templates

    const groupsMap = new Map<string, CompetitionTemplate[]>()
    for (const template of visibleTemplates) {
      const list = groupsMap.get(template.gameId) ?? []
      list.push(template)
      groupsMap.set(template.gameId, list)
    }
    const groupedGames = Array.from(groupsMap.entries()).map(([gid, items]) => ({
      gameId: gid,
      meta: activeGames.find(g => g.id === gid),
      templates: [...items].sort((a, b) => a.participantCapacity - b.participantCapacity || a.entryFeeMinor - b.entryFeeMinor),
    }))

    return <div className="competition-ux" lang={i18n.resolvedLanguage}>
      {onClose && <button type="button" className="ac-btn ac-btn--ghost" onClick={onClose}>{t('common.back')}</button>}
      {loading && !activeTemplate ? (
        <div className="competition-tier-grid" role="status" aria-label={t('competition.loading')}>
          <span className="competition-sr">{t('competition.loading')}</span>
          {[0, 1, 2, 3].map(i => <div key={i} className="competition-skeleton competition-skeleton--compact" aria-hidden="true" />)}
        </div>
      ) : error && !activeTemplate ? (
        <div className="competition-empty" role="alert">
          <p>{t(`competition.${error}`)}</p>
          <button type="button" className="ac-btn ac-btn--primary" onClick={() => loadTemplates()}>{t('competition.retry')}</button>
        </div>
      ) : visibleTemplates.length === 0 && !activeTemplate ? (
        <div className="competition-empty">
          <p>{t(gameId ? 'competition.emptyGame' : 'competition.empty', { game: getGameTitle(gameId ?? '') })}</p>
          {gameId && onShowAll ? <button type="button" className="ac-btn ac-btn--secondary" onClick={onShowAll}>{t('competition.showAll')}</button> : <span>{t('competition.checkBack')}</span>}
        </div>
      ) : (
        <div className="competition-groups">
          {groupedGames.map(({ gameId: groupGameId, meta, templates: groupTemplates }) => {
            const groupTitle = meta?.title ?? getGameTitle(groupGameId)
            return (
              <section key={groupGameId} className="competition-game-group" aria-label={groupTitle}>
                <header className="competition-game-group__header">
                  <div className="competition-game-group__thumb">
                    <GameArtwork gameId={groupGameId} />
                  </div>
                  <div className="competition-game-group__meta">
                    <div className="competition-game-group__title-row">
                      <h2>{groupTitle}</h2>
                      <span className="ac-certified-badge">
                        <TrophyIcon size={11} />
                        <span>{t('home.certifiedBadge')}</span>
                      </span>
                    </div>
                    {meta?.tagline && <p className="competition-game-group__tagline">{meta.tagline}</p>}
                  </div>
                </header>

                <div className="competition-tier-grid">
                  {groupTemplates.map(template => {
                    const isActive = activeTemplate?.id === template.id
                    const joinedInstance = isActive ? lobby?.instance : null
                    const room = joinedInstance
                      ? { ...joinedInstance, viewerJoined: joinedInstance.participants.some(p => p.userId === user?.id) }
                      : rooms.find(r => r.templateId === template.id)
                    const view = catalogPresentation(template, room)
                    const displayed = {
                      ...template,
                      entryFeeMinor: view.entryMinor,
                      currency: view.currency,
                      participantCapacity: view.capacity,
                      prizes: room ? room.prizes.map((p, i) => ({ ...p, id: `display_${i}`, templateId: template.id })) : template.prizes,
                    }
                    const tierKey = getTierTitleKey(view.capacity)
                    const tierLabel = tierKey ? t(tierKey, { defaultValue: getTierFallback(view.capacity) }) : getTierFallback(view.capacity)
                    const statusKey = available ? publicCompetitionStatus(view.status, view.joined, view.capacity) : 'unavailable'

                    return (
                      <article
                        key={template.id}
                        className={`competition-tier-card${room?.viewerJoined ? ' is-joined' : ''}`}
                        aria-label={`${view.gameName} ${tierLabel}, ${t('competition.entry')} ${view.isFree ? t('competition.free') : formatCompetitionMoney(view.entryMinor, view.currency)}, ${t('competition.prize')} ${formatCompetitionMoney(view.prizeMinor, view.currency)}`}
                      >
                        <div className="competition-tier-card__top">
                          <span className="competition-tier-badge">{tierLabel}</span>
                          <span className="competition-status">{t(`competition.status.${statusKey}`)}</span>
                        </div>

                        {template.currency !== 'COINS' && (view.isFree || view.isPromo) && (
                          <span className="competition-badge">{t(view.isFree ? 'competition.free' : 'competition.promo')}</span>
                        )}

                        <dl className="competition-tier-terms">
                          <div>
                            <dt>{t('competition.entry')}</dt>
                            <dd>{view.isFree ? t('competition.free') : formatCompetitionMoney(view.entryMinor, view.currency)}</dd>
                          </div>
                          <div>
                            <dt>{t('competition.prize')}</dt>
                            <dd className="is-prize">{formatCompetitionMoney(view.prizeMinor, view.currency)}</dd>
                          </div>
                        </dl>

                        {roomsKnown ? (
                          <CompetitionPlayerSlots joined={view.joined} capacity={view.capacity} />
                        ) : (
                          <p className="ac-text-muted" style={{ margin: 0, fontSize: 12 }}>{t('competition.playersUnavailable')}</p>
                        )}

                        <CompetitionQualification template={template} />

                        <div className="competition-tier-card__actions">
                          <button
                            type="button"
                            className={`ac-btn ac-btn--primary competition-primary${room?.viewerJoined ? ' is-joined' : ''}`}
                            disabled={
                              authLoading ||
                              Boolean(activeTemplate) ||
                              (!room?.viewerJoined &&
                                (!available ||
                                  publicCompetitionStatus(view.status, view.joined, view.capacity) !== 'open' ||
                                  Boolean(template.tournament && !['AVAILABLE', 'SIGN_IN'].includes(template.tournament.eligibility))))
                            }
                            onClick={() => join(displayed, room)}
                          >
                            {t(
                              isActive
                                ? room?.viewerJoined
                                  ? 'competition.youreIn'
                                  : 'competition.connecting'
                                : room?.viewerJoined
                                  ? 'competition.actions.view'
                                  : !available
                                    ? 'competition.status.unavailable'
                                    : view.isFree
                                      ? 'competition.joinFree'
                                      : 'competition.join',
                            )}
                          </button>
                          <button type="button" className="competition-tier-rules-btn" onClick={() => setDetails(displayed)}>
                            {t('competition.rulesDetails')}
                          </button>
                        </div>

                        {joinError?.templateId === template.id && (
                          <p className="competition-feedback" role="status">
                            {t(`competition.errors.${joinError.reason}`, { amount: formatCompetitionMoney(view.entryMinor, view.currency) })}
                          </p>
                        )}

                        {isActive && lobby && (
                          <div className="competition-card-waiting">
                            <p role="status">
                              {t(`competition.${lobby.status === 'waiting' && joinedInstance ? 'waitingPlayers' : lobby.status}`, {
                                count: Math.max(0, view.capacity - view.joined),
                              })}
                            </p>
                            {lobby.canCancel && (
                              <button type="button" className="competition-secondary" onClick={lobby.cancel}>
                                {t('competition.leaveCompetition')}
                              </button>
                            )}
                            {['waitingRetry', 'connectionError', 'errors.signIn'].includes(lobby.status) && (
                              <button type="button" className="competition-secondary" onClick={lobby.retry}>
                                {t('competition.retry')}
                              </button>
                            )}
                            {!joinedInstance && (
                              <button type="button" className="competition-secondary" onClick={closePlay}>
                                {t('common.back')}
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {auth && <AuthModal initialMode="login" onClose={() => setAuth(false)} />}
      {details && (
        <CompetitionDialog title={t('competition.rulesDetails')} onClose={() => setDetails(null)}>
          <h3>{catalogPresentation(details).gameName}</h3>
          <CompetitionTerms
            entryMinor={details.entryFeeMinor}
            prizeMinor={details.prizes?.find(p => p.placement === 1)?.amountMinor ?? 0}
            currency={details.currency}
          />
          <CompetitionRules template={details} />
        </CompetitionDialog>
      )}
    </div>
  }

  return activeTemplate ? (
    <AuthorityCompetition
      key={`${user?.id}:${activeTemplate.id}`}
      gameId={activeTemplate.gameId}
      templateId={activeTemplate.id}
      template={activeTemplate}
      onExit={closePlay}
      onComplete={() => loadTemplates(true)}
      onCancelled={closePlay}
      renderLobby={catalog}
    />
  ) : (
    catalog()
  )
}
