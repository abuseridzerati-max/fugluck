import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GAME_MANIFESTS, type LeaderboardEntry, type LeaderboardResponse } from '@fugluck/shared'
import { apiFetch } from '../lib/api'
import { TrophyIcon } from './icons'

type LeaderboardPanelProps = {
  initialGameId?: string
  lockedGameId?: string
  limit?: number
}

export default function LeaderboardPanel({ initialGameId = 'all', lockedGameId, limit = 10 }: LeaderboardPanelProps) {
  const { t, i18n } = useTranslation()
  const [selectedGame, setSelectedGame] = useState<string>(lockedGameId ?? initialGameId)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const effectiveGame = lockedGameId ?? selectedGame

  useEffect(() => {
    if (lockedGameId) setSelectedGame(lockedGameId)
  }, [lockedGameId])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    const params = new URLSearchParams({ limit: String(limit) })
    if (effectiveGame !== 'all') params.set('gameId', effectiveGame)

    apiFetch<LeaderboardResponse>(`/api/leaderboards?${params.toString()}`)
      .then((res) => {
        if (!active) return
        setEntries(Array.isArray(res.entries) ? res.entries : [])
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [effectiveGame, limit])

  const locale = i18n.resolvedLanguage || 'en'

  return (
    <section className="ac-panel ac-leaderboard" aria-label={t('leaderboards.title', { defaultValue: 'Leaderboards' })}>
      <div className="ac-leaderboard__head">
        <div>
          <div className="ac-section-title-group">
            <TrophyIcon size={16} />
            <h2 className="ac-section-title">{t('leaderboards.title', { defaultValue: 'Leaderboards' })}</h2>
          </div>
          <p className="ac-section-sub" style={{ marginTop: 4 }}>
            {t('leaderboards.subtitle', { defaultValue: 'Top players ranked by highest verified score and tournament wins.' })}
          </p>
        </div>
      </div>

      {!lockedGameId && (
        <div className="competition-filters" role="group" aria-label={t('competition.filterGames')}>
          <button
            type="button"
            aria-pressed={selectedGame === 'all'}
            className={`ac-pill${selectedGame === 'all' ? ' ac-pill--active' : ''}`}
            onClick={() => setSelectedGame('all')}
          >
            {t('leaderboards.allCertified', { defaultValue: 'All Certified' })}
          </button>
          {GAME_MANIFESTS.map((manifest) => (
            <button
              key={manifest.id}
              type="button"
              aria-pressed={selectedGame === manifest.id}
              className={`ac-pill${selectedGame === manifest.id ? ' ac-pill--active' : ''}`}
              onClick={() => setSelectedGame(manifest.id)}
            >
              {manifest.title}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="ac-leaderboard__empty" role="status">
          {t('common.loading', { defaultValue: 'Loading…' })}
        </div>
      ) : error ? (
        <div className="ac-leaderboard__empty" role="alert">
          {t('leaderboards.loadError', { defaultValue: 'Could not load leaderboards. Please try again.' })}
        </div>
      ) : entries.length === 0 ? (
        <div className="ac-leaderboard__empty">
          {t('leaderboards.empty', { defaultValue: 'No verified scores recorded yet. Play a match or tournament to claim #1!' })}
        </div>
      ) : (
        <div className="ac-leaderboard__table-wrap">
          <table className="ac-leaderboard__table">
            <thead>
              <tr>
                <th>{t('leaderboards.colRank', { defaultValue: 'Rank' })}</th>
                <th>{t('leaderboards.colPlayer', { defaultValue: 'Player' })}</th>
                <th className="is-num">{t('leaderboards.colBestScore', { defaultValue: 'Best Score' })}</th>
                <th className="is-num">{t('leaderboards.colWins', { defaultValue: 'Wins' })}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={`${entry.rank}-${entry.username}`}>
                  <td className="is-rank">
                    <span className={`ac-rank-pill${entry.rank <= 3 ? ` ac-rank-pill--top${entry.rank}` : ''}`}>
                      #{entry.rank}
                    </span>
                  </td>
                  <td className="is-player">{entry.username}</td>
                  <td className="is-num is-score">{entry.bestScore.toLocaleString(locale)}</td>
                  <td className="is-num">{entry.wins.toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
