import type { ReactNode } from 'react'
import { getGameManifest } from '@fugluck/shared'

type GameArtworkProps = {
  gameId: string
  thumbnailKey?: string
}

const ARTWORK_BY_KEY: Readonly<Record<string, () => ReactNode>> = {
  'space-blaster': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#09101a" />
      <radialGradient id="sb-glow" cx="50%" cy="55%" r="55%">
        <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
        <stop offset="100%" stopColor="#09101a" stopOpacity="0" />
      </radialGradient>
      <rect width="320" height="180" fill="url(#sb-glow)" />
      <g stroke="#1e2d45" strokeWidth="1">
        <circle cx="160" cy="94" r="56" strokeDasharray="4 6" />
        <circle cx="160" cy="94" r="88" strokeDasharray="2 8" />
      </g>
      <g fill="#38bdf8" opacity="0.65">
        <circle cx="44" cy="36" r="1.5" />
        <circle cx="272" cy="42" r="2" />
        <circle cx="246" cy="144" r="1.5" />
        <circle cx="72" cy="138" r="1.5" />
        <circle cx="118" cy="28" r="1.2" />
        <circle cx="204" cy="24" r="1.2" />
      </g>
      <path d="M58 46l12-10 18 6 6 17-13 13-18-6-5-20Z" fill="#182436" stroke="#334866" strokeWidth="1.5" />
      <path d="M234 114l14-12 20 4 7 16-14 14-19-5-8-17Z" fill="#182436" stroke="#334866" strokeWidth="1.5" />
      <path d="M160 36l17 50 28 30-39-8-6 9-6-9-39 8 28-30 17-50Z" fill="#10b981" />
      <path d="M160 54l8 34-8 14-8-14 8-34Z" fill="#d1fae5" />
      <path d="M148 114l4 24 5-18m6 0 5 18 4-24" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M160 12v14M132 54v-12M188 54v-12" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),

  'cyber-hopper': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#091219" />
      <rect x="0" y="34" width="320" height="42" fill="#0f1b29" />
      <rect x="0" y="102" width="320" height="42" fill="#0f1b29" />
      <path d="M14 55h34m36 0h34m36 0h34m36 0h34m36 0h26M0 123h34m36 0h34m36 0h34m36 0h34m36 0h34" stroke="#243752" strokeWidth="2" strokeDasharray="10 10" />
      <rect x="36" y="42" width="54" height="26" rx="7" fill="#38bdf8" fillOpacity="0.22" stroke="#38bdf8" strokeWidth="1.75" />
      <rect x="218" y="42" width="44" height="26" rx="7" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
      <rect x="210" y="110" width="60" height="26" rx="7" fill="#f59e0b" fillOpacity="0.2" stroke="#f59e0b" strokeWidth="1.75" />
      <rect x="52" y="110" width="46" height="26" rx="7" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
      <path d="M160 54l24 28-5 27-19 16-19-16-5-27 24-28Z" fill="#10b981" />
      <path d="M150 72l10-10 10 10-4 24h-12l-4-24Z" fill="#06221a" />
      <path d="M152 124v16m16-16v16" stroke="#34d399" strokeWidth="4" strokeLinecap="round" />
    </svg>
  ),

  'neon-runner': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#080d16" />
      <path d="M0 132h320" stroke="#10b981" strokeWidth="2" />
      <path d="M0 148h320M0 166h320" stroke="#162336" strokeWidth="1.5" />
      <path d="M40 132L8 180M100 132L82 180M160 132v48M220 132l18 48M280 132l32 48" stroke="#162336" strokeWidth="1.5" />
      <rect x="196" y="88" width="16" height="44" rx="3" fill="#f43f5e" fillOpacity="0.25" stroke="#f43f5e" strokeWidth="2" />
      <rect x="254" y="102" width="14" height="30" rx="3" fill="#f59e0b" fillOpacity="0.25" stroke="#f59e0b" strokeWidth="2" />
      <path d="M64 116c24-44 58-52 94-26" stroke="#10b981" strokeWidth="2.5" strokeDasharray="6 6" strokeLinecap="round" />
      <circle cx="116" cy="70" r="10" fill="#34d399" />
      <path d="M104 86l18-6 14 14-12 16-14-6-16 14" stroke="#d1fae5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  'pixel-ninja-dash': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#090d15" />
      <circle cx="248" cy="48" r="24" fill="#f59e0b" fillOpacity="0.16" stroke="#f59e0b" strokeOpacity="0.5" strokeWidth="1.5" />
      <path d="M0 134h96v46H0zM130 116h86v64h-86zM236 140h84v40h-84z" fill="#131c2b" stroke="#25344d" strokeWidth="1.5" />
      <path d="M68 118l48-30 32 14" stroke="#a3e635" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 5" />
      <rect x="136" y="76" width="22" height="22" rx="5" fill="#10b981" />
      <rect x="142" y="83" width="14" height="5" rx="2" fill="#04130d" />
      <path d="M136 86l-20 4 14 6" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
      <path d="M212 72l8 4-8 4-4 8-4-8-8-4 8-4 4-8 4 8Z" fill="#e2e8f0" opacity="0.85" />
    </svg>
  ),

  'speed-trivia': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#08101a" />
      <rect x="38" y="30" width="244" height="120" rx="12" fill="#0e1726" stroke="#22324a" strokeWidth="1.5" />
      <rect x="56" y="46" width="146" height="10" rx="5" fill="#23344f" />
      <rect x="218" y="44" width="46" height="14" rx="7" fill="#f59e0b" fillOpacity="0.22" stroke="#f59e0b" strokeWidth="1.5" />
      <rect x="56" y="74" width="98" height="26" rx="6" fill="#10b981" fillOpacity="0.22" stroke="#10b981" strokeWidth="1.75" />
      <rect x="166" y="74" width="98" height="26" rx="6" fill="#142033" stroke="#263854" strokeWidth="1.25" />
      <rect x="56" y="110" width="98" height="26" rx="6" fill="#142033" stroke="#263854" strokeWidth="1.25" />
      <rect x="166" y="110" width="98" height="26" rx="6" fill="#142033" stroke="#263854" strokeWidth="1.25" />
      <path d="M70 87l5 5 11-11" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  'tf-sprint': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#080f18" />
      <rect x="44" y="34" width="232" height="10" rx="5" fill="#162235" />
      <rect x="44" y="34" width="148" height="10" rx="5" fill="#38bdf8" />
      <rect x="44" y="62" width="106" height="84" rx="12" fill="#10b981" fillOpacity="0.16" stroke="#10b981" strokeWidth="2" />
      <path d="M78 105l13 13 26-28" stroke="#34d399" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="170" y="62" width="106" height="84" rx="12" fill="#f43f5e" fillOpacity="0.14" stroke="#f43f5e" strokeWidth="2" />
      <path d="M207 88l32 32m0-32l-32 32" stroke="#fb7185" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  ),
}

export default function GameArtwork({ gameId, thumbnailKey }: GameArtworkProps) {
  const key = thumbnailKey ?? getGameManifest(gameId)?.thumbnail ?? gameId
  const render = ARTWORK_BY_KEY[key] ?? ARTWORK_BY_KEY['tf-sprint']
  return <>{render()}</>
}
