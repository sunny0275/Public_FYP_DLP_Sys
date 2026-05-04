import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { apiClient } from '../api'

interface SessionToast {
  show: boolean
  message: string
  timeRemaining: number
}

export function useSessionMonitor() {
  const { isAuthenticated, accessToken, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [toast, setToast] = useState<SessionToast>({ show: false, message: '', timeRemaining: 0 })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const warningShownRef = useRef<boolean>(false)

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      warningShownRef.current = false
      return
    }

    const checkSessionExpiry = () => {
      try {
        const parts = accessToken.split('.')
        if (parts.length !== 3) {
          return
        }

        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')

        const payloadString = atob(padded)
        const payload = JSON.parse(payloadString)

        if (!payload.exp || typeof payload.exp !== 'number') {
          return
        }

        const expirationTime: number = payload.exp * 1000 // ms
        const issuedAtTime: number = payload.iat && typeof payload.iat === 'number'
          ? payload.iat * 1000
          : Date.now()

        const now = Date.now()

        // ---- Working hours / 4-hour rule based on login time ----
        const loginDate = new Date(issuedAtTime)
        const sixPm = new Date(loginDate)
        sixPm.setHours(18, 0, 0, 0) // 18:00
        const sixPmPlusOne = new Date(loginDate)
        sixPmPlusOne.setHours(18, 1, 0, 0) // 18:01

        let ruleEndTime: number
        let ruleType: 'WORKING_HOURS' | 'FOUR_HOURS'

        if (issuedAtTime < sixPm.getTime()) {
          // 6:00 PM to 6:01 PM 1 minute countdown
          ruleEndTime = sixPmPlusOne.getTime()
          ruleType = 'WORKING_HOURS'
        } else {
          // 6:00 PM after login: 4 hours from login time
          const fourHoursMs = 4 * 60 * 60 * 1000
          ruleEndTime = issuedAtTime + fourHoursMs
          ruleType = 'FOUR_HOURS'
        }

        // Implementation of the actual session end time = the earlier of the JWT expiration time or the custom rule end time
        const sessionEndTime = Math.min(ruleEndTime, expirationTime)
        const timeRemaining = sessionEndTime - now

        // Session expired
        if (timeRemaining <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
          }
          setToast({
            show: true,
            message: ruleType === 'WORKING_HOURS'
              ? 'Working hours/session ended. Logging out...'
              : 'Your session has expired. Redirecting to login...',
            timeRemaining: 0
          })
          // Delay logout by 3 seconds to show message
          setTimeout(() => {
            clearAuth()
            navigate('/login', { state: { reason: 'session_expired' } })
          }, 3000)
          return
        }

        const minutes1 = 1 * 60 * 1000
        const twoMinutes = 2 * 60 * 1000

        // ---- Special rule: 6:00 PM to 6:01 PM 1 minute countdown ----
        if (ruleType === 'WORKING_HOURS' && timeRemaining <= minutes1) {
          const secondsLeft = Math.floor(timeRemaining / 1000)
          const minutesLeft = Math.floor(secondsLeft / 60)
          const secondsDisplay = secondsLeft % 60

          setToast({
            show: true,
            message: `Working hours end at 6:00 PM. Auto logout in ${minutesLeft}:${secondsDisplay
              .toString()
              .padStart(2, '0')} to save your work.`,
            timeRemaining: secondsLeft
          })
          warningShownRef.current = true
          return
        }

        // ---- General rule: 2 minutes before session expires ----
        if (timeRemaining <= twoMinutes) {
          const secondsLeft = Math.floor(timeRemaining / 1000)
          const minutesLeft = Math.floor(secondsLeft / 60)
          const secondsDisplay = secondsLeft % 60

          setToast({
            show: true,
            message: `Session expires in ${minutesLeft}:${secondsDisplay
              .toString()
              .padStart(2, '0')}`,
            timeRemaining: secondsLeft
          })
          warningShownRef.current = true
        }
      } catch (error) {
        console.error('Error checking session expiry:', error)
      }
    }

    // Check immediately
    checkSessionExpiry()

    // Check every second for smooth countdown
    intervalRef.current = setInterval(checkSessionExpiry, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // Reset warning flag on cleanup
      warningShownRef.current = false
    }
  }, [isAuthenticated, accessToken, clearAuth, navigate])

  const extendSession = async () => {
    try {
      // Read refresh token from Zustand store (not localStorage)
      const refreshToken = useAuthStore.getState().refreshToken
      if (refreshToken) {
        const response = await apiClient.refreshToken(refreshToken)
        useAuthStore.getState().setAuth(
          {
            userId: response.data.userId,
            accountId: response.data.accountId,
            email: response.data.email,
            fullName: response.data.fullName,
            department: response.data.department,
            position: response.data.position,
            roles: response.data.roles || [],
            availableDashboards: response.data.availableDashboards || [],
            firstLogin: response.data.firstLogin,
            passwordChangeRequired: response.data.passwordChangeRequired,
            mfaEnabled: response.data.mfaEnabled,
            mfaRequired: response.data.mfaRequired
          },
          response.data.accessToken!,
          response.data.refreshToken!
        )

        // Update Electron accountId for security event reporting
        if (typeof window !== 'undefined' && (window as any).electronAPI?.setAccountId) {
          (window as any).electronAPI.setAccountId(response.data.accountId)
        }

        setToast({ show: false, message: '', timeRemaining: 0 })
        warningShownRef.current = false
      }
    } catch (error) {
      console.error('Failed to extend session:', error)
      clearAuth()
      navigate('/login')
    }
  }

  const dismissToast = () => {
    setToast({ show: false, message: '', timeRemaining: 0 })
  }

  return {
    toast,
    extendSession,
    dismissToast
  }
}
