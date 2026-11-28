import { useTranslation } from 'react-i18next'
import type { CompetitionTemplate } from '@fugluck/shared'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import MyCompetitions from '../components/MyCompetitions'
import '../components/competition.css'

export default function HistoryPage({
  onNavigateHome,
  onNavigateProfile,
  onNavigateFriends,
  onNavigateWallet,
  onNavigateLeaderboards,
  onNavigateHistory,
  onLaunchCompetition,
  onNavigatePolicy,
}: {
  onNavigateHome: () => void
  onNavigateProfile: () => void
  onNavigateFriends: () => void
  onNavigateWallet: () => void
  onNavigateLeaderboards?: () => void
  onNavigateHistory?: () => void
  onLaunchCompetition: (gameId: string, template: CompetitionTemplate) => void
  onNavigatePolicy?: (path: string) => void
}) {
  const { t, i18n } = useTranslation()

  return (
    <div className="competition-ux ac-shell" lang={i18n.resolvedLanguage}>
      <Navbar
        activePage="history"
        onNavigateHome={onNavigateHome}
        onNavigateProfile={onNavigateProfile}
        onNavigateFriends={onNavigateFriends}
        onNavigateWallet={onNavigateWallet}
        onNavigateLeaderboards={onNavigateLeaderboards}
        onNavigateHistory={onNavigateHistory}
      />
      <main className="competition-page ac-main">
        <header className="competition-heading">
          <div>
            <h1>{t('historyPage.title')}</h1>
            <p>{t('historyPage.subtitle')}</p>
          </div>
        </header>

        <MyCompetitions onLaunch={(template) => onLaunchCompetition(template.gameId, template)} />
      </main>
      <Footer onNavigate={onNavigatePolicy ?? onNavigateHome} />
    </div>
  )
}
