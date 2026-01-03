/**
 * Progress Timeline Component
 * Displays project progress logs with hash chain integrity verification
 */

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  CheckCircle2,
  XCircle,
  Shield,
  ShieldAlert,
  Calendar,
  TrendingUp,
  User,
  FileText,
  Link as LinkIcon,
} from 'lucide-react'
import { fetchProgressLogs, verifyHashChain } from '../../api/progress'
import type { ProgressLog } from '../../types/progress'

interface ProgressTimelineProps {
  projectId: string
}

export default function ProgressTimeline({ projectId }: ProgressTimelineProps) {
  // Fetch progress logs
  const { data, isLoading, error } = useQuery({
    queryKey: ['progress', projectId],
    queryFn: () => fetchProgressLogs(projectId),
  })

  // Fetch hash chain verification
  const { data: verification } = useQuery({
    queryKey: ['progress-verification', projectId],
    queryFn: () => verifyHashChain(projectId),
  })

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-2 text-gray-600">Loading progress logs...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error loading progress logs. Please try again.</p>
      </div>
    )
  }

  if (!data?.items.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <TrendingUp size={48} className="mx-auto mb-3 opacity-50" />
        <p>No progress logs yet.</p>
        <p className="text-sm mt-1">Add your first progress report to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hash Chain Verification Status */}
      <div
        className={`flex items-center gap-3 p-4 rounded-lg ${
          verification?.is_valid
            ? 'bg-green-50 border border-green-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}
      >
        {verification?.is_valid ? (
          <Shield className="text-green-600" size={24} />
        ) : (
          <ShieldAlert className="text-yellow-600" size={24} />
        )}
        <div>
          <p
            className={`font-medium ${
              verification?.is_valid ? 'text-green-900' : 'text-yellow-900'
            }`}
          >
            {verification?.is_valid
              ? 'Hash Chain Integrity: Valid'
              : 'Hash Chain Integrity: Warning'}
          </p>
          <p
            className={`text-sm ${
              verification?.is_valid ? 'text-green-700' : 'text-yellow-700'
            }`}
          >
            {verification?.is_valid
              ? 'All progress logs are cryptographically verified and tamper-proof.'
              : `Potential integrity issue detected${
                  verification?.broken_at
                    ? ` at log #${verification.broken_at}`
                    : ''
                }.`}
          </p>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-600 mb-1">Total Logs</p>
          <p className="text-2xl font-bold text-gray-900">{data.total}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm font-medium text-green-600 mb-1">Latest Progress</p>
          <p className="text-2xl font-bold text-gray-900">
            {Math.round(data.items[0]?.reported_percent || 0)}%
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm font-medium text-purple-600 mb-1">Last Updated</p>
          <p className="text-sm font-bold text-gray-900">
            {data.items[0]
              ? format(new Date(data.items[0].report_date), 'MMM dd, yyyy')
              : '—'}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {data.items.map((log: ProgressLog, index: number) => (
          <TimelineItem
            key={log.progress_id}
            log={log}
            isFirst={index === 0}
            isLast={index === data.items.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Timeline Item Component
 */
function TimelineItem({
  log,
  isFirst,
  isLast,
}: {
  log: ProgressLog
  isFirst: boolean
  isLast: boolean
}) {
  return (
    <div className="relative flex gap-4 pb-8">
      {/* Timeline Line */}
      {!isLast && (
        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200" />
      )}

      {/* Timeline Dot */}
      <div className="relative z-10 flex-shrink-0">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            log.is_hash_valid
              ? 'bg-green-100 text-green-600'
              : 'bg-yellow-100 text-yellow-600'
          }`}
        >
          {log.is_hash_valid ? (
            <CheckCircle2 size={24} />
          ) : (
            <ShieldAlert size={24} />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl font-bold text-gray-900">
                {Math.round(log.reported_percent)}%
              </span>
              {isFirst && (
                <span className="inline-flex px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                  Latest
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                <span>{format(new Date(log.report_date), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center gap-1">
                <User size={14} />
                <span>Reported by: {log.reported_by}</span>
              </div>
            </div>
          </div>

          {/* Hash Status Badge */}
          <div
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${
              log.is_hash_valid
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {log.is_hash_valid ? (
              <>
                <Shield size={12} />
                Verified
              </>
            ) : (
              <>
                <ShieldAlert size={12} />
                Warning
              </>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${log.reported_percent}%` }}
            />
          </div>
        </div>

        {/* Remarks */}
        {log.remarks && (
          <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-100">
            <div className="flex items-start gap-2">
              <FileText size={16} className="text-gray-400 mt-0.5" />
              <p className="text-sm text-gray-700">{log.remarks}</p>
            </div>
          </div>
        )}

        {/* Hash Information */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <details className="group">
            <summary className="flex items-center gap-2 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700">
              <LinkIcon size={12} />
              <span>Hash Chain Details</span>
              <span className="ml-auto group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <div className="mt-2 space-y-1 text-xs text-gray-600 font-mono">
              <div className="break-all">
                <span className="text-gray-500">Current: </span>
                {log.current_hash.substring(0, 32)}...
              </div>
              {log.previous_hash && (
                <div className="break-all">
                  <span className="text-gray-500">Previous: </span>
                  {log.previous_hash.substring(0, 32)}...
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
