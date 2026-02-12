'use client'

import { useEffect, useState } from 'react'
import type { AuditLog, AuditLogFilter } from '@/types/shop'
import { auditApi } from '@/lib/api/audit'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [filter, setFilter] = useState<AuditLogFilter>({})
  const [appliedFilter, setAppliedFilter] = useState<AuditLogFilter>({})

  // Fetch actions for dropdown
  useEffect(() => {
    const fetchActions = async () => {
      const result = await auditApi.getActions()
      if (result.success && result.data) {
        setActions(result.data)
      }
    }
    fetchActions()
  }, [])

  // Fetch logs
  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await auditApi.getLogs(appliedFilter)
        if (result.success && result.data) {
          setLogs(result.data)
        } else {
          setError(result.message || result.error || 'Failed to fetch logs')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLogs()
  }, [appliedFilter])

  const handleApplyFilter = () => {
    setAppliedFilter({ ...filter })
  }

  const handleClearFilter = () => {
    setFilter({})
    setAppliedFilter({})
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP')
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-violet-500 hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Audit Log</h1>

      {/* Filter Form */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">User ID</label>
            <Input
              value={filter.userId || ''}
              onChange={(e) => setFilter({ ...filter, userId: e.target.value || undefined })}
              placeholder="Filter by user ID"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Action</label>
            <select
              value={filter.action || ''}
              onChange={(e) => setFilter({ ...filter, action: e.target.value || undefined })}
              className="w-full rounded bg-gray-100 dark:bg-gray-700 px-4 py-2 text-gray-800 dark:text-gray-100"
            >
              <option value="">All actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">From Date</label>
            <Input
              type="date"
              value={filter.dateFrom || ''}
              onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value || undefined })}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">To Date</label>
            <Input
              type="date"
              value={filter.dateTo || ''}
              onChange={(e) => setFilter({ ...filter, dateTo: e.target.value || undefined })}
            />
          </div>

          <div className="flex items-end gap-2">
            <Button onClick={handleApplyFilter}>Apply</Button>
            <Button onClick={handleClearFilter} className="bg-gray-600 hover:bg-gray-500">
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* Logs Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : logs.length === 0 ? (
        <Card className="text-center py-12 text-gray-500 dark:text-gray-400">
          No audit logs found
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-800 dark:text-gray-100">Timestamp</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-800 dark:text-gray-100">User ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-800 dark:text-gray-100">Action</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-800 dark:text-gray-100">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {formatDate(log.ts)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-300">
                      {log.userId.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded bg-violet-600/30 text-violet-300 text-sm">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {log.detail ? JSON.stringify(log.detail) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-sm text-gray-500 dark:text-gray-400 text-right">
        Total: {logs.length} logs
      </p>
    </div>
  )
}
