import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '../types'

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  theme: 'light' | 'dark'
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  clearAuth: () => void
  updateUser: (user: Partial<User>) => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      theme: 'light',
      setAuth: (user, accessToken, refreshToken) => {
        // Tokens are now ONLY stored in Zustand persist (not separately in localStorage)
        set({ isAuthenticated: true, user, accessToken, refreshToken })

        // Notify Electron main process of the current logged-in user for security event reporting
        if (typeof window !== 'undefined' && (window as any).electronAPI?.setAccountId) {
          (window as any).electronAPI.setAccountId(user.accountId, accessToken)
        }
      },
      clearAuth: () => {
        // Clean up any legacy tokens in localStorage
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')

        // Clear Electron accountId and accessToken for security event reporting
        if (typeof window !== 'undefined' && (window as any).electronAPI?.setAccountId) {
          (window as any).electronAPI.setAccountId('', '')
        }

        set({ isAuthenticated: false, user: null, accessToken: null, refreshToken: null })
      },
      updateUser: (updatedUser) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedUser } : (updatedUser as User)
        }))
      },
      setTheme: (theme) => {
        set({ theme })
        document.documentElement.setAttribute('data-theme', theme)
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        theme: state.theme
      })
    }
  )
)
