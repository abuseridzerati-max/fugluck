import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGameTitle, type RecentTournamentWinner, type RecentWinnersResponse } from '@fugluck/shared'
import { apiFetch } from '../lib/api'
import { CoinIcon, TrophyIcon } from './icons'

type RecentWinnersFeedProps = {
  limit?: number
  hideWhenEmpty?: boolean
}

export default function RecentWinnersFeed({ limit = 8, hideWhenEmpty = false }: RecentWinnersFeedProps) {
  const { t, i18n } = useTranslation()
  const [winners, setWinners] = useState<RecentTournamentWinner[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    apiFetch<RecentWinnersResponse>(`/api/competitions/recent-winners?limit=${limit}`)
      .then((res) => {
        if (!active) return
        setWinners(Array.isArray(res.winners) ? res.winners : [])
      })
      .catch(() => {
        if (active) setWinners([])
      })
      .finally(() => {
        if (active) setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [limit])

  if (hideWhenEmpty && (!loaded || winners.length === 0)) {
    return null
  }

  const locale = i18n.resolvedLanguage || 'en'

  return (
    <section
      className="ac-winners-feed"
      aria-label={t('leaderboards.recentWinnersTitle', { defaultValue: 'Recent Tournament Winners' })}
    >
      <div className="ac-winners-feed__head">
        <div className="ac-section-title-group">
          <TrophyIcon size={15} />
          <h2 className="ac-winners-feed__title">
            {t('leaderboards.recentWinnersTitle', { defaultValue: 'Recent Tournament Winners' })}
          </h2>
        </div>
      </div>

      {!loaded ? (
        <p className="ac-text-muted" style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>
          {t('common.loading', { defaultValue: 'Loading…' })}
        </p>
      ) : winners.length === 0 ? (
        <p className="ac-text-muted" style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>
          {t('leaderboards.recentWinnersEmpty', { defaultValue: 'No completed Coins tournaments yet — join a bracket to be the first champion!' })}
        </p>
      ) : (
        <div className="ac-winners-feed__strip">
          {winners.map((winner, idx) => (
            <div key={`${winner.username}-${winner.completedAt}-${idx}`} className="ac-winner-chip">
              <div className="ac-winner-chip__top">
                <strong className="ac-winner-chip__name">{winner.username}</strong>
                <span className="ac-winner-chip__prize">
                  <CoinIcon size={12} />+{winner.prizeCoins.toLocaleString(locale)}
                </span>
              </div>
              <div className="ac-winner-chip__meta">
                <span>{getGameTitle(winner.gameId)}</span>
                <span>·</span>
                <span>{t('leaderboards.bracketSizeLabel', { count: winner.bracketSize, defaultValue: `${winner.bracketSize}-Player` })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
