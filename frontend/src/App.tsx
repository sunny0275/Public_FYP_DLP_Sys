import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { useAuthStore } from './store/authStore'
import { apiClient } from './api'
import PrivateRoute from './components/PrivateRoute'
import { getPreferredDashboardPath } from './utils/dashboardPaths'
import { useScreenshotBlockedAlert } from './hooks/useScreenshotBlockedAlert'
import { useSecurityMonitor } from './hooks/useSecurityMonitor'
import { useSecurityEventForwarder } from './hooks/useSecurityEventForwarder'

// Local type for ElectronAPI to avoid global type conflicts
interface LocalElectronAPI {
  setAccountId: (accountId: string, accessToken?: string | null) => void
  [key: string]: unknown
}
// Auth pages
import LoginPage from './pages/auth/LoginPage'
import ChangePasswordPage from './pages/auth/ChangePasswordPage'
import PeriodicPasswordChangePage from './pages/auth/PeriodicPasswordChangePage'
import MfaSetupPage from './pages/auth/MfaSetupPage'
import MfaVerifyPage from './pages/auth/MfaVerifyPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'

// Dashboard pages
import DashboardPage from './pages/dashboard/DashboardPage'
import AdminDashboardPage from './pages/dashboard/AdminDashboardPage'

// Document pages
import DocumentsPage from './pages/documents/DocumentsPage'
import DocumentDetailPage from './pages/documents/DocumentDetailPage'
import UploadPage from './pages/documents/UploadPage'
import UploadResultPage from './pages/documents/UploadResultPage'
import MySharesPage from './pages/documents/MySharesPage'
import SharedDocumentPage from './pages/documents/SharedDocumentPage'

// Admin pages
import AdminPage from './pages/admin/AdminPage'
import EditUserPage from './pages/admin/EditUserPage'
import RecoveryAccountsPage from './pages/admin/RecoveryAccountsPage'
import BlockchainHealthPage from './pages/admin/BlockchainHealthPage'
import BlockedIpsPage from './pages/admin/BlockedIpsPage'
import WatermarkTracebackPage from './pages/admin/WatermarkTracebackPage'

// Profile pages
import ProfilePage from './pages/profile/ProfilePage'

// Workflow pages
import WorkflowFormPage from './pages/workflow/WorkflowFormPage'

// Signature pages
import SignatureChainPage from './pages/documents/SignatureChainPage'

// Classification pages
import ClassificationReviewPage from './pages/classification/ClassificationReviewPage'

// Audit pages
import AuditLogPage from './pages/audit/AuditLogPage'

// Notifications (alerts from audit: warnings, UEBA disable, etc.)
import NotificationsPage from './pages/notifications/NotificationsPage'

// EDR pages
import EDRConsolePage from './pages/edr/EDRConsolePage'
import EDRPoliciesPage from './pages/edr/EDRPoliciesPage'

// UEBA pages
import UebaDashboardPage from './pages/ueba/UebaDashboardPage'
import UebaIncidentsPage from './pages/ueba/UebaIncidentsPage'
import UebaPoliciesPage from './pages/ueba/UebaPoliciesPage'
import UebaUsersPage from './pages/ueba/UebaUsersPage'

// Components
import DashboardLayout from './components/DashboardLayout'
import './App.css'

function MfaRedirect() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const requiresPasswordChange = !!user && (user.passwordChangeRequired || user.firstLogin)
  const requiresMfaSetup = !!user && !user.mfaEnabled && user.mfaRequired

  useEffect(() => {
    if (user && !requiresPasswordChange && requiresMfaSetup && location.pathname !== '/mfa-setup') {
      navigate('/mfa-setup', { replace: true })
    }
  }, [requiresPasswordChange, requiresMfaSetup, navigate, location.pathname, user])

  return null
}

function AccountStatusGuard() {
  const { isAuthenticated, clearAuth } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) return

    let timer: ReturnType<typeof setInterval> | null = null
    let inFlight = false

    const forceLogout = () => {
      clearAuth()
      window.location.href = '/login?reason=account_disabled'
    }

    const checkAccountStatus = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const res = await apiClient.getMyProfile()
        const enabled = res?.data?.accountEnabled
        if (enabled === false) {
          alert('Your account has been disabled (UEBA policy violation). You are being signed out.')
          forceLogout()
        }
      } catch (err: any) {
        // Ignore 403 here - api client interceptor will handle it
      } finally {
        inFlight = false
      }
    }

    checkAccountStatus()
    // Poll every 30 seconds for account status check (reduced from 5s to improve performance)
    timer = setInterval(checkAccountStatus, 30000)
    const onVisible = () => {
      if (!document.hidden) checkAccountStatus()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [clearAuth, isAuthenticated])

  return null
}

function AppRoutes() {
  // Enable security monitoring for the entire app
  // This detects screenshot attempts, screen recording, and suspicious activities
  useSecurityMonitor({
    enabled: true,
    reportScreenshot: true,
    reportClipboard: false  // Clipboard monitoring not needed - Electron handles screenshot detection
  })

  // Listen for screenshot blocked events and show alerts (desktop app)
  useScreenshotBlockedAlert()

  // Forward security events from Electron/Sidecar to backend audit log with JWT auth
  useSecurityEventForwarder()

  // Get user and accessToken from auth store
  const { user, accessToken, isAuthenticated } = useAuthStore()

  // Track if initial sync has been performed
  const initialSyncRef = useRef(false)

  // Sync user accountId AND accessToken to Electron main process for security event reporting
  // This ensures audit logs have correct user identification
  // CRITICAL: accessToken is needed for JWT-authenticated endpoint requests
  // IMPORTANT: Must trigger on mount (initialSyncRef) to sync auth state from Zustand persist storage
  useEffect(() => {
    const electronApi = (window as any)?.electronAPI
    
    if (!electronApi) {
      return
    }
    
    // Always sync on first call or when user changes
    // This handles both: initial load from Zustand persist AND login state changes
    if (user?.accountId && (isAuthenticated || !initialSyncRef.current)) {
      initialSyncRef.current = true
      // Pass accountId AND accessToken for JWT-authenticated endpoint requests
      const electronApi = (window as unknown as { electronAPI?: LocalElectronAPI })?.electronAPI
      if (electronApi?.setAccountId) {
        electronApi.setAccountId(user.accountId, accessToken)
      }
    } else if (!user && initialSyncRef.current) {
      // User logged out, clear the accountId
      const electronApi = (window as unknown as { electronAPI?: LocalElectronAPI })?.electronAPI
      if (electronApi?.setAccountId) {
        electronApi.setAccountId('')
      }
      initialSyncRef.current = false
    }
  }, [user, accessToken, isAuthenticated])

  // First login / admin reset: change password then MFA setup
  const requiresPasswordChangeWithMfaSetup = !!user && (user.firstLogin || (user.passwordChangeRequired && !user.mfaEnabled))
  // Periodic expiry: change password only, MFA already set up
  const requiresPeriodicPasswordChange = !!user && user.passwordChangeRequired && !!user.mfaEnabled
  const requiresPasswordChange = requiresPasswordChangeWithMfaSetup || requiresPeriodicPasswordChange
  const passwordChangeRedirectPath = requiresPasswordChangeWithMfaSetup ? '/change-password' : '/update-password'
  const requiresMfaSetup = !!user && !user.mfaEnabled && user.mfaRequired
  const requiresMfaVerify = !!user && user.mfaEnabled && user.mfaRequired
  const roleDefaultPath = () => getPreferredDashboardPath(user)

  return (
    <Routes>
        {/* Public routes */}
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to={roleDefaultPath()} replace />} />
        <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPasswordPage /> : <Navigate to={roleDefaultPath()} replace />} />
        <Route path="/shared/:token" element={<SharedDocumentPage />} />
        <Route path="/mfa-verify" element={<MfaVerifyPage />} />

        {/* Protected routes */}
        <Route
          path="/home"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} replace />
              : <Navigate to={roleDefaultPath()} replace />
          }
        />
        <Route
          path="/dashboard"
          element={
            requiresPasswordChange
            ? <Navigate to={passwordChangeRedirectPath} replace />
            : requiresMfaSetup
              ? <Navigate to="/mfa-setup" replace />
              : requiresMfaVerify
                ? <Navigate to="/mfa-verify" replace />
                : <PrivateRoute requiredRoles={['EMPLOYEE', 'REVIEWER', 'MANAGER']}>
                    <DashboardLayout><DashboardPage /></DashboardLayout>
                  </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/manager"
          element={
            // Manager Dashboard removed: keep redirect for old bookmarks
            <Navigate to="/dashboard" replace />
          }
        />
        <Route
          path="/dashboard/security"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredPath="dashboard/security" requiredRoles={['ADMIN']}>
                  <Navigate to="/audit?blockchain=1" replace />
                </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <DashboardLayout><AdminDashboardPage /></DashboardLayout>
                </PrivateRoute>
          }
        />
        <Route
          path="/change-password"
          element={
            requiresPasswordChangeWithMfaSetup
              ? <ChangePasswordPage />
              : requiresPeriodicPasswordChange
                ? <Navigate to="/update-password" replace />
                : (isAuthenticated ? <ChangePasswordPage /> : <Navigate to="/login" />)
          }
        />
        <Route
          path="/update-password"
          element={
            requiresPeriodicPasswordChange
              ? <PeriodicPasswordChangePage />
              : requiresPasswordChangeWithMfaSetup
                ? <Navigate to="/change-password" replace />
                : (isAuthenticated ? <PeriodicPasswordChangePage /> : <Navigate to="/login" />)
          }
        />
        <Route
          path="/mfa-setup"
          element={
            // Allow MFA setup page ONLY if:
            // 1. User is in store AND (needs MFA setup OR is rebinding)
            // This ensures the page works after refresh as long as the user session is valid.
            !!user
              ? <MfaSetupPage />
              : <Navigate to="/login" />
          }
        />
        <Route
          path="/me"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute>
                  <ProfilePage />
                </PrivateRoute>
          }
        />
        <Route
          path="/admin"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <AdminPage />
                </PrivateRoute>
          }
        />
        <Route
          path="/admin/users/:userId/edit"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <EditUserPage />
                </PrivateRoute>
          }
        />
        <Route
          path="/admin/recovery"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <DashboardLayout><RecoveryAccountsPage /></DashboardLayout>
                </PrivateRoute>
          }
        />
        <Route
          path="/admin/blockchain-health"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <BlockchainHealthPage />
                </PrivateRoute>
          }
        />
        <Route
          path="/admin/blocked-ips"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <BlockedIpsPage />
                </PrivateRoute>
          }
        />
        <Route
          path="/admin/watermark-traceback"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <DashboardLayout><WatermarkTracebackPage /></DashboardLayout>
                </PrivateRoute>
          }
        />

        {/* Document routes - EMPLOYEE and MANAGER only, not REVIEWER */}
        <Route
          path="/documents"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredRoles={['EMPLOYEE', 'MANAGER']}>
                  <DocumentsPage />
                </PrivateRoute>
          }
        />
        <Route
          path="/upload"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredRoles={['EMPLOYEE', 'MANAGER']}>
                  <UploadPage />
                </PrivateRoute>
          }
        />
        <Route
          path="/upload/result/:jobId"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredRoles={['EMPLOYEE', 'MANAGER']}>
                  <UploadResultPage />
                </PrivateRoute>
          }
        />
        <Route
          path="/documents/:id"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredRoles={['EMPLOYEE', 'MANAGER']}>
                  <DocumentDetailPage />
                </PrivateRoute>
          }
        />
        <Route
          path="/documents/:documentId/signatures"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredRoles={['EMPLOYEE', 'MANAGER', 'REVIEWER', 'ADMIN']}>
                  <SignatureChainPage />
                </PrivateRoute>
          }
        />

        {/* Workflow routes */}
        {/* Classification Review routes */}
        <Route
          path="/classification/review"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredRoles={['REVIEWER', 'ADMIN']}>
                  <ClassificationReviewPage />
                </PrivateRoute>
          }
        />

        {/* Audit Log routes */}
        <Route
          path="/audit"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredRoles={['ADMIN']}>
                  <AuditLogPage />
                </PrivateRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute>
                  <NotificationsPage />
                </PrivateRoute>
          }
        />

        {/* EDR Console routes */}
        <Route
          path="/edr"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredRoles={['ADMIN']}>
                  <EDRConsolePage />
                </PrivateRoute>
          }
        />
        <Route
          path="/edr/policies"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredRoles={['ADMIN']}>
                  <EDRPoliciesPage />
                </PrivateRoute>
          }
        />

        {/* UEBA routes - admin only */}
        <Route
          path="/ueba"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredPath="ueba" requiredRoles={['ADMIN']}>
                  <UebaDashboardPage />
                </PrivateRoute>
          }
        />
        <Route
          path="/ueba/users"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredRoles={['ADMIN']}>
                  <UebaUsersPage />
                </PrivateRoute>
          }
        />
        <Route
          path="/ueba/incidents"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredRoles={['ADMIN']}>
                  <UebaIncidentsPage />
                </PrivateRoute>
          }
        />
        <Route
          path="/ueba/policies"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute requiredRoles={['ADMIN']}>
                  <UebaPoliciesPage />
                </PrivateRoute>
          }
        />

        <Route
          path="/workflows"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute>
                  <WorkflowFormPage />
                </PrivateRoute>
          }
        />
        <Route
          path="/my-shares"
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} />
              : <PrivateRoute>
                  <MySharesPage />
                </PrivateRoute>
          }
        />

        {/* Default dashboard landing */}
        <Route 
          path="/" 
          element={
            requiresPasswordChange
              ? <Navigate to={passwordChangeRedirectPath} replace />
              : <PrivateRoute>
                  <Navigate to={roleDefaultPath()} replace />
                </PrivateRoute>
          } 
        />
        <Route 
          path="*" 
          element={
            <Navigate to={
              isAuthenticated 
                ? (requiresPasswordChange ? passwordChangeRedirectPath : roleDefaultPath())
                : "/login"
            } /> 
          } 
        />
      </Routes>
    )
}

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <MfaRedirect />
      <AccountStatusGuard />
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
