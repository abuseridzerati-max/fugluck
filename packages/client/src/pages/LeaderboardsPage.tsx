import { useTranslation } from 'react-i18next'
import Footer from '../components/Footer'
import LeaderboardPanel from '../components/LeaderboardPanel'
import Navbar from '../components/Navbar'
import RecentWinnersFeed from '../components/RecentWinnersFeed'

type LeaderboardsPageProps = {
  onNavigateHome: () => void
  onNavigateProfile: () => void
  onNavigateFriends?: () => void
  onNavigateWallet?: () => void
  onNavigatePolicy?: (path: string) => void
}

export default function LeaderboardsPage({
  onNavigateHome,
  onNavigateProfile,
  onNavigateFriends,
  onNavigateWallet,
  onNavigatePolicy,
}: LeaderboardsPageProps) {
  const { t } = useTranslation()

  return (
    <div className="ac-shell">
      <Navbar
        activePage="leaderboards"
        onNavigateHome={onNavigateHome}
        onNavigateProfile={onNavigateProfile}
        onNavigateFriends={onNavigateFriends}
        onNavigateWallet={onNavigateWallet}
        onNavigateLeaderboards={() => {}}
      />
      <main className="ac-main">
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <h1 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-2xl)' }}>
            {t('leaderboards.title', { defaultValue: 'Leaderboards' })}
          </h1>
          <p className="ac-text-muted" style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
            {t('leaderboards.subtitle', { defaultValue: 'Top players ranked by highest verified score and tournament wins.' })}
          </p>
        </header>

        <RecentWinnersFeed limit={8} />
        <div style={{ marginTop: 'var(--space-5)' }}>
          <LeaderboardPanel limit={20} />
        </div>
      </main>
      <Footer onNavigate={onNavigatePolicy ?? onNavigateHome} />
    </div>
  )
}
