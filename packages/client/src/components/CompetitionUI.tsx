import React, { useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CompetitionTemplate } from '@fugluck/shared'
import { competitionResult, moneyLabel, type PlayerCompetition } from '../lib/competitionPresentation'
import { getClientGamePlugin } from '../games/registry'

function formatCompetitionMoney(minor: number, currency = 'GEL'): string {
  if (currency === 'COINS') {
    return `${minor.toLocaleString()} COINS`
  }
  return moneyLabel(minor, currency)
}

export function CompetitionPlayerSlots({ joined, capacity }: { joined: number; capacity: number }) {
  const { t } = useTranslation()
  const safeCap = Math.max(1, capacity)
  const pct = Math.min(100, Math.max(0, Math.round((joined / safeCap) * 100)))
  return <div className="competition-players" aria-label={t('competition.playersCount', { joined, capacity })}>
    <div className="competition-progress-row">
      <span className="competition-progress-label">{t('competition.players')}</span>
      <strong className="competition-progress-count">{joined}/{capacity}</strong>
    </div>
    <div
      className="competition-progress-track"
      role="progressbar"
      aria-valuenow={joined}
      aria-valuemin={0}
      aria-valuemax={capacity}
      aria-label={t('competition.playersCount', { joined, capacity })}
    >
      <div className="competition-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  </div>
}
export function CompetitionTerms({ entryMinor, prizeMinor, currency = 'GEL' }: { entryMinor: number; prizeMinor: number; currency?: string }) {
  const { t } = useTranslation()
  return <dl className="competition-terms"><div><dt>{t('competition.entry')}</dt><dd>{entryMinor === 0 ? t('competition.free') : formatCompetitionMoney(entryMinor, currency)}</dd></div><div><dt>{t('competition.prize')}</dt><dd>{formatCompetitionMoney(prizeMinor, currency)}</dd></div></dl>
}
export function CompetitionGameVisual({ gameId }: { gameId: string }) {
  return <div className={`competition-visual ${gameId === 'cyber-hopper' ? 'is-hopper' : ''}`} aria-hidden="true">
    {gameId === 'minesweeper-sprint' ? <svg viewBox="0 0 300 110"><rect x="64" y="10" width="172" height="90" rx="8" fill="#0b1220" stroke="#38bdf8" strokeWidth="1.5" /><rect x="76" y="20" width="32" height="30" rx="4" fill="#0d1526" /><text x="92" y="40" textAnchor="middle" fill="#38bdf8" fontFamily="monospace" fontWeight="bold" fontSize="16">1</text><rect x="114" y="20" width="32" height="30" rx="4" fill="#281e12" stroke="#f59e0b" strokeWidth="1.5" /><path d="M126 26v16m0-16 11 5-11 5" stroke="#f43f5e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /><rect x="152" y="20" width="32" height="30" rx="4" fill="#5c1426" stroke="#f43f5e" strokeWidth="1.5" /><circle cx="168" cy="35" r="7" fill="#f43f5e" /><rect x="190" y="20" width="32" height="30" rx="4" fill="#162238" /><rect x="76" y="56" width="32" height="30" rx="4" fill="#0d1526" /><rect x="114" y="56" width="32" height="30" rx="4" fill="#0d1526" /><text x="130" y="76" textAnchor="middle" fill="#34d399" fontFamily="monospace" fontWeight="bold" fontSize="16">2</text><rect x="152" y="56" width="32" height="30" rx="4" fill="#162238" /><rect x="190" y="56" width="32" height="30" rx="4" fill="#162238" /></svg> : gameId === 'neon-snake' ? <svg viewBox="0 0 300 110"><rect x="30" y="10" width="240" height="90" rx="8" fill="#0a101d" stroke="#10b981" strokeWidth="1.5" /><rect x="64" y="64" width="22" height="18" rx="3" fill="#06b6d4" /><rect x="90" y="64" width="22" height="18" rx="3" fill="#10b981" /><rect x="116" y="64" width="22" height="18" rx="3" fill="#06b6d4" /><rect x="116" y="42" width="22" height="18" rx="3" fill="#10b981" /><rect x="142" y="40" width="26" height="22" rx="4" fill="#34d399" stroke="#ffffff" strokeWidth="1.5" /><circle cx="216" cy="51" r="10" fill="#ec4899" /><circle cx="204" cy="80" r="7" fill="#f59e0b" stroke="#fde047" strokeWidth="1.5" /></svg> : gameId === '2048-blitz' ? <svg viewBox="0 0 300 110"><rect x="100" y="8" width="100" height="94" rx="8" fill="#0d1422" stroke="#38bdf8" strokeWidth="1.5" /><rect x="108" y="16" width="26" height="24" rx="4" fill="#17253b" stroke="#38bdf8" strokeWidth="1.2" /><rect x="138" y="16" width="26" height="24" rx="4" fill="#3a2710" stroke="#f59e0b" strokeWidth="1.2" /><rect x="168" y="16" width="24" height="24" rx="4" fill="#291445" stroke="#a855f7" strokeWidth="1.2" /><rect x="108" y="46" width="56" height="48" rx="6" fill="#0f3a36" stroke="#34d399" strokeWidth="1.75" /><text x="136" y="75" textAnchor="middle" fill="#ffffff" fontFamily="monospace" fontWeight="bold" fontSize="15">2048</text><rect x="168" y="46" width="24" height="48" rx="4" fill="#3f1224" stroke="#f43f5e" strokeWidth="1.2" /></svg> : gameId === 'stack-tower' ? <svg viewBox="0 0 300 110"><rect x="95" y="86" width="110" height="24" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" /><rect x="102" y="70" width="96" height="14" rx="2" fill="#10b981" /><rect x="108" y="54" width="84" height="14" rx="2" fill="#06b6d4" /><rect x="114" y="38" width="72" height="14" rx="2" fill="#8b5cf6" /><rect x="142" y="16" width="72" height="14" rx="2" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" /></svg> : gameId === 'cyber-hopper' ? <svg viewBox="0 0 300 110"><path className="visual-road" d="M0 25H300M0 75H300" /><path d="M25 25h35m40 0h35m40 0h35m40 0h35M5 75h35m40 0h35m40 0h35m40 0h35" stroke="currentColor" strokeWidth="2" strokeDasharray="8 8" /><rect x="45" y="13" width="42" height="24" rx="8" fill="#38bdf8" fillOpacity="0.85" /><rect x="213" y="63" width="48" height="24" rx="8" fill="#f59e0b" fillOpacity="0.9" /><path d="m150 22 22 25-4 23-18 15-18-15-4-23Z" fill="#10b981" /><path d="m141 38 9-9 9 9-4 22h-10Z" fill="#06221a" /><path d="M144 76v14m12-14v14" stroke="#34d399" strokeWidth="5" /></svg> : <svg viewBox="0 0 300 110"><g fill="#38bdf8" opacity="0.7"><circle cx="40" cy="24" r="2" /><circle cx="73" cy="82" r="2" /><circle cx="232" cy="25" r="2" /><circle cx="266" cy="75" r="2" /></g><g fill="#1c2a3f" stroke="#385073" strokeWidth="1.5"><path d="m60 26 7-9 12 4 5 13-9 11-12-5Z" /><path d="m223 77 8-11 16 2 5 13-14 11-10-4Z" /></g><path d="m150 13 14 42 22 25-32-6-4 7-4-7-32 6 22-25Z" fill="#10b981" /><path d="m150 28 6 29-6 11-6-11Z" fill="#d1fae5" /><path d="m139 80 4 22 4-18m6 0 4 18 4-22" stroke="#f59e0b" strokeWidth="3" /><path d="M150 0v8M126 32v-9m48 9v-9" stroke="#34d399" strokeWidth="2" /></svg>}
  </div>
}
export function CompetitionDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  React.useEffect(() => { const previous = document.activeElement as HTMLElement | null; const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); previous?.focus() } }, [])
  return <dialog ref={ref} role="dialog" aria-modal="true" aria-label={title} className="competition-dialog" onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); if (e.target === e.currentTarget && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) onClose() }} onKeyDown={e => {
    if (e.key !== 'Tab') return
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary,input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(el => el.getClientRects().length > 0)
    const first = items[0], last = items.at(-1)
    if (!first) { e.preventDefault(); e.currentTarget.focus(); return }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }}>
    <div className="competition-dialog-heading"><h2>{title}</h2><button type="button" className="ac-btn ac-btn--ghost" aria-label={t('common.close')} onClick={onClose}>×</button></div>{children}
  </dialog>
}
export function CompetitionRules({ template }: { template: CompetitionTemplate }) {
  const { t } = useTranslation()
  const isCoins = template.currency === 'COINS'
  return <details className="competition-rules"><summary>{t('competition.rulesDetails')}</summary>
    <dl><div><dt>{t('competition.format')}</dt><dd>{t(`competition.formats.${template.format}`)}</dd></div><div><dt>{t('competition.players')}</dt><dd>{template.participantCapacity}</dd></div></dl>
    <p>{t(getClientGamePlugin(template.gameId)?.competitionControlsKey ?? 'competition.blasterControls')}</p><p>{t(template.format === 'TOURNAMENT_BRACKET' ? 'competition.knockout.rules' : 'competition.gameRules')}</p><p>{t(isCoins ? 'competition.coinsLeaveRule' : template.format === 'TOURNAMENT_BRACKET' ? 'competition.knockout.leaveRule' : 'competition.leaveRule')}</p>
    <div className="competition-policy-links"><a href="/rules" target="_blank" rel="noreferrer">{t('competition.rules')}</a><a href="/entry-fees-prizes" target="_blank" rel="noreferrer">{t('competition.entryPrizeDetails')}</a><a href="/fair-play" target="_blank" rel="noreferrer">{t('competition.fairPlay')}</a><a href="/terms" target="_blank" rel="noreferrer">{t('competition.terms')}</a>{isCoins ? <a href="/coins" target="_blank" rel="noreferrer">{t('competition.coinsDetails')}</a> : <a href="/sandbox-notice" target="_blank" rel="noreferrer">{t('competition.sandboxDetails')}</a>}</div>
  </details>
}
export function CompetitionBracket({ instance, userId }: { instance: PlayerCompetition; userId?: string }) {
  const { t } = useTranslation(); const bracket = instance.tournament; if (!bracket) return null;
  return <details className="competition-rules competition-bracket"><summary>{t('competition.knockout.bracket')}</summary>
    {Array.from(new Set(bracket.matches.map(m => m.round))).map(round => <section key={round}><h3>{t(`competition.knockout.rounds.${bracket.matches.find(m => m.round === round)!.roundName}`)}</h3>
      <ul>{bracket.matches.filter(m => m.round === round).map(m => <li key={m.id} className={m.players.includes(userId ?? '') ? 'is-yours' : ''}>
        {m.players.map((id, i) => <span key={i}>{m.winnerUserId === id && id ? '★ ' : ''}{id === userId ? t('competition.knockout.you') : m.playerNames[i] ?? t('competition.knockout.pendingPlayer')}</span>)}
      </li>)}</ul></section>)}
  </details>
}
export function CompetitionQualification({ template }: { template: CompetitionTemplate }) {
  const { t, i18n } = useTranslation(), info = template.tournament; if (!info || info.promosEnabled === false || template.currency === 'COINS') return null;
  const date = (value: string) => new Intl.DateTimeFormat([i18n.resolvedLanguage ?? 'en', 'en-GB'], { timeZone: info.cycle?.timezone ?? 'Asia/Tbilisi', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  return <div className="competition-qualification">
    {info.cycle && <p>{t('competition.knockout.starts', { date: date(info.cycle.startsAt), zone: info.cycle.timezone })}</p>}
    {info.product !== 'STANDARD' && <p>{t(`competition.knockout.eligibility.${info.eligibility}`)}</p>}
    <details><summary>{t('competition.knockout.qualification')}</summary>
      {(['promo', 'gift'] as const).map(product => { const track = info[product], cycle = product === 'promo' ? info.nextPromoCycle : info.nextGiftCycle; return <p key={product}>{t(`competition.knockout.products.${product.toUpperCase()}`)}: {track.progress} / {track.threshold} {track.ticketStatus && t(`competition.knockout.tickets.${track.ticketStatus}`)}{cycle && <small>{t('competition.knockout.next', { date: date(cycle.startsAt) })}</small>}</p> })}
      <p>{t('competition.knockout.qualificationRule', { promo: info.promo.threshold, gift: info.gift.threshold })}</p>
    </details>
  </div>
}
export function CompetitionResult({ instance, userId, onRetry }: { instance: PlayerCompetition | null; userId?: string; onRetry?: () => void }) {
  const { t } = useTranslation(); const result = competitionResult(instance, userId)
  const icon = result.kind === 'win' ? '★' : result.kind === 'loss' ? '⚑' : result.kind === 'draw' ? '＝' : result.kind === 'pending' ? '…' : '↩'
  return <section className={`competition-result is-${result.kind}`} aria-live="polite">
    <p className="competition-test-label">{t(instance?.currency === 'COINS' ? 'competition.coinsLabel' : 'competition.testLabel')}</p>
    <div className="competition-result-icon" aria-hidden="true">{icon}</div><h2>{t(`competition.results.${result.kind}`)}</h2>
    {result.kind === 'pending' ? <><p>{t('competition.resultPending')}</p>{onRetry && <button type="button" className="ac-btn ac-btn--secondary" onClick={onRetry}>{t('competition.retry')}</button>}</> : <>
      <dl className="competition-terms"><div><dt>{t('competition.yourScore')}</dt><dd>{result.yourScore ?? '—'}</dd></div><div><dt>{t('competition.opponentScore')}</dt><dd>{result.opponentScore ?? '—'}</dd></div></dl>
      {'prizeMinor' in result && <p className="competition-award">{t('competition.prize')} <strong>{formatCompetitionMoney(result.prizeMinor ?? 0, result.currency)}</strong></p>}
      {'returnedMinor' in result && <p>{result.returnedMinor === undefined ? t('competition.returnPending') : t('competition.entryReturned', { amount: formatCompetitionMoney(result.returnedMinor, result.currency) })}</p>}
    </>}
  </section>
}
