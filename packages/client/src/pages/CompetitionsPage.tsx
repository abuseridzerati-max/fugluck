import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGameManifest, getGameTitle } from '@fugluck/shared'
import { categoryColors } from '@fugluck/theme'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import CompetitionCatalog from '../components/CompetitionCatalog'
import GameArtwork from '../components/GameArtwork'
import LaunchModal from '../components/LaunchModal'
import LeaderboardPanel from '../components/LeaderboardPanel'
import RecentWinnersFeed from '../components/RecentWinnersFeed'
import { CoinIcon, GamepadIcon, TrophyIcon } from '../components/icons'
import { useAuth } from '../auth/AuthContext'
import { apiFetch } from '../lib/api'
import { engineLabel } from '../lib/format'
import { canViewSandboxGelUi } from '../lib/sandboxVisibility'
import { usePersonalBests } from '../lib/usePersonalBests'
import '../components/competition.css'

export default function CompetitionsPage({
  gameId,
  onPlayPractice,
  onFindOpponent,
  onLaunchGuestInvite,
  onNavigateHome,
  onNavigateProfile,
  onNavigateFriends,
  onNavigateWallet,
  onNavigateLeaderboards,
  onNavigateHistory,
  onNavigatePolicy,
}: {
  gameId: string
  onPlayPractice: (id: string, title: string) => void
  onFindOpponent: (id: string, title: string, stake?: number, currency?: 'COINS') => void
  onLaunchGuestInvite: (id: string, title: string) => void
  onNavigateHome: () => void
  onNavigateProfile: () => void
  onNavigateFriends: () => void
  onNavigateWallet: () => void
  onNavigateLeaderboards?: () => void
  onNavigateHistory?: () => void
  onNavigatePolicy?: (path: string) => void
}) {
  const { t, i18n } = useTranslation()
  const { user, refreshUser } = useAuth()
  const { bests } = usePersonalBests()
  const showSandboxGel = canViewSandboxGelUi(user)
  const [sectionTab, setSectionTab] = useState<'tournaments' | 'leaderboards'>('tournaments')
  const [mode, setMode] = useState<'COINS' | 'GEL'>('COINS')
  const activeMode: 'COINS' | 'GEL' = showSandboxGel ? mode : 'COINS'
  const [showPvpModal, setShowPvpModal] = useState(false)
  const [funding, setFunding] = useState(false)
  const [fundingError, setFundingError] = useState(false)

  useEffect(() => {
    setSectionTab('tournaments')
    setShowPvpModal(false)
  }, [gameId])

  const manifest = getGameManifest(gameId)
  const gameTitle = manifest?.title ?? getGameTitle(gameId)
  const tagColor = manifest ? categoryColors[manifest.genre] : undefined
  const personalBest = bests[gameId]
  const isTurnBasedBoard = manifest?.genre === 'turn-based-board'
  const controlsHint = t(`launch.controls.${gameId}`, { defaultValue: '' })

  async function addTestFunds() {
    setFunding(true)
    setFundingError(false)
    try {
      await apiFetch('/api/competitions/sandbox-faucet', { method: 'POST', body: JSON.stringify({ amountMinor: 10000 }) })
      await refreshUser()
    } catch {
      setFundingError(true)
    } finally {
      setFunding(false)
    }
  }

  return (
    <div className="competition-ux ac-shell" lang={i18n.resolvedLanguage}>
      <Navbar
        activePage="competitions"
        onNavigateHome={onNavigateHome}
        onNavigateProfile={onNavigateProfile}
        onNavigateFriends={onNavigateFriends}
        onNavigateWallet={onNavigateWallet}
        onNavigateLeaderboards={onNavigateLeaderboards}
        onNavigateHistory={onNavigateHistory}
      />
      <main className="competition-page ac-main">
        <div className="competition-back-row">
          <a
            href="/"
            className="ac-btn ac-btn--ghost ac-btn--sm competition-back-link"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
              e.preventDefault()
              onNavigateHome()
            }}
          >
            ← {t('gameHub.backToGames', { defaultValue: 'Back to Games' })}
          </a>
        </div>

        <section className="competition-game-hero" aria-label={gameTitle}>
          <div className="competition-game-hero__media">
            <GameArtwork gameId={gameId} thumbnailKey={manifest?.thumbnail} />
          </div>

          <div className="competition-game-hero__info">
            <div className="competition-game-hero__badges">
              {manifest && (
                <span
                  className="ac-tag"
                  style={{ ['--tag-color' as string]: tagColor }}
                >
                  {t(`home.filters.${manifest.genre}`, { defaultValue: engineLabel(manifest.genre) })}
                </span>
              )}
              {manifest?.certified && (
                <span className="ac-certified-badge" title={t('home.tournamentCertified')}>
                  <TrophyIcon size={11} />
                  <span>{t('home.certifiedBadge')}</span>
                </span>
              )}
              {typeof personalBest === 'number' && personalBest > 0 && (
                <span className="ac-pb-badge" title={t('leaderboards.personalBest', { defaultValue: 'Personal Best' })}>
                  {t('leaderboards.pbShort', { defaultValue: 'PB' })} {personalBest.toLocaleString()}
                </span>
              )}
            </div>

            <h1>{gameTitle}</h1>
            {manifest?.tagline && <p className="competition-game-hero__tagline">{manifest.tagline}</p>}
            {controlsHint && (
              <p className="competition-game-hero__controls">
                <strong>{t('launch.howToPlayLabel', { defaultValue: 'Controls:' })}</strong>{' '}
                <span>{controlsHint}</span>
              </p>
            )}

            <div className="competition-game-hero__actions" role="group" aria-label={t('gameHub.quickPlayHeading', { defaultValue: 'Quick Play' })}>
              <button
                type="button"
                className="ac-btn ac-btn--ghost"
                onClick={() => onPlayPractice(gameId, gameTitle)}
              >
                <GamepadIcon size={15} />
                <span>
                  {isTurnBasedBoard
                    ? t('gameHub.practiceAi', { defaultValue: 'Practice AI' })
                    : t('gameHub.practiceSolo', { defaultValue: 'Solo Practice' })}
                </span>
              </button>

              <button
                type="button"
                className="ac-btn ac-btn--secondary"
                onClick={() => setShowPvpModal(true)}
              >
                <CoinIcon size={15} />
                <span>{t('gameHub.pvpMatchmaking', { defaultValue: '1v1 PvP Match' })}</span>
              </button>

              <button
                type="button"
                className="ac-btn ac-btn--ghost"
                onClick={() => onLaunchGuestInvite(gameId, gameTitle)}
              >
                <span>{t('gameHub.friendMatch', { defaultValue: 'Friend Match' })}</span>
              </button>
            </div>
          </div>
        </section>

        <header className="competition-heading">
          <div>
            <h2>{t('gameHub.tournamentsHeading', { game: gameTitle, defaultValue: `${gameTitle} Tournaments` })}</h2>
            <p>{t('gameHub.tournamentsSub', { game: gameTitle, defaultValue: `Server-verified knockout brackets exclusively for ${gameTitle}.` })}</p>
          </div>
          <div className="competition-filters" role="tablist" aria-label={t('competition.title')}>
            <button
              type="button"
              role="tab"
              aria-selected={sectionTab === 'tournaments'}
              className={`ac-pill${sectionTab === 'tournaments' ? ' ac-pill--active' : ''}`}
              onClick={() => setSectionTab('tournaments')}
            >
              {t('competition.title')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sectionTab === 'leaderboards'}
              className={`ac-pill${sectionTab === 'leaderboards' ? ' ac-pill--active' : ''}`}
              onClick={() => setSectionTab('leaderboards')}
            >
              {t('leaderboards.title', { defaultValue: 'Leaderboards' })}
            </button>
            {showSandboxGel && sectionTab === 'tournaments' && (['COINS', 'GEL'] as const).map((next) => (
              <button
                key={next}
                type="button"
                aria-pressed={activeMode === next}
                className={`ac-pill${activeMode === next ? ' ac-pill--active' : ''}`}
                onClick={() => setMode(next)}
              >
                {t(`competition.modes.${next}`)}
              </button>
            ))}
          </div>
        </header>

        {sectionTab === 'leaderboards' ? (
          <>
            <RecentWinnersFeed limit={8} gameId={gameId} hideWhenEmpty />
            <div style={{ marginTop: 'var(--space-5)' }}>
              <LeaderboardPanel initialGameId={gameId} lockedGameId={gameId} limit={15} />
            </div>
          </>
        ) : (
          <>
            <RecentWinnersFeed limit={6} gameId={gameId} hideWhenEmpty />

            {activeMode === 'COINS' ? (
              <aside className="competition-notice is-coins">
                <div>
                  <strong>{t('competition.coinsLabel')}</strong>
                  <p>{t('competition.coinsNotice')}</p>
                </div>
                {user && <span className="competition-coins-balance">{user.balances.coins.toLocaleString()} COINS</span>}
              </aside>
            ) : (
              <aside className="competition-notice">
                <div>
                  <strong>{t('competition.testLabel')}</strong>
                  <p>{t('competition.testNotice')}</p>
                </div>
                {user && (
                  <button type="button" className="ac-btn ac-btn--secondary" disabled={funding} onClick={addTestFunds}>
                    {t(funding ? 'competition.addingTestFunds' : 'competition.addTestFunds')}
                  </button>
                )}
              </aside>
            )}

            {activeMode === 'GEL' && fundingError && <p role="alert">{t('competition.fundsError')}</p>}

            <CompetitionCatalog currency={activeMode} gameId={gameId} hideGameHeader />
          </>
        )}
      </main>
      <Footer onNavigate={onNavigatePolicy ?? onNavigateHome} />

      {showPvpModal && (
        <LaunchModal
          gameId={gameId}
          gameTitle={gameTitle}
          initialView="coins"
          onClose={() => setShowPvpModal(false)}
          onLaunchPractice={() => onPlayPractice(gameId, gameTitle)}
          onLaunchInviteLink={() => onLaunchGuestInvite(gameId, gameTitle)}
          onLaunchCoinsMatch={(stake) => onFindOpponent(gameId, gameTitle, stake, 'COINS')}
        />
      )}
    </div>
  )
}
