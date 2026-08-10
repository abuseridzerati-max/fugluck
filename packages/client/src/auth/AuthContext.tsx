import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PublicUser } from '@arcadeclash/shared'
import { apiFetch, ApiError } from '../lib/api'
import { supabase } from '../lib/supabase'

const AUTH_STORAGE_KEY = 'arcadeclash_auth_user'
const AUTH_TOKEN_KEY = 'arcadeclash_auth_token'

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

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

  function updateUser(u: PublicUser | null, token?: string) {
    setUser(u)
    try {
      if (u) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u))
        if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY)
        localStorage.removeItem(AUTH_TOKEN_KEY)
      }
    } catch {
      // Ignore storage errors
    }
  }

  useEffect(() => {
    let mounted = true

    async function initSession() {
      try {
        const { data } = await supabase.auth.getSession()
        if (data?.session?.access_token) {
          localStorage.setItem(AUTH_TOKEN_KEY, data.session.access_token)
        }
      } catch {
        // Fall back gracefully to cookie / local storage re-hydration
      }

      try {
        const res = await apiFetch<{ user: PublicUser }>('/api/auth/me')
        if (mounted) updateUser(res.user)
      } catch (err) {
        if (mounted) {
          // Check if we have re-hydrated user from localStorage
          const stored = localStorage.getItem(AUTH_STORAGE_KEY)
          if (!stored) {
            updateUser(null)
          }
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void initSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: unknown, session: { access_token?: string } | null) => {
      if (session?.access_token) {
        localStorage.setItem(AUTH_TOKEN_KEY, session.access_token)
      }
    })

    return () => {
      mounted = false
      authListener?.subscription.unsubscribe()
    }
  }, [])

  async function signUp(username: string, password: string, email?: string) {
    setError(null)
    try {
      const res = await apiFetch<{ user: PublicUser; token?: string }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, password, email }),
      })
      updateUser(res.user, res.token)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sign up failed')
      throw e
    }
  }

  async function logIn(username: string, password: string) {
    setError(null)
    try {
      const res = await apiFetch<{ user: PublicUser; token?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      updateUser(res.user, res.token)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Log in failed')
      throw e
    }
  }

  async function logOut() {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    try {
      await supabase.auth.signOut().catch(() => {})
    } catch {
      // Ignore Supabase sign out error if offline
    }
    updateUser(null)
  }

  async function refreshUser() {
    try {
      const res = await apiFetch<{ user: PublicUser }>('/api/auth/me')
      updateUser(res.user)
    } catch {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (!stored) updateUser(null)
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
