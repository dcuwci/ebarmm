/**
 * Project List Page
 * Admin interface for viewing and managing projects
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import LinearProgress from '@mui/material/LinearProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TablePagination from '@mui/material/TablePagination'
import {
  Search,
  Download,
  Plus,
  Eye,
  Edit,
} from 'lucide-react'
import { Button, Table, LoadingSpinner } from '../../components/mui'
import type { Column } from '../../components/mui'
import { fetchProjects } from '../../api/projects'
import type { Project, ProjectStatus } from '../../types/project'
import { format } from 'date-fns'

const STATUS_OPTIONS: { value: ProjectStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'planning', label: 'Planning' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
]

const getStatusColor = (status: ProjectStatus): 'default' | 'primary' | 'success' | 'warning' | 'error' => {
  const colors: Record<ProjectStatus, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
    planning: 'default',
    ongoing: 'primary',
    completed: 'success',
    suspended: 'warning',
    cancelled: 'error',
    deleted: 'default',
  }
  return colors[status] || 'default'
}

export default function ProjectList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ProjectStatus | ''>('')
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Calculate offset
  const offset = currentPage * itemsPerPage

  // Fetch projects
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', { search, status, limit: itemsPerPage, offset }],
    queryFn: () =>
      fetchProjects({
        search: search || undefined,
        status: status || undefined,
        limit: itemsPerPage,
        offset,
      }),
  })

  /**
   * Export to CSV
   */
  const handleExportCSV = () => {
    if (!data?.items.length) return

    const headers = [
      'Project ID',
      'DEO',
      'Project Title',
      'Location',
      'Fund Source',
      'Mode of Implementation',
      'Project Cost',
      'Project Scale',
      'Fund Year',
      'Status',
      'Progress (%)',
      'Created At',
    ]

    const rows = data.items.map((project) => [
      project.project_id,
      project.deo_name || '',
      project.project_title,
      project.location || '',
      project.fund_source || '',
      project.mode_of_implementation || '',
      project.project_cost,
      project.project_scale || '',
      project.fund_year,
      project.status,
      project.current_progress || 0,
      format(new Date(project.created_at), 'yyyy-MM-dd HH:mm:ss'),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `projects_${format(new Date(), 'yyyy-MM-dd')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  const columns: Column<Project>[] = [
    {
      key: 'project_title',
      header: 'Project',
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {row.project_title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.fund_source}
          </Typography>
        </Box>
      ),
    },
    {
      key: 'deo_name',
      header: 'DEO',
      render: (row) => (
        <Typography variant="body2">{row.deo_name}</Typography>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.location || '—'}
        </Typography>
      ),
    },
    {
      key: 'project_cost',
      header: 'Cost',
      render: (row) => (
        <Typography variant="body2">{formatCurrency(row.project_cost)}</Typography>
      ),
    },
    {
      key: 'fund_year',
      header: 'Year',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.fund_year}
        </Typography>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <Chip
          label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
          color={getStatusColor(row.status)}
          size="small"
        />
      ),
    },
    {
      key: 'current_progress',
      header: 'Progress',
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinearProgress
            variant="determinate"
            value={row.current_progress || 0}
            sx={{ width: 60, height: 6, borderRadius: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            {Math.round(row.current_progress || 0)}%
          </Typography>
        </Box>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
          <Tooltip title="View details">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/admin/projects/${row.project_id}`)
              }}
            >
              <Eye size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit project">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/admin/projects/${row.project_id}/edit`)
              }}
            >
              <Edit size={18} />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ]

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Projects
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Manage infrastructure projects across BARMM
          </Typography>
        </Box>
        <Button
          variant="primary"
          onClick={() => navigate('/admin/projects/new')}
          startIcon={<Plus size={20} />}
        >
          New Project
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search by title or location..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(0)
            }}
            size="small"
            sx={{ minWidth: 300, flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} color="#9e9e9e" />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={status}
              label="Status"
              onChange={(e) => {
                setStatus(e.target.value as ProjectStatus | '')
                setCurrentPage(0)
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="secondary"
            onClick={handleExportCSV}
            disabled={!data?.items.length}
            startIcon={<Download size={20} />}
          >
            Export CSV
          </Button>
        </Box>
      </Paper>

      {/* Results Summary */}
      {data && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {offset + 1} - {Math.min(offset + itemsPerPage, data.total)} of{' '}
          {data.total} projects
        </Typography>
      )}

      {/* Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
            <LoadingSpinner size="lg" />
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Loading projects...
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="error">
              Error loading projects. Please try again.
            </Typography>
          </Box>
        ) : !data?.items.length ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">
              No projects found. Try adjusting your filters or create a new project.
            </Typography>
          </Box>
        ) : (
          <>
            <Table
              columns={columns}
              data={data.items}
              rowKey={(row) => row.project_id}
              onRowClick={(row) => navigate(`/admin/projects/${row.project_id}`)}
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
    </Box>
  )
}
