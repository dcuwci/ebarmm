/**
 * Project Audit Log Component
 * Displays change history for a specific project
 */

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import {
  History,
  User,
  Calendar,
  ChevronDown,
  Plus,
  Edit,
  Trash2,
  Eye,
  FileText,
} from 'lucide-react'
import { getEntityHistory } from '../../api/audit'

interface ProjectAuditLogProps {
  projectId: string
}

// Action type colors and icons
const ACTION_CONFIG: Record<string, { color: 'success' | 'primary' | 'error' | 'default'; icon: typeof Plus; label: string }> = {
  CREATE: { color: 'success', icon: Plus, label: 'Created' },
  CREATE_PROJECT: { color: 'success', icon: Plus, label: 'Created' },
  UPDATE: { color: 'primary', icon: Edit, label: 'Updated' },
  UPDATE_PROJECT: { color: 'primary', icon: Edit, label: 'Updated' },
  DELETE: { color: 'error', icon: Trash2, label: 'Deleted' },
  DELETE_PROJECT: { color: 'error', icon: Trash2, label: 'Deleted' },
  VIEW: { color: 'default', icon: Eye, label: 'Viewed' },
  CREATE_PROGRESS: { color: 'success', icon: Plus, label: 'Progress Added' },
  CREATE_GIS_FEATURE: { color: 'success', icon: Plus, label: 'GIS Feature Added' },
  UPDATE_GIS_FEATURE: { color: 'primary', icon: Edit, label: 'GIS Feature Updated' },
  DELETE_GIS_FEATURE: { color: 'error', icon: Trash2, label: 'GIS Feature Deleted' },
  UPLOAD_MEDIA: { color: 'success', icon: Plus, label: 'Media Uploaded' },
  DELETE_MEDIA: { color: 'error', icon: Trash2, label: 'Media Deleted' },
}

export default function ProjectAuditLog({ projectId }: ProjectAuditLogProps) {
  // Fetch project history
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-history', 'project', projectId],
    queryFn: () => getEntityHistory('project', projectId),
  })

  if (isLoading) {
    return (
      <Box>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
        ))}
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading audit history. Please try again.
      </Alert>
    )
  }

  if (!data?.history.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
        <History size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
        <Typography>No audit history available.</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Changes to this project will be logged here.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Summary */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <FileText size={20} />
        <Typography variant="subtitle1" fontWeight={600}>
          {data.total_changes} Changes Recorded
        </Typography>
      </Box>

      {/* History List */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={180}>Date</TableCell>
              <TableCell width={150}>Action</TableCell>
              <TableCell width={150}>User</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.history.map((entry) => {
              const config = ACTION_CONFIG[entry.action] || {
                color: 'default' as const,
                icon: FileText,
                label: entry.action,
              }
              const Icon = config.icon

              return (
                <TableRow
                  key={entry.audit_id}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Calendar size={14} style={{ color: '#6B7280' }} />
                      <Typography variant="body2">
                        {format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm')}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={<Icon size={14} />}
                      label={config.label}
                      size="small"
                      color={config.color}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <User size={14} style={{ color: '#6B7280' }} />
                      <Typography variant="body2">
                        {entry.actor_username || 'System'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {entry.payload && Object.keys(entry.payload).length > 0 ? (
                      <PayloadDetails payload={entry.payload} />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No details
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

/**
 * Payload Details Component - expandable view of change details
 */
function PayloadDetails({ payload }: { payload: Record<string, unknown> }) {
  // Format value for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  // Filter out internal fields
  const displayEntries = Object.entries(payload).filter(
    ([key]) => !key.startsWith('_') && key !== 'password'
  )

  if (displayEntries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No details
      </Typography>
    )
  }

  // Show inline if only a few simple fields
  if (displayEntries.length <= 2) {
    return (
      <Typography variant="body2" color="text.secondary">
        {displayEntries.map(([key, value]) => `${key}: ${formatValue(value)}`).join(', ')}
      </Typography>
    )
  }

  // Show expandable accordion for more complex data
  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        bgcolor: 'transparent',
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ChevronDown size={14} />}
        sx={{ p: 0, minHeight: 'auto', '& .MuiAccordionSummary-content': { m: 0 } }}
      >
        <Typography variant="body2" color="primary">
          View {displayEntries.length} fields
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 1, pt: 0 }}>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1,
            bgcolor: 'grey.50',
            borderRadius: 1,
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            overflow: 'auto',
            maxHeight: 200,
          }}
        >
          {displayEntries.map(([key, value]) => (
            <div key={key}>
              <span style={{ color: '#6366F1' }}>{key}</span>
              <span style={{ color: '#64748B' }}>: </span>
              <span style={{ color: '#059669' }}>{formatValue(value)}</span>
            </div>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
