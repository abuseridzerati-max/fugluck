import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PublicUser } from '@arcadeclash/shared'
import { apiFetch, ApiError } from '../lib/api'

const AUTH_STORAGE_KEY = 'arcadeclash_auth_user'

type AuthContextValue = {
  user: PublicUser | null
  loading: boolean
  error: string | null
  signUp: (username: string, password: string, email?: string) => Promise<void>
  logIn: (username: string, password: string) => Promise<void>
  logOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function updateUser(u: PublicUser | null) {
    setUser(u)
    try {
      if (u) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u))
      else localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
  }

  useEffect(() => {
    apiFetch<{ user: PublicUser }>('/api/auth/me')
      .then((res) => updateUser(res.user))
      .catch(() => updateUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function signUp(username: string, password: string, email?: string) {
    setError(null)
    try {
      const res = await apiFetch<{ user: PublicUser }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, password, email }),
      })
      updateUser(res.user)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sign up failed')
      throw e
    }
  }

  async function logIn(username: string, password: string) {
    setError(null)
    try {
      const res = await apiFetch<{ user: PublicUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      updateUser(res.user)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Log in failed')
      throw e
    }
  }

  async function logOut() {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    updateUser(null)
  }

  async function refreshUser() {
    try {
      const res = await apiFetch<{ user: PublicUser }>('/api/auth/me')
      updateUser(res.user)
    } catch {
      updateUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, signUp, logIn, logOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
