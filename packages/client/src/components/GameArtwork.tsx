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

  'stack-tower': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#070a10" />
      <g stroke="#18263a" strokeWidth="1">
        <path d="M80 0v180M160 0v180M240 0v180M0 45h320M0 90h320M0 135h320" />
      </g>
      <rect x="92" y="142" width="136" height="38" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
      <rect x="96" y="122" width="128" height="18" rx="2" fill="#10b981" stroke="#d1fae5" strokeWidth="1.2" />
      <rect x="104" y="102" width="112" height="18" rx="2" fill="#06b6d4" stroke="#cffafe" strokeWidth="1.2" />
      <rect x="110" y="82" width="100" height="18" rx="2" fill="#8b5cf6" stroke="#ede9fe" strokeWidth="1.2" />
      <rect x="114" y="62" width="92" height="18" rx="2" fill="#ec4899" stroke="#fce7f3" strokeWidth="1.2" />
      <rect x="148" y="34" width="92" height="18" rx="2" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.75" />
      <path d="M114 54v14M206 54v14" stroke="#34d399" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />
      <rect x="220" y="108" width="22" height="14" rx="2" fill="#ec4899" opacity="0.45" transform="rotate(18 220 108)" />
    </svg>
  ),

  '2048-blitz': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#070a10" />
      <rect x="86" y="16" width="148" height="148" rx="10" fill="#0d1422" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="1.75" />
      <rect x="96" y="26" width="30" height="30" rx="5" fill="#17253b" stroke="#38bdf8" strokeWidth="1.2" />
      <rect x="131" y="26" width="30" height="30" rx="5" fill="#132f3a" stroke="#06b6d4" strokeWidth="1.2" />
      <rect x="166" y="26" width="30" height="30" rx="5" fill="#0d352d" stroke="#10b981" strokeWidth="1.2" />
      <rect x="201" y="26" width="24" height="30" rx="5" fill="#131d30" />
      <rect x="96" y="61" width="30" height="30" rx="5" fill="#131d30" />
      <rect x="131" y="61" width="30" height="30" rx="5" fill="#3a2710" stroke="#f59e0b" strokeWidth="1.5" />
      <rect x="166" y="61" width="30" height="30" rx="5" fill="#3f1224" stroke="#f43f5e" strokeWidth="1.5" />
      <rect x="201" y="61" width="24" height="30" rx="5" fill="#291445" stroke="#a855f7" strokeWidth="1.5" />
      <rect x="96" y="96" width="65" height="58" rx="7" fill="#0f3a36" stroke="#34d399" strokeWidth="2" />
      <text x="128" y="131" textAnchor="middle" fill="#ffffff" fontFamily="monospace" fontWeight="bold" fontSize="18">2048</text>
      <rect x="166" y="96" width="30" height="30" rx="5" fill="#1d1b4b" stroke="#6366f1" strokeWidth="1.5" />
      <rect x="201" y="96" width="24" height="30" rx="5" fill="#3b1236" stroke="#ec4899" strokeWidth="1.5" />
      <rect x="166" y="131" width="59" height="23" rx="5" fill="#131d30" stroke="#10b981" strokeOpacity="0.6" strokeWidth="1.2" />
    </svg>
  ),

  'neon-snake': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#070a10" />
      <rect x="24" y="18" width="272" height="144" rx="8" fill="#0a101d" stroke="#10b981" strokeOpacity="0.45" strokeWidth="1.75" />
      <g stroke="#162336" strokeWidth="1">
        <path d="M64 18v144M104 18v144M144 18v144M184 18v144M224 18v144M264 18v144M24 54h272M24 90h272M24 126h272" />
      </g>
      <rect x="68" y="110" width="24" height="20" rx="4" fill="#06b6d4" />
      <rect x="96" y="110" width="24" height="20" rx="4" fill="#10b981" />
      <rect x="124" y="110" width="24" height="20" rx="4" fill="#06b6d4" />
      <rect x="124" y="84" width="24" height="22" rx="4" fill="#10b981" />
      <rect x="124" y="58" width="24" height="22" rx="4" fill="#06b6d4" />
      <rect x="152" y="58" width="24" height="22" rx="4" fill="#10b981" />
      <rect x="180" y="56" width="28" height="26" rx="5" fill="#34d399" stroke="#ffffff" strokeWidth="1.75" />
      <rect x="197" y="62" width="4" height="4" fill="#070a10" />
      <rect x="197" y="72" width="4" height="4" fill="#070a10" />
      <circle cx="246" cy="69" r="13" fill="#ec4899" fillOpacity="0.28" />
      <circle cx="246" cy="69" r="8" fill="#ec4899" />
      <circle cx="243" cy="66" r="2.5" fill="#ffffff" />
      <circle cx="238" cy="126" r="10" fill="#f59e0b" fillOpacity="0.26" stroke="#fde047" strokeWidth="1.5" />
      <circle cx="238" cy="126" r="5" fill="#f59e0b" />
    </svg>
  ),

  'minesweeper-sprint': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#070a10" />
      <rect x="44" y="18" width="232" height="144" rx="8" fill="#0b1220" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="1.75" />
      <g>
        <rect x="56" y="30" width="38" height="36" rx="4" fill="#0d1526" stroke="#1e293b" strokeWidth="1.2" />
        <text x="75" y="54" textAnchor="middle" fill="#38bdf8" fontFamily="monospace" fontWeight="bold" fontSize="18">1</text>
        <rect x="98" y="30" width="38" height="36" rx="4" fill="#0d1526" stroke="#1e293b" strokeWidth="1.2" />
        <text x="117" y="54" textAnchor="middle" fill="#34d399" fontFamily="monospace" fontWeight="bold" fontSize="18">2</text>
        <rect x="140" y="30" width="38" height="36" rx="4" fill="#281e12" stroke="#f59e0b" strokeWidth="1.5" />
        <path d="M154 38v20m0-20 14 6-14 6" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="182" y="30" width="38" height="36" rx="4" fill="#162238" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="1.2" />
        <rect x="224" y="30" width="38" height="36" rx="4" fill="#162238" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="1.2" />

        <rect x="56" y="72" width="38" height="36" rx="4" fill="#0d1526" stroke="#1e293b" strokeWidth="1.2" />
        <rect x="98" y="72" width="38" height="36" rx="4" fill="#0d1526" stroke="#1e293b" strokeWidth="1.2" />
        <text x="117" y="96" textAnchor="middle" fill="#f43f5e" fontFamily="monospace" fontWeight="bold" fontSize="18">3</text>
        <rect x="140" y="72" width="38" height="36" rx="4" fill="#5c1426" stroke="#f43f5e" strokeWidth="1.75" />
        <circle cx="159" cy="90" r="10" fill="#f43f5e" fillOpacity="0.35" />
        <circle cx="159" cy="90" r="6" fill="#f43f5e" />
        <circle cx="157" cy="88" r="2" fill="#ffffff" />
        <rect x="182" y="72" width="38" height="36" rx="4" fill="#0d1526" stroke="#1e293b" strokeWidth="1.2" />
        <text x="201" y="96" textAnchor="middle" fill="#38bdf8" fontFamily="monospace" fontWeight="bold" fontSize="18">1</text>
        <rect x="224" y="72" width="38" height="36" rx="4" fill="#162238" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="1.2" />

        <rect x="56" y="114" width="38" height="36" rx="4" fill="#0d1526" stroke="#1e293b" strokeWidth="1.2" />
        <rect x="98" y="114" width="38" height="36" rx="4" fill="#0d1526" stroke="#1e293b" strokeWidth="1.2" />
        <text x="117" y="138" textAnchor="middle" fill="#38bdf8" fontFamily="monospace" fontWeight="bold" fontSize="18">1</text>
        <rect x="140" y="114" width="38" height="36" rx="4" fill="#0d1526" stroke="#1e293b" strokeWidth="1.2" />
        <text x="159" y="138" textAnchor="middle" fill="#34d399" fontFamily="monospace" fontWeight="bold" fontSize="18">2</text>
        <rect x="182" y="114" width="38" height="36" rx="4" fill="#281e12" stroke="#f59e0b" strokeWidth="1.5" />
        <path d="M196 122v20m0-20 14 6-14 6" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="224" y="114" width="38" height="36" rx="4" fill="#162238" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="1.2" />
      </g>
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
