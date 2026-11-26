import { GAME_MANIFESTS, getAvailableGenres, type GameGenre } from '@fugluck/shared'
import { engineLabel } from '../lib/format'

export type CatalogGame = {
  id: string
  title: string
  engine: GameGenre
  tagline?: string
}

/** Derived from `GAME_MANIFESTS` in `@fugluck/shared`. */
export const activeGames: CatalogGame[] = GAME_MANIFESTS.map((manifest) => ({
  id: manifest.id,
  title: manifest.title,
  engine: manifest.genre,
  tagline: manifest.tagline,
}))

/** Dynamically derived genre filter pills from `GAME_MANIFESTS`. */
export const navFilters: Array<{ label: string; engine: GameGenre | 'all' }> = [
  { label: 'All', engine: 'all' },
  ...getAvailableGenres().map((genre) => ({
    label: engineLabel(genre),
    engine: genre,
  })),
]
