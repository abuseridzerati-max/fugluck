import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GAME_COMPETITION_CERTIFICATIONS, getGameTitle, type CompetitionTemplate } from '@fugluck/shared'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import CompetitionCatalog from '../components/CompetitionCatalog'
import MyCompetitions from '../components/MyCompetitions'
import { useAuth } from '../auth/AuthContext'
import { apiFetch } from '../lib/api'
import { canViewSandboxGelUi } from '../lib/sandboxVisibility'
import '../components/competition.css'

const CERTIFIED_GAME_IDS = Object.entries(GAME_COMPETITION_CERTIFICATIONS)
  .filter(([, cert]) => cert.testGelCompetition === 'LEVEL_3_CERTIFIED')
  .map(([id]) => id)

function readGameFilterFromUrl(): string {
  if (typeof window === 'undefined') return 'all'
  const param = new URLSearchParams(window.location.search).get('game')?.trim()
  if (param && CERTIFIED_GAME_IDS.includes(param)) return param
  return 'all'
}

export default function CompetitionsPage({
  onNavigateHome,
  onNavigateProfile,
  onNavigateFriends,
  onNavigateWallet,
  onLaunchCompetition,
  onNavigatePolicy,
}: {
  onNavigateHome: () => void
  onNavigateProfile: () => void
  onNavigateFriends: () => void
  onNavigateWallet: () => void
  onLaunchCompetition: (gameId: string, template: CompetitionTemplate) => void
  onNavigatePolicy?: (path: string) => void
}) {
  const { t, i18n } = useTranslation()
  const { user, refreshUser } = useAuth()
  const showSandboxGel = canViewSandboxGelUi(user)
  const [mode, setMode] = useState<'COINS' | 'GEL'>('COINS')
  const activeMode: 'COINS' | 'GEL' = showSandboxGel ? mode : 'COINS'
  const [game, setGameState] = useState<string>(() => readGameFilterFromUrl())
  const [funding, setFunding] = useState(false)
  const [fundingError, setFundingError] = useState(false)

  useEffect(() => {
    const syncFromUrl = () => setGameState(readGameFilterFromUrl())
    window.addEventListener('popstate', syncFromUrl)
    return () => window.removeEventListener('popstate', syncFromUrl)
  }, [])

  function setGame(nextGame: string) {
    setGameState(nextGame)
    if (typeof window !== 'undefined') {
      const nextUrl = nextGame === 'all' ? '/competitions' : `/competitions?game=${encodeURIComponent(nextGame)}`
      if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
        window.history.replaceState(null, '', nextUrl)
      }
    }
  }

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
        onNavigateCompetitions={() => setGame('all')}
      />
      <main className="competition-page ac-main">
        <header className="competition-heading">
          <div>
            <h1>{t('competition.title')}</h1>
            <p>{t('competition.tagline')}</p>
          </div>
          {showSandboxGel && (
            <div className="competition-filters" role="group" aria-label={t('competition.modeLabel')}>
              {(['COINS', 'GEL'] as const).map((next) => (
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
          )}
        </header>

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

        <div className="competition-filters" role="group" aria-label={t('competition.filterGames')}>
          <button
            type="button"
            aria-pressed={game === 'all'}
            className={`ac-pill${game === 'all' ? ' ac-pill--active' : ''}`}
            onClick={() => setGame('all')}
          >
            {t('competition.all')}
          </button>
          {CERTIFIED_GAME_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={game === id}
              className={`ac-pill${game === id ? ' ac-pill--active' : ''}`}
              onClick={() => setGame(id)}
            >
              {getGameTitle(id)}
            </button>
          ))}
        </div>

        <CompetitionCatalog currency={activeMode} gameId={game === 'all' ? undefined : game} onShowAll={() => setGame('all')} />
        <MyCompetitions onLaunch={(template) => onLaunchCompetition(template.gameId, template)} />
      </main>
      <Footer onNavigate={onNavigatePolicy ?? onNavigateHome} />
    </div>
  )
}
