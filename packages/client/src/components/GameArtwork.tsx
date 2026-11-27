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

  'brick-breaker': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#070a10" />
      <rect x="26" y="14" width="268" height="152" rx="8" fill="#0a101d" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="1.75" />
      <rect x="42" y="28" width="44" height="14" rx="2" fill="#7c3aed" stroke="#ddd6fe" strokeWidth="1.2" />
      <rect x="92" y="28" width="44" height="14" rx="2" fill="#7c3aed" stroke="#ddd6fe" strokeWidth="1.2" />
      <rect x="142" y="28" width="44" height="14" rx="2" fill="#7c3aed" stroke="#ddd6fe" strokeWidth="1.2" />
      <rect x="192" y="28" width="44" height="14" rx="2" fill="#7c3aed" stroke="#ddd6fe" strokeWidth="1.2" />
      <rect x="242" y="28" width="36" height="14" rx="2" fill="#7c3aed" stroke="#ddd6fe" strokeWidth="1.2" />
      <rect x="42" y="48" width="44" height="14" rx="2" fill="#ec4899" stroke="#fbcfe8" strokeWidth="1.2" />
      <rect x="92" y="48" width="44" height="14" rx="2" fill="#ec4899" stroke="#fbcfe8" strokeWidth="1.2" />
      <rect x="192" y="48" width="44" height="14" rx="2" fill="#ec4899" stroke="#fbcfe8" strokeWidth="1.2" />
      <rect x="242" y="48" width="36" height="14" rx="2" fill="#ec4899" stroke="#fbcfe8" strokeWidth="1.2" />
      <rect x="42" y="68" width="44" height="14" rx="2" fill="#06b6d4" stroke="#cffafe" strokeWidth="1.2" />
      <rect x="142" y="68" width="44" height="14" rx="2" fill="#10b981" stroke="#d1fae5" strokeWidth="1.2" />
      <rect x="242" y="68" width="36" height="14" rx="2" fill="#06b6d4" stroke="#cffafe" strokeWidth="1.2" />
      <path d="M168 140L198 106L164 82" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" />
      <circle cx="198" cy="106" r="10" fill="#38bdf8" fillOpacity="0.3" />
      <circle cx="198" cy="106" r="6" fill="#ffffff" />
      <rect x="116" y="144" width="88" height="12" rx="4" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
    </svg>
  ),

  'blitz-chess': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#070a10" />
      <rect x="86" y="16" width="148" height="148" rx="8" fill="#0d1422" stroke="#818cf8" strokeOpacity="0.55" strokeWidth="1.75" />
      <g>
        <rect x="94" y="24" width="33" height="33" fill="#1e2c44" />
        <rect x="127" y="24" width="33" height="33" fill="#10192b" />
        <rect x="160" y="24" width="33" height="33" fill="#1e2c44" />
        <rect x="193" y="24" width="33" height="33" fill="#10192b" />
        <rect x="94" y="57" width="33" height="33" fill="#10192b" />
        <rect x="127" y="57" width="33" height="33" fill="#1e2c44" />
        <rect x="160" y="57" width="33" height="33" fill="#10b981" fillOpacity="0.28" />
        <rect x="193" y="57" width="33" height="33" fill="#1e2c44" />
        <rect x="94" y="90" width="33" height="33" fill="#1e2c44" />
        <rect x="127" y="90" width="33" height="33" fill="#10192b" />
        <rect x="160" y="90" width="33" height="33" fill="#1e2c44" />
        <rect x="193" y="90" width="33" height="33" fill="#10192b" />
        <rect x="94" y="123" width="33" height="33" fill="#10192b" />
        <rect x="127" y="123" width="33" height="33" fill="#1e2c44" />
        <rect x="160" y="123" width="33" height="33" fill="#10192b" />
        <rect x="193" y="123" width="33" height="33" fill="#1e2c44" />
      </g>
      <circle cx="176" cy="73" r="12" fill="#e2e8f0" stroke="#38bdf8" strokeWidth="1.75" />
      <text x="176" y="79" textAnchor="middle" fill="#09101a" fontFamily="sans-serif" fontWeight="bold" fontSize="18">♘</text>
      <circle cx="143" cy="40" r="12" fill="#111827" stroke="#ec4899" strokeWidth="1.75" />
      <text x="143" y="46" textAnchor="middle" fill="#f8fafc" fontFamily="sans-serif" fontWeight="bold" fontSize="18">♚</text>
      <circle cx="110" cy="139" r="12" fill="#e2e8f0" stroke="#38bdf8" strokeWidth="1.75" />
      <text x="110" y="145" textAnchor="middle" fill="#09101a" fontFamily="sans-serif" fontWeight="bold" fontSize="18">♔</text>
    </svg>
  ),

  'connect-4': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#070a10" />
      <rect x="66" y="24" width="188" height="136" rx="14" fill="#1d4ed8" stroke="#93c5fd" strokeOpacity="0.4" strokeWidth="2" />
      <rect x="58" y="150" width="204" height="14" rx="5" fill="#1e3a8a" />
      {[0, 1, 2, 3, 4, 5].map((c) =>
        [0, 1, 2, 3].map((r) => (
          <circle key={`${c}-${r}`} cx={86 + c * 29.5} cy={46 + r * 29} r="10.5" fill="#0b1120" />
        )),
      )}
      <circle cx="86" cy="133" r="9.5" fill="#ef4444" stroke="#b91c1c" strokeWidth="1.5" />
      <circle cx="115.5" cy="133" r="9.5" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
      <circle cx="145" cy="133" r="9.5" fill="#ef4444" stroke="#b91c1c" strokeWidth="1.5" />
      <circle cx="174.5" cy="133" r="9.5" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
      <circle cx="115.5" cy="104" r="9.5" fill="#ef4444" stroke="#34d399" strokeWidth="2.5" />
      <circle cx="145" cy="104" r="9.5" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
      <circle cx="145" cy="75" r="9.5" fill="#ef4444" stroke="#34d399" strokeWidth="2.5" />
      <circle cx="174.5" cy="104" r="9.5" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
      <circle cx="174.5" cy="75" r="9.5" fill="#ef4444" stroke="#34d399" strokeWidth="2.5" />
      <circle cx="204" cy="46" r="9.5" fill="#ef4444" stroke="#34d399" strokeWidth="2.5" />
      <circle cx="204" cy="133" r="9.5" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
      <circle cx="204" cy="104" r="9.5" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
      <circle cx="204" cy="75" r="9.5" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
    </svg>
  ),

  'checkers': () => (
    <svg viewBox="0 0 320 180" fill="none" className="ac-game-art" aria-hidden="true">
      <rect width="320" height="180" fill="#070a10" />
      <rect x="74" y="16" width="172" height="148" rx="10" fill="#2b1d14" stroke="#f0d9b5" strokeOpacity="0.28" strokeWidth="2" />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={86 + c * 37}
            y={26 + r * 32}
            width="37"
            height="32"
            fill={(r + c) % 2 === 0 ? '#f0d9b5' : '#b58863'}
          />
        )),
      )}
      <circle cx="141.5" cy="42" r="12" fill="#27272a" stroke="#09090b" strokeWidth="2" />
      <circle cx="215.5" cy="42" r="12" fill="#27272a" stroke="#09090b" strokeWidth="2" />
      <circle cx="178.5" cy="74" r="12" fill="#27272a" stroke="#09090b" strokeWidth="2" />
      <circle cx="104.5" cy="138" r="12" fill="#dc2626" stroke="#991b1b" strokeWidth="2" />
      <circle cx="178.5" cy="138" r="12" fill="#dc2626" stroke="#991b1b" strokeWidth="2" />
      <circle cx="141.5" cy="106" r="13" fill="#dc2626" stroke="#facc15" strokeWidth="2.5" />
      <path d="M135 110l-1-8 4 3 3.5-5 3.5 5 4-3-1 8h-13z" fill="#facc15" />
    </svg>
  ),
}

export default function GameArtwork({ gameId, thumbnailKey }: GameArtworkProps) {
  const key = thumbnailKey ?? getGameManifest(gameId)?.thumbnail ?? gameId
  const render = ARTWORK_BY_KEY[key] ?? ARTWORK_BY_KEY['space-blaster']
  return <>{render()}</>
}
