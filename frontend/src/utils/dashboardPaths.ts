import { User } from '../types'

export function getPreferredDashboardPath(user?: User | null) {
  if (user?.roles?.includes('ADMIN')) {
    return '/dashboard/admin'
  }
  return '/dashboard'
}

