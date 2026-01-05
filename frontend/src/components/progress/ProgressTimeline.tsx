/**
 * Progress Timeline Component
 * Displays project progress logs with hash chain integrity verification and chart
 */

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Skeleton from '@mui/material/Skeleton'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import {
  CheckCircle2,
  Shield,
  ShieldAlert,
  Calendar,
  TrendingUp,
  User,
  FileText,
  ChevronDown,
} from 'lucide-react'
import { fetchProgressLogs, verifyProgressChain } from '../../api/progress'
import type { ProgressLog } from '../../types/progress'

interface ProgressTimelineProps {
  projectId: string
}

export default function ProgressTimeline({ projectId }: ProgressTimelineProps) {
  // Fetch progress logs
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['progress', projectId],
    queryFn: () => fetchProgressLogs(projectId),
  })

  // Fetch hash chain verification
  const { data: verification } = useQuery({
    queryKey: ['progress-verification', projectId],
    queryFn: () => verifyProgressChain(projectId),
    enabled: Boolean(logs?.length),
  })

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 1 }} />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={4} key={i}>
              <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading progress logs. Please try again.
      </Alert>
    )
  }

  if (!logs?.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
        <TrendingUp size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
        <Typography>No progress logs yet.</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Add your first progress report to get started.
        </Typography>
      </Box>
    )
  }

  // Prepare chart data (chronological order)
  const chartData = [...logs].reverse().map((log) => ({
    date: format(new Date(log.report_date), 'MMM dd'),
    progress: log.reported_percent,
    fullDate: log.report_date,
  }))

  // Get latest progress
  const latestProgress = logs[0]?.reported_percent || 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Hash Chain Verification Status */}
      <Alert
        severity={verification?.chain_valid ? 'success' : 'warning'}
        icon={verification?.chain_valid ? <Shield size={20} /> : <ShieldAlert size={20} />}
      >
        <Typography fontWeight={500}>
          Hash Chain Integrity: {verification?.chain_valid ? 'Valid' : 'Warning'}
        </Typography>
        <Typography variant="body2">
          {verification?.chain_valid
            ? 'All progress logs are cryptographically verified and tamper-proof.'
            : 'Potential integrity issue detected. Some logs may have been modified.'}
        </Typography>
      </Alert>

      {/* Progress Summary Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, bgcolor: 'primary.50', border: 1, borderColor: 'primary.200' }}>
            <Typography variant="body2" fontWeight={500} color="primary.main" sx={{ mb: 0.5 }}>
              Total Logs
            </Typography>
            <Typography variant="h4" fontWeight={700}>
              {logs.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, bgcolor: 'success.50', border: 1, borderColor: 'success.200' }}>
            <Typography variant="body2" fontWeight={500} color="success.main" sx={{ mb: 0.5 }}>
              Current Progress
            </Typography>
            <Typography variant="h4" fontWeight={700}>
              {Math.round(latestProgress)}%
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, bgcolor: 'secondary.50', border: 1, borderColor: 'secondary.200' }}>
            <Typography variant="body2" fontWeight={500} color="secondary.main" sx={{ mb: 0.5 }}>
              Last Updated
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {logs[0] ? format(new Date(logs[0].report_date), 'MMM dd, yyyy') : '—'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Progress Chart */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          Progress Over Time
        </Typography>
        <Box sx={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
              <YAxis domain={[0, 100]} stroke="#6B7280" fontSize={12} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB' }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Progress']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <ReferenceLine y={100} stroke="#22C55E" strokeDasharray="5 5" label={{ value: '100%', position: 'right', fill: '#22C55E' }} />
              <Line
                type="monotone"
                dataKey="progress"
                stroke="#3B82F6"
                strokeWidth={3}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Paper>

      {/* Timeline List */}
      <Box>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          Progress History
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {logs.map((log, index) => (
            <TimelineItem
              key={log.progress_id}
              log={log}
              isFirst={index === 0}
              isLast={index === logs.length - 1}
            />
          ))}
        </Box>
      </Box>
    </Box>
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
  const isValid = log.hash_valid !== false

  return (
    <Box sx={{ position: 'relative', display: 'flex', gap: 2, pb: 4 }}>
      {/* Timeline Line */}
      {!isLast && (
        <Box
          sx={{
            position: 'absolute',
            left: 23,
            top: 48,
            bottom: 0,
            width: 2,
            bgcolor: 'grey.200',
          }}
        />
      )}

      {/* Timeline Dot */}
      <Box sx={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: isValid ? 'success.100' : 'warning.100',
            color: isValid ? 'success.main' : 'warning.main',
          }}
        >
          {isValid ? <CheckCircle2 size={24} /> : <ShieldAlert size={24} />}
        </Box>
      </Box>

      {/* Content */}
      <Paper sx={{ flex: 1, p: 2.5 }} variant="outlined">
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Typography variant="h5" fontWeight={700}>
                {Math.round(log.reported_percent)}%
              </Typography>
              {isFirst && (
                <Chip label="Latest" size="small" color="primary" />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'text.secondary' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Calendar size={14} />
                <Typography variant="body2">
                  {format(new Date(log.report_date), 'MMM dd, yyyy')}
                </Typography>
              </Box>
              {log.reporter_name && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <User size={14} />
                  <Typography variant="body2">{log.reporter_name}</Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Hash Status Badge */}
          <Chip
            icon={isValid ? <Shield size={14} /> : <ShieldAlert size={14} />}
            label={isValid ? 'Verified' : 'Warning'}
            size="small"
            color={isValid ? 'success' : 'warning'}
            variant="outlined"
          />
        </Box>

        {/* Progress Bar */}
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={log.reported_percent}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        {/* Remarks */}
        {log.remarks && (
          <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }} variant="outlined">
            <Box sx={{ display: 'flex', gap: 1 }}>
              <FileText size={16} style={{ color: '#9CA3AF', marginTop: 2 }} />
              <Typography variant="body2" color="text.secondary">
                {log.remarks}
              </Typography>
            </Box>
          </Paper>
        )}

        {/* Hash Information */}
        <Accordion disableGutters elevation={0} sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ChevronDown size={16} />} sx={{ p: 0, minHeight: 'auto' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              Hash Chain Details
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0, pt: 1 }}>
            <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
              <Box sx={{ mb: 0.5 }}>
                <span style={{ color: '#6B7280' }}>Current: </span>
                {log.record_hash?.substring(0, 32)}...
              </Box>
              {log.prev_hash && (
                <Box>
                  <span style={{ color: '#6B7280' }}>Previous: </span>
                  {log.prev_hash.substring(0, 32)}...
                </Box>
              )}
            </Typography>
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Box>
  )
}
