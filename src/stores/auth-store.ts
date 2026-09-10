'use client'

/**
 * Global auth state (zustand). Nothing is persisted — the session lives in an
 * httpOnly cookie; bootstrap() resolves the current user from /api/auth/me.
 * A 401 from any non-auth API call (session expired/revoked server-side)
 * dispatches 'ems:unauthorized' from the api-client; the listener below resets
 * the store and redirects to /login so the UI never sits in a stale session.
 */

import { create } from 'zustand'
import type { LoginPayload, RegisterPayload, UserDTO } from '@/types'
import { api, ApiClientError } from '@/lib/api-client'
import { ROUTES } from '@/lib/constants'
import { navigate } from '@/hooks/use-hash-route'

interface AuthState {
  user: UserDTO | null
  loading: boolean
  /** True once the initial /auth/me check has completed. */
  initialized: boolean
  bootstrap: () => Promise<void>
  login: (payload: LoginPayload) => Promise<UserDTO>
  register: (payload: RegisterPayload) => Promise<UserDTO>
  logout: () => Promise<void>
  setUser: (user: UserDTO | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  bootstrap: async () => {
    // Auto-recovery: session died server-side while the tab was open.
    if (typeof window !== 'undefined') {
      window.addEventListener('ems:unauthorized', () => {
        const current = useAuthStore.getState().user
        useAuthStore.setState({ user: null })
        if (current) {
          // Only bounce when we thought we were signed in (avoid loops on public pages).
          navigate(ROUTES.LOGIN)
        }
      })
    }
    try {
      const data = await api.get<{ user: UserDTO }>('/auth/me')
      set({ user: data.user, initialized: true })
    } catch (error) {
      // 401 (or any failure) simply means "not signed in".
      void error
      set({ user: null, initialized: true })
    }
  },

  login: async (payload) => {
    set({ loading: true })
    try {
      const data = await api.post<{ user: UserDTO }>('/auth/login', payload)
      set({ user: data.user, loading: false })
      return data.user
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  register: async (payload) => {
    set({ loading: true })
    try {
      const data = await api.post<{ user: UserDTO }>('/auth/register', payload)
      set({ user: data.user, loading: false })
      return data.user
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      // Even if the request fails, clear local state and go home.
      void error
    } finally {
      set({ user: null })
      navigate(ROUTES.HOME)
    }
  },

  setUser: (user) => set({ user }),
}))

/** Re-throw helper: true when the error is an auth failure (401). */
export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401
}
