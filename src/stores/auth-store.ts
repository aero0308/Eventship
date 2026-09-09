'use client'

/**
 * Global auth state (zustand). Nothing is persisted — the session lives in an
 * httpOnly cookie; bootstrap() resolves the current user from /api/auth/me.
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
