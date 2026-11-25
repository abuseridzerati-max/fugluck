import type { GameEngine } from '@fugluck/games'

export function engineLabel(engine: GameEngine): string {
  return engine
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}
