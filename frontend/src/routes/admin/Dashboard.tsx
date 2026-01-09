import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import { Building2, Zap, CheckCircle, DollarSign, Plus, ClipboardList, Map, TrendingUp } from 'lucide-react';
import { StatCard, Card, CardHeader, LoadingSpinner, Table, Button, DashboardFilter } from '../../components/mui';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../api/client';
import type { Column } from '../../components/mui';

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

interface DashboardStats {
  total_projects: number;
  ongoing_projects: number;
  completed_projects: number;
  total_investment: number;
  my_deo_projects?: number;
  avg_progress: number;
}

interface Project {
  project_id: string;
  project_title: string;
  status: string;
  current_progress: number;
  created_at: string;
  deo_id: number;
  deo_name?: string;
  project_cost: number;
  fund_source?: string;
  mode_of_implementation?: string;
  project_scale?: string;
  fund_year?: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  // Filter state
  const [search, setSearch] = useState('');
  const [selectedDEOs, setSelectedDEOs] = useState<number[]>([]);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedFundYears, setSelectedFundYears] = useState<number[]>([]);
  const [selectedFundSources, setSelectedFundSources] = useState<string[]>([]);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [selectedScales, setSelectedScales] = useState<string[]>([]);

  // Fetch filter options
  const { data: filterOptions, isLoading: filterOptionsLoading } = useQuery({
    queryKey: ['filterOptions'],
    queryFn: async () => {
      const response = await apiClient.get('/public/filter-options');
      return response.data as FilterOptions;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Build query params for API call
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.append('limit', '500');

    if (search) params.append('search', search);

    // For API, we can only send single values, so we'll do client-side filtering for multi-select
    // Send first value to API if only one is selected, otherwise fetch all and filter client-side
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
  const { data: projectsData, isLoading: projectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ['adminProjects', buildQueryParams()],
    queryFn: async () => {
      const queryString = buildQueryParams();
      const response = await apiClient.get(`/projects?${queryString}`);
      return response.data;
    },
  });

  // Apply client-side filtering for multi-select (when more than 1 value is selected)
  const filteredProjects = useMemo(() => {
    if (!projectsData?.items) return [];

    let items = projectsData.items as Project[];

    // Multi-select client-side filtering
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

  // Calculate statistics from filtered projects
  const stats = useMemo((): DashboardStats | null => {
    if (filteredProjects.length === 0 && projectsLoading) return null;

    const total = filteredProjects.length;
    const ongoing = filteredProjects.filter((p) => p.status === 'ongoing').length;
    const completed = filteredProjects.filter((p) => p.status === 'completed').length;
    const totalCost = filteredProjects.reduce((sum, p) => sum + (p.project_cost || 0), 0);
    const avgProgress = total > 0
      ? filteredProjects.reduce((sum, p) => sum + (p.current_progress || 0), 0) / total
      : 0;

    const myDeoProjects = user?.role === 'deo_user'
      ? filteredProjects.filter((p) => p.deo_id === user.deo_id).length
      : undefined;

    return {
      total_projects: total,
      ongoing_projects: ongoing,
      completed_projects: completed,
      total_investment: totalCost,
      my_deo_projects: myDeoProjects,
      avg_progress: avgProgress,
    };
  }, [filteredProjects, user, projectsLoading]);

  // Get recent projects (top 5)
  const recentProjects = useMemo(() => {
    return filteredProjects.slice(0, 5).map((p) => ({
      project_id: p.project_id,
      project_title: p.project_title,
      status: p.status,
      current_progress: p.current_progress || 0,
      created_at: p.created_at,
      deo_name: p.deo_name,
    }));
  }, [filteredProjects]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'success' | 'warning' => {
    const colors: Record<string, 'default' | 'primary' | 'success' | 'warning'> = {
      planning: 'default',
      ongoing: 'primary',
      completed: 'success',
      suspended: 'warning',
    };
    return colors[status] || 'default';
  };

  const columns: Column<typeof recentProjects[0]>[] = [
    {
      key: 'project_title',
      header: 'Project',
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {row.project_title}
          </Typography>
          {row.deo_name && (
            <Typography variant="caption" color="text.secondary">
              {row.deo_name}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: 'current_progress',
      header: 'Progress',
      align: 'center',
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <LinearProgress
            variant="determinate"
            value={row.current_progress}
            sx={{ width: 80, height: 6, borderRadius: 1 }}
          />
          <Typography variant="body2" fontWeight={500}>
            {row.current_progress.toFixed(0)}%
          </Typography>
        </Box>
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
  ];

  const handleRefresh = () => {
    refetchProjects();
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, py: 4 }}>
      {/* Welcome Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Welcome back, {user?.username}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          {user?.role === 'super_admin' && 'System Administrator Dashboard'}
          {user?.role === 'regional_admin' && 'Regional Administrator Dashboard'}
          {user?.role === 'deo_user' && 'DEO User Dashboard'}
        </Typography>
      </Box>

      {/* Dashboard Filters */}
      <DashboardFilter
        filterOptions={filterOptions || null}
        filterOptionsLoading={filterOptionsLoading}
        search={search}
        onSearchChange={setSearch}
        selectedDEOs={selectedDEOs}
        onDEOChange={setSelectedDEOs}
        selectedProvinces={selectedProvinces}
        onProvinceChange={setSelectedProvinces}
        selectedStatuses={selectedStatuses}
        onStatusChange={setSelectedStatuses}
        selectedFundYears={selectedFundYears}
        onFundYearChange={setSelectedFundYears}
        selectedFundSources={selectedFundSources}
        onFundSourceChange={setSelectedFundSources}
        selectedModes={selectedModes}
        onModeChange={setSelectedModes}
        selectedScales={selectedScales}
        onScaleChange={setSelectedScales}
        onRefresh={handleRefresh}
        loading={projectsLoading}
      />

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {projectsLoading && !stats ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} lg={2.4} key={i}>
              <StatCard title="" value="" loading />
            </Grid>
          ))
        ) : stats ? (
          <>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title={user?.role === 'deo_user' ? 'My DEO Projects' : 'Total Projects'}
                value={user?.role === 'deo_user' ? (stats.my_deo_projects || 0) : stats.total_projects}
                icon={<Building2 size={24} />}
                color="#1976d2"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Ongoing"
                value={stats.ongoing_projects}
                icon={<Zap size={24} />}
                color="#ed6c02"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Completed"
                value={stats.completed_projects}
                icon={<CheckCircle size={24} />}
                color="#2e7d32"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Total Investment"
                value={formatCurrency(stats.total_investment)}
                icon={<DollarSign size={24} />}
                color="#9c27b0"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Avg Progress"
                value={`${stats.avg_progress.toFixed(1)}%`}
                icon={<TrendingUp size={24} />}
                color="#0288d1"
              />
            </Grid>
          </>
        ) : null}
      </Grid>

      {/* Quick Actions */}
      <Box sx={{ mb: 4 }}>
        <Card>
          <CardHeader title="Quick Actions" />
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Button
                variant="primary"
                fullWidth
                onClick={() => navigate('/admin/projects/new')}
                startIcon={<Plus size={20} />}
              >
                New Project
              </Button>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/admin/projects')}
                startIcon={<ClipboardList size={20} />}
              >
                View All Projects
              </Button>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/admin/map')}
                startIcon={<Map size={20} />}
              >
                View Map
              </Button>
            </Grid>
          </Grid>
        </Card>
      </Box>

      {/* Recent Projects */}
      <Card>
        <CardHeader
          title={`Recent Projects${filteredProjects.length > 0 ? ` (${filteredProjects.length} total)` : ''}`}
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/projects')}>
              View All
            </Button>
          }
        />
        {projectsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <LoadingSpinner size="lg" />
          </Box>
        ) : recentProjects.length > 0 ? (
          <Table
            columns={columns}
            data={recentProjects}
            rowKey={(row) => row.project_id}
            onRowClick={(row) => navigate(`/admin/projects/${row.project_id}`)}
          />
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              {stats && stats.total_projects === 0
                ? 'No projects yet. Create your first project to get started.'
                : 'No projects match the current filters.'}
            </Typography>
          </Box>
        )}
      </Card>
    </Box>
  );
}
