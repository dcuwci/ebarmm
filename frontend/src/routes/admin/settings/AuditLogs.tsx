/**
 * Audit Logs Page
 * View and filter system audit logs (super_admin only)
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TablePagination from '@mui/material/TablePagination'
import Collapse from '@mui/material/Collapse'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import {
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  History,
  Filter,
  Eye,
} from 'lucide-react'
import { Button, Table, LoadingSpinner } from '../../../components/mui'
import type { Column } from '../../../components/mui'
import {
  listAuditLogs,
  getAuditLog,
  exportAuditLogs,
  AuditLog,
  AuditLogListParams,
} from '../../../api/audit'
import { listUsers } from '../../../api/users'
import { format } from 'date-fns'

// Action types for filtering
const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
]

// Entity types for filtering
const ENTITY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'project', label: 'Project' },
  { value: 'user', label: 'User' },
  { value: 'group', label: 'Group' },
  { value: 'access_right', label: 'Access Right' },
  { value: 'gis_feature', label: 'GIS Feature' },
  { value: 'progress_log', label: 'Progress Log' },
  { value: 'media', label: 'Media' },
]

const getActionColor = (action: string): 'default' | 'primary' | 'success' | 'warning' | 'error' => {
  if (action.includes('CREATE') || action.includes('LOGIN')) return 'success'
  if (action.includes('UPDATE')) return 'primary'
  if (action.includes('DELETE') || action.includes('LOGOUT')) return 'error'
  return 'default'
}

export default function AuditLogs() {
  // Filter state
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Expanded rows for payload viewing
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)

  // Query params
  const queryParams: AuditLogListParams = {
    offset: currentPage * itemsPerPage,
    limit: itemsPerPage,
    search: search || undefined,
    action: actionFilter || undefined,
    entity_type: entityTypeFilter || undefined,
    actor_id: actorFilter || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  }

  // Fetch audit logs
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => listAuditLogs(queryParams),
  })

  // Fetch users for actor filter
  const { data: usersData } = useQuery({
    queryKey: ['users', { limit: 100 }],
    queryFn: () => listUsers({ limit: 100 }),
  })

  // Fetch single audit log for detail view
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['audit-log', selectedLogId],
    queryFn: () => (selectedLogId ? getAuditLog(selectedLogId) : Promise.resolve(null)),
    enabled: !!selectedLogId && detailDialogOpen,
  })

  // Toggle row expansion
  const toggleRow = (auditId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(auditId)) {
      newExpanded.delete(auditId)
    } else {
      newExpanded.add(auditId)
    }
    setExpandedRows(newExpanded)
  }

  // Export to CSV
  const handleExportCSV = async () => {
    try {
      const blob = await exportAuditLogs(startDate || undefined, endDate || undefined, 'csv')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `audit_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  // Clear filters
  const handleClearFilters = () => {
    setSearch('')
    setActionFilter('')
    setEntityTypeFilter('')
    setActorFilter('')
    setStartDate('')
    setEndDate('')
    setCurrentPage(0)
  }

  const hasFilters = search || actionFilter || entityTypeFilter || actorFilter || startDate || endDate

  const columns: Column<AuditLog>[] = [
    {
      key: 'expand',
      header: '',
      render: (row) => (
        <IconButton size="small" onClick={() => toggleRow(row.audit_id)}>
          {expandedRows.has(row.audit_id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </IconButton>
      ),
    },
    {
      key: 'created_at',
      header: 'Timestamp',
      render: (row) => (
        <Typography variant="body2">
          {format(new Date(row.created_at), 'MMM d, yyyy HH:mm:ss')}
        </Typography>
      ),
    },
    {
      key: 'actor_username',
      header: 'User',
      render: (row) => (
        <Typography variant="body2" fontWeight={500}>
          {row.actor_username || 'System'}
        </Typography>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Chip
          label={row.action.replace('_', ' ')}
          color={getActionColor(row.action)}
          size="small"
        />
      ),
    },
    {
      key: 'entity_type',
      header: 'Resource',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.entity_type}
        </Typography>
      ),
    },
    {
      key: 'entity_id',
      header: 'Record ID',
      render: (row) => (
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
          {row.entity_id ? row.entity_id.substring(0, 8) + '...' : '—'}
        </Typography>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Tooltip title="View details">
          <IconButton
            size="small"
            onClick={() => {
              setSelectedLogId(row.audit_id)
              setDetailDialogOpen(true)
            }}
          >
            <Eye size={18} />
          </IconButton>
        </Tooltip>
      ),
    },
  ]

  // Custom row renderer to include expanded content
  const renderRow = (row: AuditLog, index: number) => {
    const isExpanded = expandedRows.has(row.audit_id)
    return (
      <>
        {isExpanded && row.payload && (
          <tr>
            <td colSpan={7} style={{ padding: 0 }}>
              <Collapse in={isExpanded}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'action.hover',
                    borderTop: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Payload Details
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        overflow: 'auto',
                        maxHeight: 200,
                      }}
                    >
                      {JSON.stringify(row.payload, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              </Collapse>
            </td>
          </tr>
        )}
      </>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Audit Logs
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            View system activity and change history
          </Typography>
        </Box>
        <Button
          variant="secondary"
          onClick={handleExportCSV}
          startIcon={<Download size={20} />}
          disabled={!data?.items.length}
        >
          Export CSV
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <TextField
            placeholder="Search..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(0)
            }}
            size="small"
            sx={{ minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} color="#9e9e9e" />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Action</InputLabel>
            <Select
              value={actionFilter}
              label="Action"
              onChange={(e) => {
                setActionFilter(e.target.value)
                setCurrentPage(0)
              }}
            >
              {ACTION_TYPES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Resource</InputLabel>
            <Select
              value={entityTypeFilter}
              label="Resource"
              onChange={(e) => {
                setEntityTypeFilter(e.target.value)
                setCurrentPage(0)
              }}
            >
              {ENTITY_TYPES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>User</InputLabel>
            <Select
              value={actorFilter}
              label="User"
              onChange={(e) => {
                setActorFilter(e.target.value)
                setCurrentPage(0)
              }}
            >
              <MenuItem value="">All Users</MenuItem>
              {usersData?.items.map((user) => (
                <MenuItem key={user.user_id} value={user.user_id}>
                  {user.username}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setCurrentPage(0)
            }}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />

          <TextField
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              setCurrentPage(0)
            }}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />

          {hasFilters && (
            <Button variant="text" size="small" onClick={handleClearFilters} startIcon={<Filter size={16} />}>
              Clear Filters
            </Button>
          )}
        </Box>
      </Paper>

      {/* Results Summary */}
      {data && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {queryParams.offset! + 1} - {Math.min(queryParams.offset! + itemsPerPage, data.total)} of{' '}
          {data.total} logs
        </Typography>
      )}

      {/* Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
            <LoadingSpinner size="lg" />
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Loading audit logs...
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="error">
              Error loading audit logs. You may not have permission to view this page.
            </Typography>
          </Box>
        ) : !data?.items.length ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <History size={48} color="#9e9e9e" />
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              No audit logs found. Try adjusting your filters.
            </Typography>
          </Box>
        ) : (
          <>
            <Table
              columns={columns}
              data={data.items}
              rowKey={(row) => row.audit_id}
            />
            <TablePagination
              component="div"
              count={data.total}
              page={currentPage}
              onPageChange={(_, newPage) => setCurrentPage(newPage)}
              rowsPerPage={itemsPerPage}
              onRowsPerPageChange={(e) => {
                setItemsPerPage(parseInt(e.target.value, 10))
                setCurrentPage(0)
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </Paper>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Audit Log Details</DialogTitle>
        <DialogContent>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <LoadingSpinner />
            </Box>
          ) : detailData ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Timestamp
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(detailData.created_at), 'MMM d, yyyy HH:mm:ss')}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    User
                  </Typography>
                  <Typography variant="body1">
                    {detailData.actor_username || 'System'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Action
                  </Typography>
                  <Box>
                    <Chip
                      label={detailData.action}
                      color={getActionColor(detailData.action)}
                      size="small"
                    />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Resource Type
                  </Typography>
                  <Typography variant="body1">{detailData.entity_type}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Record ID
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {detailData.entity_id || '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    IP Address
                  </Typography>
                  <Typography variant="body1">{detailData.ip_address || '—'}</Typography>
                </Box>
              </Box>

              {detailData.payload && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Payload
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, mt: 0.5, bgcolor: 'action.hover' }}>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        overflow: 'auto',
                        maxHeight: 300,
                      }}
                    >
                      {JSON.stringify(detailData.payload, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}

              {detailData.user_agent && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    User Agent
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                    {detailData.user_agent}
                  </Typography>
                </Box>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
