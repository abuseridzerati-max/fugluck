import type { GameEngine } from '@arcadeclash/games'

// Placeholder homepage data. Replace with real API calls once the game
// registry has entries and the matchmaking/leaderboard services exist.

export type MockGame = {
  id: string
  title: string
  engine: GameEngine
  plays: number
  rating: number
}

export const trendingGames: MockGame[] = [
  { id: 'neon-runner', title: 'Neon Runner', engine: 'runner', plays: 1250, rating: 4.9 },
  { id: 'pixel-ninja-dash', title: 'Pixel Ninja Dash', engine: 'reflex-timing', plays: 980, rating: 4.8 },
  { id: 'space-blaster', title: 'Space Blaster', engine: 'arena-shooter', plays: 1100, rating: 4.8 },
  { id: 'cyber-hopper', title: 'Cyber Hopper', engine: 'reflex-timing', plays: 1350, rating: 4.9 },
  { id: 'speed-trivia', title: 'Speed Trivia Clash', engine: 'quiz', plays: 1420, rating: 4.9 },
]

export const featuredGame: {
  id: string
  title: string
  engine: GameEngine
  tagline: string
  description: string
} = {
  id: 'neon-runner',
  title: 'Neon Runner',
  engine: 'runner',
  tagline: 'FEATURED GAME OF THE WEEK',
  description: 'Outrun the cyber collapse in a high-speed neon runner survival race!',
}

// Static placeholder until the matchmaking/WebSocket layer reports a real count.
export const liveArenaCount = 128

export const navFilters: Array<{ label: string; engine: GameEngine | 'all' | 'hot' }> = [
  { label: 'All', engine: 'all' },
  { label: 'Runner', engine: 'runner' },
  { label: 'Arena Shooter', engine: 'arena-shooter' },
  { label: 'Falling Block', engine: 'falling-block' },
  { label: 'Reflex Timing', engine: 'reflex-timing' },
  { label: 'Quiz', engine: 'quiz' },
  { label: 'Hot', engine: 'hot' },
]
