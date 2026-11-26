import { useCallback, useEffect, useState } from 'react'
import type { PersonalBestsResponse } from '@fugluck/shared'
import { useAuth } from '../auth/AuthContext'
import { apiFetch } from './api'

export function usePersonalBests() {
  const { user } = useAuth()
  const [bests, setBests] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(() => {
    if (!user) {
      setBests({})
      return
    }
    setLoading(true)
    apiFetch<PersonalBestsResponse>('/api/users/me/personal-bests')
      .then((res) => {
        setBests(res.bests ?? {})
      })
      .catch(() => {
        // Non-blocking personal best enhancement; keep previous state on transient network failure.
      })
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { bests, loading, refresh }
}
