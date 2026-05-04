import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getPreferredDashboardPath } from '../utils/dashboardPaths'

interface PrivateRouteProps {
  children: React.ReactNode
  requiredPath?: string
  requiredRoles?: string[] // Optional: explicit required roles for the route
}

/**
 * PrivateRoute component - Protects routes based on authentication and role-based permissions
 *
 * Features:
 * - Redirects to login if user is not authenticated
 * - Checks if user has permission to access the route (via availableDashboards or requiredRoles)
 * - Redirects to home page if user lacks permission
 * - Checks authorization before rendering the page to prevent unauthorized access
 *
 * Usage:
 * <PrivateRoute requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
 *   <AdminDashboard />
 * </PrivateRoute>
 */
export default function PrivateRoute({ children, requiredPath, requiredRoles }: PrivateRouteProps) {
  const { isAuthenticated, user } = useAuthStore()

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  const defaultDashboardPath = getPreferredDashboardPath(user)

  // Role check (highest priority)
  if (requiredRoles && requiredRoles.length > 0) {
    const userRoles = user.roles || []
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role))
    
    if (!hasRequiredRole) {
      // Silently redirect to the correct default dashboard for this user (no logging to avoid UEBA triggers)
      return <Navigate to={defaultDashboardPath} replace />
    }
  }

  // If no specific path required (general protected route), allow access
  if (!requiredPath) {
    return <>{children}</>
  }

  // Check if user has permission to access this specific route
  if (user.availableDashboards && user.availableDashboards.includes(requiredPath)) {
    return <>{children}</>
  }

  // User is authenticated but lacks permission - silently redirect based on role (no logging to avoid UEBA triggers)
  return <Navigate to={defaultDashboardPath} replace />
}
