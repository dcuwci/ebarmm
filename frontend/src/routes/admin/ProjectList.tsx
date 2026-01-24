/**
 * Project List Page
 * Admin interface for viewing and managing projects
 */

import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TablePagination from '@mui/material/TablePagination'
import {
  Download,
  Plus,
  Eye,
  Edit,
} from 'lucide-react'
import { Button, Table, LoadingSpinner, DashboardFilter } from '../../components/mui'
import type { Column } from '../../components/mui'
import { apiClient } from '../../api/client'
import { useAuthStore } from '../../stores/authStore'
import { useFilterStore } from '../../stores/filterStore'
import type { Project, ProjectStatus } from '../../types/project'
import { format } from 'date-fns'

interface DEO {
  deo_id: number;
  deo_name: string;
  province: string;
  project_count: number;
}

interface FilterOptions {
  deos: DEO[];
  provinces: string[];
  statuses: string[];
  fund_years: number[];
  fund_sources: string[];
  modes_of_implementation: string[];
  project_scales: string[];
}

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
  const user = useAuthStore((state) => state.user)
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Filter state - persisted globally via Zustand store (shared with Dashboard)
  const {
    search,
    selectedDEOs,
    selectedProvinces,
    selectedStatuses,
    selectedFundYears,
    selectedFundSources,
    selectedModes,
    selectedScales,
    setSearch,
    setSelectedDEOs,
    setSelectedProvinces,
    setSelectedStatuses,
    setSelectedFundYears,
    setSelectedFundSources,
    setSelectedModes,
    setSelectedScales,
  } = useFilterStore()

  // Fetch filter options
  const { data: filterOptions, isLoading: filterOptionsLoading } = useQuery({
    queryKey: ['filterOptions'],
    queryFn: async () => {
      const response = await apiClient.get('/public/filter-options')
      return response.data as FilterOptions
    },
    staleTime: 5 * 60 * 1000,
  })

  // Build query params for API call
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams()
    params.append('limit', '500')

    if (search) params.append('search', search)

    // For API, send single values; multi-select is filtered client-side
    if (selectedDEOs.length === 1) {
      params.append('deo_id', selectedDEOs[0].toString())
    }
    if (selectedStatuses.length === 1) {
      params.append('status', selectedStatuses[0])
    }
    if (selectedFundYears.length === 1) {
      params.append('fund_year', selectedFundYears[0].toString())
    }
    if (selectedProvinces.length === 1) {
      params.append('province', selectedProvinces[0])
    }
    if (selectedFundSources.length === 1) {
      params.append('fund_source', selectedFundSources[0])
    }
    if (selectedModes.length === 1) {
      params.append('mode_of_implementation', selectedModes[0])
    }
    if (selectedScales.length === 1) {
      params.append('project_scale', selectedScales[0])
    }

    return params.toString()
  }, [search, selectedDEOs, selectedStatuses, selectedFundYears, selectedProvinces, selectedFundSources, selectedModes, selectedScales])

  // Fetch projects
  const { data: projectsData, isLoading: projectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ['projects', buildQueryParams()],
    queryFn: async () => {
      const queryString = buildQueryParams()
      const response = await apiClient.get(`/projects?${queryString}`)
      return response.data
    },
  })

  // Apply client-side filtering for multi-select
  const filteredProjects = useMemo(() => {
    if (!projectsData?.items) return []

    let items = projectsData.items as Project[]

    if (selectedDEOs.length > 1) {
      items = items.filter((p) => selectedDEOs.includes(p.deo_id))
    }
    if (selectedStatuses.length > 1) {
      items = items.filter((p) => selectedStatuses.includes(p.status))
    }
    if (selectedFundYears.length > 1) {
      items = items.filter((p) => p.fund_year && selectedFundYears.includes(p.fund_year))
    }
    if (selectedProvinces.length > 1 && filterOptions) {
      const deoIdsInProvinces = filterOptions.deos
        .filter((d) => selectedProvinces.includes(d.province))
        .map((d) => d.deo_id)
      items = items.filter((p) => deoIdsInProvinces.includes(p.deo_id))
    }
    if (selectedFundSources.length > 1) {
      items = items.filter((p) => p.fund_source && selectedFundSources.includes(p.fund_source))
    }
    if (selectedModes.length > 1) {
      items = items.filter((p) => p.mode_of_implementation && selectedModes.includes(p.mode_of_implementation))
    }
    if (selectedScales.length > 1) {
      items = items.filter((p) => p.project_scale && selectedScales.includes(p.project_scale))
    }

    return items
  }, [projectsData, selectedDEOs, selectedStatuses, selectedFundYears, selectedProvinces, selectedFundSources, selectedModes, selectedScales, filterOptions])

  // Paginate filtered results
  const paginatedProjects = useMemo(() => {
    const start = currentPage * itemsPerPage
    return filteredProjects.slice(start, start + itemsPerPage)
  }, [filteredProjects, currentPage, itemsPerPage])

  // Reset page when filters change
  const handleFilterChange = useCallback(() => {
    setCurrentPage(0)
  }, [])

  /**
   * Export to CSV
   */
  const handleExportCSV = () => {
    if (!filteredProjects.length) return

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

    const rows = filteredProjects.map((project) => [
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

  const handleRefresh = () => {
    refetchProjects()
  }

  const columns: Column<Project>[] = [
    {
      key: 'project_title',
      header: 'Project',
      minWidth: 200,
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight={500} sx={{ wordBreak: 'break-word' }}>
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
      hideOnMobile: true,
      minWidth: 120,
      render: (row) => (
        <Typography variant="body2">{row.deo_name}</Typography>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      hideOnMobile: true,
      hideOnTablet: true,
      minWidth: 150,
      render: (row) => (
        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
          {row.location || '—'}
        </Typography>
      ),
    },
    {
      key: 'project_cost',
      header: 'Cost',
      hideOnMobile: true,
      minWidth: 100,
      render: (row) => (
        <Typography variant="body2">{formatCurrency(row.project_cost)}</Typography>
      ),
    },
    {
      key: 'fund_year',
      header: 'Year',
      hideOnMobile: true,
      hideOnTablet: true,
      minWidth: 60,
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
      minWidth: 90,
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
      minWidth: 120,
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
      minWidth: 80,
      render: (row) => {
        // DEO users can only edit projects in their own DEO
        const canEdit = user?.role === 'super_admin' ||
                        user?.role === 'regional_admin' ||
                        (user?.role === 'deo_user' && row.deo_id === user?.deo_id)

        return (
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
            {canEdit && (
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
            )}
          </Box>
        )
      },
    },
  ]

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      {/* Dashboard Filters with Action Buttons */}
      <DashboardFilter
        filterOptions={filterOptions || null}
        filterOptionsLoading={filterOptionsLoading}
        search={search}
        onSearchChange={(value) => { setSearch(value); handleFilterChange(); }}
        selectedDEOs={selectedDEOs}
        onDEOChange={(value) => { setSelectedDEOs(value); handleFilterChange(); }}
        selectedProvinces={selectedProvinces}
        onProvinceChange={(value) => { setSelectedProvinces(value); handleFilterChange(); }}
        selectedStatuses={selectedStatuses}
        onStatusChange={(value) => { setSelectedStatuses(value); handleFilterChange(); }}
        selectedFundYears={selectedFundYears}
        onFundYearChange={(value) => { setSelectedFundYears(value); handleFilterChange(); }}
        selectedFundSources={selectedFundSources}
        onFundSourceChange={(value) => { setSelectedFundSources(value); handleFilterChange(); }}
        selectedModes={selectedModes}
        onModeChange={(value) => { setSelectedModes(value); handleFilterChange(); }}
        selectedScales={selectedScales}
        onScaleChange={(value) => { setSelectedScales(value); handleFilterChange(); }}
        onRefresh={handleRefresh}
        loading={projectsLoading}
        actionButtons={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              disabled={!filteredProjects.length}
              startIcon={<Download size={18} />}
            >
              Export
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate('/admin/projects/new')}
              startIcon={<Plus size={18} />}
            >
              New Project
            </Button>
          </Box>
        }
      />

      {/* Results Summary */}
      {filteredProjects.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {currentPage * itemsPerPage + 1} - {Math.min((currentPage + 1) * itemsPerPage, filteredProjects.length)} of{' '}
          {filteredProjects.length} projects
        </Typography>
      )}

      {/* Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        {projectsLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
            <LoadingSpinner size="lg" />
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Loading projects...
            </Typography>
          </Box>
        ) : !filteredProjects.length ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">
              No projects found. Try adjusting your filters or create a new project.
            </Typography>
          </Box>
        ) : (
          <>
            <Table
              columns={columns}
              data={paginatedProjects}
              rowKey={(row) => row.project_id}
              onRowClick={(row) => navigate(`/admin/projects/${row.project_id}`)}
            />
            <TablePagination
              component="div"
              count={filteredProjects.length}
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
