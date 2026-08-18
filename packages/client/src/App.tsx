import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameModuleFactory, InviteReceivedPayload } from '@arcadeclash/shared'
import { AuthProvider } from './auth/AuthContext'
import GameLoader from './game-loader/GameLoader'
import { gameFactories } from './game-loader/gameFactories'
import MatchLoader from './game-loader/MatchLoader'
import { InviteProvider } from './invites/InviteProvider'
import type { MatchSocketMode } from './matchmaking/useMatchSocket'
import AdminConsolePage from './admin/AdminConsolePage'
import FriendsPage from './pages/FriendsPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import ProfilePage from './pages/ProfilePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'

type ActiveGame = {
  id: string
  title: string
  factory: GameModuleFactory
  mode: 'practice' | 'match'
  matchMode?: MatchSocketMode
}
type View = 'home' | 'profile' | 'friends' | 'wallet' | 'settings' | 'login' | 'signup' | 'admin' | 'verify-email' | 'reset-password' | 'not-found'

const GAME_TITLES: Record<string, string> = {
  'neon-runner': 'Neon Runner',
  'pixel-ninja-dash': 'Pixel Ninja Dash',
  'space-blaster': 'Space Blaster',
  'cyber-hopper': 'Cyber Hopper',
  'speed-trivia': 'Speed Trivia Clash',
  'tf-sprint': 'True / False Sprint',
}

const ACTIVE_MATCH_STORAGE_KEY = 'arcadeclash_active_match'

type StoredActiveMatch = { id: string; title: string }

function storeActiveMatch(match: StoredActiveMatch | null) {
  try {
    if (match) sessionStorage.setItem(ACTIVE_MATCH_STORAGE_KEY, JSON.stringify(match))
    else sessionStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY)
  } catch {
    // A disabled storage surface should not prevent ordinary matchmaking.
  }
}

function readStoredActiveMatch(): StoredActiveMatch | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_MATCH_STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<StoredActiveMatch>
    if (typeof value.id !== 'string' || typeof value.title !== 'string' || !gameFactories[value.id]) {
      storeActiveMatch(null)
      return null
    }
    return { id: value.id, title: value.title }
  } catch {
    storeActiveMatch(null)
    return null
  }
}

function getViewFromPath(pathname: string): View {
  const cleanPath = pathname.replace(/\/$/, '') || '/'
  if (cleanPath === '/' || cleanPath === '/home') return 'home'
  if (cleanPath === '/profile') return 'profile'
  if (cleanPath === '/friends') return 'friends'
  if (cleanPath === '/wallet') return 'wallet'
  if (cleanPath === '/settings') return 'settings'
  if (cleanPath === '/login') return 'login'
  if (cleanPath === '/signup') return 'signup'
  if (cleanPath === '/admin') return 'admin'
  if (cleanPath === '/verify-email') return 'verify-email'
  if (cleanPath === '/reset-password') return 'reset-password'
  return 'not-found'
}

function getPathForView(view: View): string {
  switch (view) {
    case 'profile':
      return '/profile'
    case 'friends':
      return '/friends'
    case 'wallet':
      return '/wallet'
    case 'settings':
      return '/settings'
    case 'login':
      return '/login'
    case 'signup':
      return '/signup'
    case 'admin':
      return '/admin'
    case 'verify-email':
      return '/verify-email'
    case 'reset-password':
      return '/reset-password'
    case 'home':
      return '/'
    case 'not-found':
    default:
      return window.location.pathname
  }
}

function updateSocialMetaTags(title: string, path: string) {
  const baseUrl = 'https://arcadeclash.com'
  const fullUrl = `${baseUrl}${path}`

  const ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle) ogTitle.setAttribute('content', title)

  const twitterTitle = document.querySelector('meta[name="twitter:title"]')
  if (twitterTitle) twitterTitle.setAttribute('content', title)

  const ogUrl = document.querySelector('meta[property="og:url"]')
  if (ogUrl) ogUrl.setAttribute('content', fullUrl)

  const canonical = document.querySelector('link[rel="canonical"]')
  if (canonical) canonical.setAttribute('href', fullUrl)
}

function AppShell() {
  const { t, i18n } = useTranslation()
  const [view, setViewState] = useState<View>(() => getViewFromPath(window.location.pathname))
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null)
  const [loadingGameId, setLoadingGameId] = useState<string | null>(null)
  const [restoringActiveMatch, setRestoringActiveMatch] = useState(() => readStoredActiveMatch() !== null)

  useEffect(() => {
    const stored = readStoredActiveMatch()
    if (stored) {
      void loadGame(stored.id, stored.title, 'match', { kind: 'resume' }).finally(() => setRestoringActiveMatch(false))
    } else {
      setRestoringActiveMatch(false)
    }
    // Restore once on boot. The server remains authoritative for whether the
    // authenticated user actually has an active match and for its seed/id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getTitleForView(targetView: View): string {
    switch (targetView) {
      case 'profile':
        return t('meta.titleProfile')
      case 'friends':
        return t('meta.titleFriends')
      case 'wallet':
        return t('meta.titleWallet')
      case 'settings':
        return t('meta.titleSettings')
      case 'login':
        return t('meta.titleLogin')
      case 'signup':
        return t('meta.titleSignup')
      case 'admin':
        return t('meta.titleAdmin')
      case 'verify-email':
        return 'ArcadeClash — Verify Account'
      case 'reset-password':
        return 'ArcadeClash — Reset Password'
      case 'not-found':
        return t('meta.titleNotFound')
      case 'home':
      default:
        return t('meta.titleHome')
    }
  }

  useEffect(() => {
    const title = getTitleForView(view)
    const path = getPathForView(view)
    document.title = title
    updateSocialMetaTags(title, path)
  }, [view, i18n.language, t])

  useEffect(() => {
    const handlePopState = () => {
      const newView = getViewFromPath(window.location.pathname)
      setViewState(newView)
      const title = getTitleForView(newView)
      const path = getPathForView(newView)
      document.title = title
      updateSocialMetaTags(title, path)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [i18n.language, t])

  function navigateTo(targetView: View) {
    setViewState(targetView)
    const targetPath = getPathForView(targetView)
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath)
    }
    const title = getTitleForView(targetView)
    document.title = title
    updateSocialMetaTags(title, targetPath)
  }

  async function loadGame(
    id: string,
    title: string,
    mode: 'practice' | 'match',
    matchMode?: MatchSocketMode,
  ) {
    const loadFactory = gameFactories[id]
    if (!loadFactory) return
    setLoadingGameId(id)
    const mod = await loadFactory()
    setLoadingGameId(null)
    setActiveGame({ id, title, factory: mod.default, mode, matchMode })
  }

  function handlePlayGame(id: string, title: string) {
    return loadGame(id, title, 'practice')
  }

  function handleFindOpponent(id: string, title: string, stake?: number, currency?: 'COINS' | 'DIAMONDS') {
    storeActiveMatch({ id, title })
    return loadGame(id, title, 'match', { kind: 'queue', stake, currency })
  }

  function handleInviteFriend(friendUserId: string, gameId: string, gameTitle: string) {
    storeActiveMatch({ id: gameId, title: gameTitle })
    return loadGame(gameId, gameTitle, 'match', { kind: 'sendInvite', friendUserId })
  }

  function handleAcceptInvite(invite: InviteReceivedPayload) {
    const title = GAME_TITLES[invite.gameId] ?? invite.gameId
    storeActiveMatch({ id: invite.gameId, title })
    void loadGame(invite.gameId, title, 'match', { kind: 'acceptInvite', inviteId: invite.inviteId })
  }

  const clearActiveMatch = useCallback(() => {
    storeActiveMatch(null)
  }, [])

  return (
    <InviteProvider
      onAcceptInvite={handleAcceptInvite}
      enabled={!restoringActiveMatch && (!activeGame || activeGame.mode === 'practice')}
    >
      {activeGame?.mode === 'practice' ? (
        <GameLoader
          key={activeGame.id}
          createModule={activeGame.factory}
          gameTitle={activeGame.title}
          onExit={() => setActiveGame(null)}
        />
      ) : activeGame?.mode === 'match' ? (
        <MatchLoader
          key={`${activeGame.id}-${activeGame.matchMode?.kind ?? 'queue'}`}
          createModule={activeGame.factory}
          gameTitle={activeGame.title}
          gameId={activeGame.id}
          matchMode={activeGame.matchMode}
          onMatchResolved={clearActiveMatch}
          onExit={() => {
            clearActiveMatch()
            setActiveGame(null)
          }}
        />
      ) : view === 'profile' || view === 'wallet' || view === 'settings' ? (
        <ProfilePage
          onNavigateHome={() => navigateTo('home')}
          onNavigateFriends={() => navigateTo('friends')}
        />
      ) : view === 'admin' ? (
        <AdminConsolePage onNavigateHome={() => navigateTo('home')} />
      ) : view === 'friends' ? (
        <FriendsPage
          onNavigateHome={() => navigateTo('home')}
          onNavigateProfile={() => navigateTo('profile')}
          onInviteFriend={handleInviteFriend}
        />
      ) : view === 'verify-email' ? (
        <VerifyEmailPage
          onNavigateHome={() => navigateTo('home')}
          onNavigateLogin={() => navigateTo('login')}
        />
      ) : view === 'reset-password' ? (
        <ResetPasswordPage
          onNavigateHome={() => navigateTo('home')}
          onNavigateLogin={() => navigateTo('login')}
        />
      ) : view === 'not-found' ? (
        <NotFoundPage
          onNavigateHome={() => navigateTo('home')}
          onNavigateProfile={() => navigateTo('profile')}
          onNavigateFriends={() => navigateTo('friends')}
          onPlayGame={handlePlayGame}
          onFindOpponent={handleFindOpponent}
        />
      ) : (
        <HomePage
          onPlayGame={handlePlayGame}
          onFindOpponent={handleFindOpponent}
          loadingGameId={loadingGameId}
          onNavigateProfile={() => navigateTo('profile')}
          onNavigateFriends={() => navigateTo('friends')}
          initialAuthModalMode={view === 'login' ? 'login' : view === 'signup' ? 'signup' : undefined}
        />
      )}
    </InviteProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
