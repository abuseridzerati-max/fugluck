import { useState } from 'react'
import { GAME_COMPETITION_ELIGIBILITY_REGISTRY, type CompetitionTemplate } from '@fugluck/shared'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import CompetitionCatalog from '../components/CompetitionCatalog'

type CompetitionsPageProps = {
  onNavigateHome: () => void
  onNavigateProfile: () => void
  onNavigateFriends: () => void
  onNavigateWallet: () => void
  onLaunchCompetition: (gameId: string, template: CompetitionTemplate) => void
  onNavigatePolicy?: (path: string) => void
}

// Only games with PAID_COMPETITIVE_CANDIDATE or PAID_COMPETITIVE_APPROVED eligibility
const ELIGIBLE_GAMES = [
  { id: 'all', title: 'All Eligible Games' },
  { id: 'space-blaster', title: 'Space Blaster' },
  { id: 'neon-runner', title: 'Neon Runner' },
  { id: 'pixel-ninja-dash', title: 'Pixel Ninja Dash' },
  { id: 'cyber-hopper', title: 'Cyber Hopper' },
].filter((g) => {
  if (g.id === 'all') return true
  const el = GAME_COMPETITION_ELIGIBILITY_REGISTRY[g.id]
  return el === 'PAID_COMPETITIVE_CANDIDATE' || el === 'PAID_COMPETITIVE_APPROVED'
})

export default function CompetitionsPage({
  onNavigateHome,
  onNavigateProfile,
  onNavigateFriends,
  onNavigateWallet,
  onLaunchCompetition,
  onNavigatePolicy,
}: CompetitionsPageProps) {
  const [selectedGameId, setSelectedGameId] = useState<string>('all')

  const activeGame = ELIGIBLE_GAMES.find((g) => g.id === selectedGameId)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        onNavigateHome={onNavigateHome}
        onNavigateProfile={onNavigateProfile}
        onNavigateFriends={onNavigateFriends}
        onNavigateWallet={onNavigateWallet}
        onNavigateCompetitions={() => setSelectedGameId('all')}
      />

      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: 'var(--space-6) var(--space-4)', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h1 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-2xl)' }}>
            Sandbox Skill Competitions
          </h1>
          <p className="ac-text-muted" style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
            Compete in deterministic head-to-head skill challenges with simulated Test GEL. Replay verified by authoritative Fugluck engine.
          </p>
        </div>

        {/* Game Filter Pills */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
          {ELIGIBLE_GAMES.map((g) => {
            const isActive = selectedGameId === g.id
            return (
              <button
                key={g.id}
                type="button"
                className={`ac-pill${isActive ? ' ac-pill--active' : ''}`}
                onClick={() => setSelectedGameId(g.id)}
                style={{
                  borderColor: isActive ? '#10b981' : undefined,
                  background: isActive ? 'rgba(16, 185, 129, 0.2)' : undefined,
                  color: isActive ? '#10b981' : undefined,
                  fontWeight: isActive ? 'bold' : 'normal',
                }}
              >
                {g.title}
              </button>
            )
          })}
        </div>

        {/* Competition Catalog */}
        <CompetitionCatalog
          key={selectedGameId}
          gameId={selectedGameId === 'all' ? undefined : selectedGameId}
          gameTitle={selectedGameId === 'all' ? undefined : activeGame?.title}
          onJoinCompetition={(template) => {
            onLaunchCompetition(template.gameId, template)
          }}
        />
      </main>

      <Footer onNavigate={onNavigatePolicy ?? onNavigateHome} />
    </div>
  )
}
