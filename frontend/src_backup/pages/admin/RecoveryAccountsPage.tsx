import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../../api'
import { useAuthStore } from '../../store/authStore'

interface RecoverableUser {
  id: number
  accountId: string
  fullName: string
  email: string
  department: string
  position: string
  roles: string[]
  deletedAt: string
}

type SortField = 'id' | 'accountId' | 'fullName' | 'email' | 'deletedAt'

export default function RecoveryAccountsPage() {
  const { theme } = useAuthStore()

  const [recoverableUsers, setRecoverableUsers] = useState<RecoverableUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('deletedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const usersRes = await apiClient.getAllUsers()
      const allUsers: RecoverableUser[] = usersRes.data || []
      const now = Date.now()
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
      const recoverables = allUsers.filter(u => {
        if (!u.deletedAt) return false
        return now - new Date(u.deletedAt).getTime() <= THIRTY_DAYS_MS
      })
      setRecoverableUsers(recoverables)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load recoverable accounts')
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreUser = async (userId: number) => {
    if (
      !confirm(
        'Restore this deleted account (within the last 30 days)?\n\nThe account will be restored in a DISABLED state and must be re-enabled by an admin.'
      )
    ) {
      return
    }

    try {
      await apiClient.restoreUser(userId)
      alert('Account restored successfully')
      load()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to restore account')
    }
  }

  const handlePurgeUser = async (user: RecoverableUser) => {
    if (
      !confirm(
        `⚠️ PERMANENT DELETE (cannot be undone)\n\nAccount: ${user.accountId}\nName: ${user.fullName}\n\nThis will permanently delete the user account record. Documents and related records will be reassigned to the archived identity.\n\nProceed?`
      )
    ) {
      return
    }

    try {
      await apiClient.purgeUser(user.id)
      alert('Account permanently deleted')
      load()
    } catch (err: any) {
      alert(err.response?.data?.message || err.response?.data?.details || 'Failed to permanently delete account')
    }
  }

  const filteredAndSorted = useMemo(() => {
    const search = searchTerm.toLowerCase()
    return recoverableUsers
      .filter(user => {
        if (!searchTerm) return true
        return (
          user.id.toString().includes(search) ||
          user.accountId.toLowerCase().includes(search) ||
          user.fullName.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search)
        )
      })
      .sort((a, b) => {
        let aValue: string | number = ''
        let bValue: string | number = ''
        switch (sortBy) {
          case 'id':
            aValue = a.id
            bValue = b.id
            break
          case 'accountId':
            aValue = a.accountId.toLowerCase()
            bValue = b.accountId.toLowerCase()
            break
          case 'fullName':
            aValue = a.fullName.toLowerCase()
            bValue = b.fullName.toLowerCase()
            break
          case 'email':
            aValue = a.email.toLowerCase()
            bValue = b.email.toLowerCase()
            break
          case 'deletedAt':
            aValue = new Date(a.deletedAt).getTime()
            bValue = new Date(b.deletedAt).getTime()
            break
        }

        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
  }, [recoverableUsers, searchTerm, sortBy, sortOrder])

  const requestSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const getSortIndicator = (field: SortField) => {
    if (sortBy !== field) return ''
    return sortOrder === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Recovery Accounts</h1>
          <p style={{ color: '#888', marginTop: '6px' }}>
            Manage accounts deleted within the last 30 days. You can search, sort, and restore them.
          </p>
        </div>
      </div>

      <div className="dashboard-card">
        {error && (
          <div className="error-message" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Search by ID, Account ID, Name, Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: '220px',
              padding: '10px 12px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
              background: theme === 'dark' ? '#2a2a2a' : '#fff',
              color: theme === 'dark' ? '#fff' : '#000'
            }}
          />
          <div style={{ alignSelf: 'center', color: '#888', fontSize: '0.9em' }}>
            Showing {filteredAndSorted.length} of {recoverableUsers.length} accounts
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '900px' }}>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => requestSort('id')}>
                  ID{getSortIndicator('id')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => requestSort('accountId')}>
                  Account ID{getSortIndicator('accountId')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => requestSort('fullName')}>
                  Full Name{getSortIndicator('fullName')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => requestSort('email')}>
                  Email{getSortIndicator('email')}
                </th>
                <th>Department</th>
                <th>Position</th>
                <th>Roles</th>
                <th style={{ cursor: 'pointer' }} onClick={() => requestSort('deletedAt')}>
                  Deleted At{getSortIndicator('deletedAt')}
                </th>
                <th>Remaining Days</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center' }}>
                    Loading...
                  </td>
                </tr>
              ) : filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                    {recoverableUsers.length === 0
                      ? 'No deleted accounts available for recovery right now.'
                      : 'No accounts match the search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map(user => {
                  const deletedDate = new Date(user.deletedAt)
                  const daysSinceDeleted = Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24))
                  const remainingDays = 30 - daysSinceDeleted
                  return (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>
                        <strong>{user.accountId}</strong>
                      </td>
                      <td>{user.fullName}</td>
                      <td>{user.email}</td>
                      <td>{user.department || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {user.roles.length > 0
                            ? user.roles.map(role => (
                                <span
                                  key={role}
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: theme === 'dark' ? '#2a2a2a' : '#f0f0f0',
                                    fontSize: '0.75em'
                                  }}
                                >
                                  {role}
                                </span>
                              ))
                            : '-'}
                        </div>
                      </td>
                      <td>
                        <div>{deletedDate.toLocaleString()}</div>
                      </td>
                      <td style={{ color: remainingDays <= 7 ? '#ff6b6b' : '#888' }}>
                        {remainingDays > 0 ? `${remainingDays} days` : 'Expired'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleRestoreUser(user.id)}
                            disabled={remainingDays <= 0}
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.85em',
                              background: remainingDays <= 0 ? '#6c757d' : '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: remainingDays <= 0 ? 'not-allowed' : 'pointer',
                              opacity: remainingDays <= 0 ? 0.6 : 1
                            }}
                            title={remainingDays <= 0 ? 'Recovery period expired' : 'Restore this account'}
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handlePurgeUser(user)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.85em',
                              background: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                            title="Permanently delete this account"
                          >
                            Delete Permanently
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

