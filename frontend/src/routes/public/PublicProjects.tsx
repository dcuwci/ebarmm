/**
 * Public Projects Page
 * Full project list with filtering and pagination - mirrors admin ProjectList
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';
import { Download, Eye } from 'lucide-react';
import { Button, Table, LoadingSpinner, DashboardFilter } from '../../components/mui';
import type { Column } from '../../components/mui';
import { apiClient } from '../../api/client';
import { useFilterStore } from '../../stores/filterStore';
import { fetchAllPublicProjects } from '../../api/public';
import { exportToCSV } from '../../utils/export';
import type { PublicProject } from '../../types/project';

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

interface Project {
  project_id: string;
  project_title: string;
  status: string;
  current_progress: number;
  location: string | null;
  deo_id: number;
  deo_name?: string;
  project_cost: number;
  fund_source?: string;
  mode_of_implementation?: string;
  project_scale?: string;
  fund_year?: number;
}

interface ProjectsResponse {
  total: number;
  items: Project[];
}

const getStatusColor = (status: string): 'default' | 'primary' | 'success' | 'warning' => {
  const colors: Record<string, 'default' | 'primary' | 'success' | 'warning'> = {
    planning: 'default',
    ongoing: 'primary',
    completed: 'success',
    suspended: 'warning',
  };
  return colors[status] || 'default';
};

export default function PublicProjects() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isExporting, setIsExporting] = useState(false);

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
  } = useFilterStore();

  // Fetch filter options
  const { data: filterOptions, isLoading: filterOptionsLoading } = useQuery({
    queryKey: ['publicFilterOptions'],
    queryFn: async () => {
      const response = await apiClient.get('/public/filter-options');
      return response.data as FilterOptions;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Build query params for API call
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.append('limit', '200'); // Backend max is 200

    if (search) params.append('search', search);

    // For API, send single values; multi-select is filtered client-side
    if (selectedDEOs.length === 1) {
      params.append('deo_id', selectedDEOs[0].toString());
    }
    if (selectedStatuses.length === 1) {
      params.append('status', selectedStatuses[0]);
    }
    if (selectedFundYears.length === 1) {
      params.append('fund_year', selectedFundYears[0].toString());
    }
    if (selectedProvinces.length === 1) {
      params.append('province', selectedProvinces[0]);
    }
    if (selectedFundSources.length === 1) {
      params.append('fund_source', selectedFundSources[0]);
    }
    if (selectedModes.length === 1) {
      params.append('mode_of_implementation', selectedModes[0]);
    }
    if (selectedScales.length === 1) {
      params.append('project_scale', selectedScales[0]);
    }

    return params.toString();
  }, [search, selectedDEOs, selectedStatuses, selectedFundYears, selectedProvinces, selectedFundSources, selectedModes, selectedScales]);

  // Fetch projects
  const { data: projectsData, isLoading: projectsLoading, refetch: refetchProjects } = useQuery<ProjectsResponse>({
    queryKey: ['publicProjects', buildQueryParams()],
    queryFn: async () => {
      const queryString = buildQueryParams();
      const response = await apiClient.get(`/public/projects?${queryString}`);
      return response.data;
    },
  });

  // Apply client-side filtering for multi-select
  const filteredProjects = useMemo(() => {
    if (!projectsData?.items) return [];

    let items = projectsData.items;

    if (selectedDEOs.length > 1) {
      items = items.filter((p) => selectedDEOs.includes(p.deo_id));
    }
    if (selectedStatuses.length > 1) {
      items = items.filter((p) => selectedStatuses.includes(p.status));
    }
    if (selectedFundYears.length > 1) {
      items = items.filter((p) => p.fund_year && selectedFundYears.includes(p.fund_year));
    }
    if (selectedProvinces.length > 1 && filterOptions) {
      const deoIdsInProvinces = filterOptions.deos
        .filter((d) => selectedProvinces.includes(d.province))
        .map((d) => d.deo_id);
      items = items.filter((p) => deoIdsInProvinces.includes(p.deo_id));
    }
    if (selectedFundSources.length > 1) {
      items = items.filter((p) => p.fund_source && selectedFundSources.includes(p.fund_source));
    }
    if (selectedModes.length > 1) {
      items = items.filter((p) => p.mode_of_implementation && selectedModes.includes(p.mode_of_implementation));
    }
    if (selectedScales.length > 1) {
      items = items.filter((p) => p.project_scale && selectedScales.includes(p.project_scale));
    }

    return items;
  }, [projectsData, selectedDEOs, selectedStatuses, selectedFundYears, selectedProvinces, selectedFundSources, selectedModes, selectedScales, filterOptions]);

  // Paginate filtered results
  const paginatedProjects = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredProjects.slice(start, start + itemsPerPage);
  }, [filteredProjects, currentPage, itemsPerPage]);

  // Reset page when filters change
  const handleFilterChange = useCallback(() => {
    setCurrentPage(0);
  }, []);

  // Export to CSV
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const allProjects = await fetchAllPublicProjects({
        status: selectedStatuses.length === 1 ? selectedStatuses[0] : undefined,
        search: search || undefined,
        deo_id: selectedDEOs.length === 1 ? selectedDEOs[0] : undefined,
        province: selectedProvinces.length === 1 ? selectedProvinces[0] : undefined,
        fund_year: selectedFundYears.length === 1 ? selectedFundYears[0] : undefined,
        fund_source: selectedFundSources.length === 1 ? selectedFundSources[0] : undefined,
        mode_of_implementation: selectedModes.length === 1 ? selectedModes[0] : undefined,
        project_scale: selectedScales.length === 1 ? selectedScales[0] : undefined,
      });

      const exportData = allProjects.map((project: PublicProject) => ({
        'Project Title': project.project_title,
        'Location': project.location || '',
        'DEO': project.deo_name,
        'Status': project.status.charAt(0).toUpperCase() + project.status.slice(1),
        'Fund Source': project.fund_source || '',
        'Fund Year': project.fund_year,
        'Project Cost (PHP)': project.project_cost,
        'Progress (%)': project.current_progress,
        'Last Updated': project.last_updated || '',
      }));

      const filename = `ebarmm-projects-${new Date().toISOString().split('T')[0]}`;
      exportToCSV(exportData, filename);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const handleRefresh = () => {
    refetchProjects();
  };

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
      header: '',
      align: 'right',
      minWidth: 50,
      render: (row) => (
        <Tooltip title="View details">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/portal/projects/${row.project_id}`);
            }}
          >
            <Eye size={18} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          Infrastructure Projects
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Browse all projects in the Bangsamoro Autonomous Region
        </Typography>
      </Box>

      {/* Filters */}
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
          <Button
            variant="secondary"
            onClick={handleExportCSV}
            disabled={!filteredProjects.length || isExporting}
            startIcon={isExporting ? <CircularProgress size={18} /> : <Download size={18} />}
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>
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
              No projects found. Try adjusting your filters.
            </Typography>
          </Box>
        ) : (
          <>
            <Table
              columns={columns}
              data={paginatedProjects}
              rowKey={(row) => row.project_id}
              onRowClick={(row) => navigate(`/portal/projects/${row.project_id}`)}
            />
            <TablePagination
              component="div"
              count={filteredProjects.length}
              page={currentPage}
              onPageChange={(_, newPage) => setCurrentPage(newPage)}
              rowsPerPage={itemsPerPage}
              onRowsPerPageChange={(e) => {
                setItemsPerPage(parseInt(e.target.value, 10));
                setCurrentPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </Paper>
    </Box>
  );
}
