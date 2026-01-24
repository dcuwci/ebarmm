/**
 * Public Dashboard
 * Overview page with stats, charts, and recent projects - mirrors admin Dashboard
 */

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import { useTheme } from '@mui/material/styles';
import { Building2, Zap, CheckCircle, DollarSign, TrendingUp, ClipboardList, Map, PauseCircle, Clock } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  StatCard,
  Card,
  CardHeader,
  LoadingSpinner,
  Table,
  Button,
  DashboardFilter,
} from '../../components/mui';
import { useFilterStore } from '../../stores/filterStore';
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  planning: { label: 'Planning', color: '#9e9e9e', icon: <Clock size={16} /> },
  ongoing: { label: 'Ongoing', color: '#ed6c02', icon: <Zap size={16} /> },
  completed: { label: 'Completed', color: '#2e7d32', icon: <CheckCircle size={16} /> },
  suspended: { label: 'Suspended', color: '#d32f2f', icon: <PauseCircle size={16} /> },
};

export default function PublicDashboard() {
  const navigate = useNavigate();
  const theme = useTheme();

  // Filter state - persisted globally via Zustand store
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
    params.append('limit', '200');

    if (search) params.append('search', search);

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
    queryKey: ['publicDashboardProjects', buildQueryParams()],
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

  // Calculate statistics from filtered projects
  const stats = useMemo(() => {
    if (filteredProjects.length === 0 && projectsLoading) return null;

    const total = filteredProjects.length;
    const planning = filteredProjects.filter((p) => p.status === 'planning').length;
    const ongoing = filteredProjects.filter((p) => p.status === 'ongoing').length;
    const completed = filteredProjects.filter((p) => p.status === 'completed').length;
    const suspended = filteredProjects.filter((p) => p.status === 'suspended').length;
    const totalCost = filteredProjects.reduce((sum, p) => sum + (p.project_cost || 0), 0);
    const avgProgress = total > 0
      ? filteredProjects.reduce((sum, p) => sum + (p.current_progress || 0), 0) / total
      : 0;

    return {
      total_projects: total,
      planning_projects: planning,
      ongoing_projects: ongoing,
      completed_projects: completed,
      suspended_projects: suspended,
      total_investment: totalCost,
      avg_progress: avgProgress,
    };
  }, [filteredProjects, projectsLoading]);

  // Status distribution chart data
  const statusChartData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Planning', value: stats.planning_projects, color: STATUS_CONFIG.planning.color },
      { name: 'Ongoing', value: stats.ongoing_projects, color: STATUS_CONFIG.ongoing.color },
      { name: 'Completed', value: stats.completed_projects, color: STATUS_CONFIG.completed.color },
      { name: 'Suspended', value: stats.suspended_projects, color: STATUS_CONFIG.suspended.color },
    ].filter((d) => d.value > 0);
  }, [stats]);

  // Projects by province chart data
  const provinceChartData = useMemo(() => {
    if (!filteredProjects.length || !filterOptions) return [];

    const provinceMap: Record<string, { count: number; investment: number }> = {};

    filteredProjects.forEach((project) => {
      const deo = filterOptions.deos.find((d) => d.deo_id === project.deo_id);
      const province = deo?.province || 'Unknown';
      const existing = provinceMap[province] || { count: 0, investment: 0 };
      provinceMap[province] = {
        count: existing.count + 1,
        investment: existing.investment + (project.project_cost || 0),
      };
    });

    return Object.entries(provinceMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6); // Top 6 provinces
  }, [filteredProjects, filterOptions]);

  // Get recent projects (top 5)
  const recentProjects = useMemo(() => {
    return filteredProjects.slice(0, 5).map((p) => ({
      project_id: p.project_id,
      project_title: p.project_title,
      status: p.status,
      current_progress: p.current_progress || 0,
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

  const handleRefresh = () => {
    refetchProjects();
  };

  // Navigate to projects with status filter
  const navigateWithStatus = (status?: string) => {
    if (status) {
      navigate(`/portal/projects?status=${status}`);
    } else {
      navigate('/portal/projects');
    }
  };

  const columns: Column<typeof recentProjects[0]>[] = [
    {
      key: 'project_title',
      header: 'Project',
      minWidth: 200,
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight={500} sx={{ wordBreak: 'break-word' }}>
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
      minWidth: 140,
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <LinearProgress
            variant="determinate"
            value={row.current_progress}
            sx={{ width: { xs: 50, sm: 80 }, height: 6, borderRadius: 1 }}
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
      minWidth: 100,
      render: (row) => (
        <Chip
          label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
          color={getStatusColor(row.status)}
          size="small"
        />
      ),
    },
  ];

  // Custom tooltip for pie chart
  const PieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
    if (active && payload && payload.length) {
      return (
        <Box sx={{ bgcolor: 'background.paper', p: 1, borderRadius: 1, boxShadow: 2 }}>
          <Typography variant="body2" fontWeight={500}>
            {payload[0].name}: {payload[0].value}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          Transparency Portal
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track infrastructure projects across the Bangsamoro Autonomous Region
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

      {/* Statistics Cards - Clickable */}
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
                title="Total Projects"
                value={stats.total_projects}
                icon={<Building2 size={24} />}
                color="#1976d2"
                onClick={() => navigateWithStatus()}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Ongoing"
                value={stats.ongoing_projects}
                icon={<Zap size={24} />}
                color="#ed6c02"
                onClick={() => navigateWithStatus('ongoing')}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Completed"
                value={stats.completed_projects}
                icon={<CheckCircle size={24} />}
                color="#2e7d32"
                onClick={() => navigateWithStatus('completed')}
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

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Status Distribution */}
        <Grid item xs={12} md={5}>
          <Card>
            <CardHeader title="Status Distribution" />
            {statusChartData.length > 0 ? (
              <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      verticalAlign="middle"
                      align="right"
                      layout="vertical"
                      formatter={(value) => <span style={{ color: theme.palette.text.primary }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">No data available</Typography>
              </Box>
            )}
          </Card>
        </Grid>

        {/* Projects by Province */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardHeader title="Projects by Province" />
            {provinceChartData.length > 0 ? (
              <Box sx={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={provinceChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <XAxis type="number" stroke={theme.palette.text.secondary} fontSize={12} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={100}
                      stroke={theme.palette.text.secondary}
                      fontSize={12}
                      tickFormatter={(value) => value.length > 15 ? `${value.slice(0, 15)}...` : value}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8,
                      }}
                      formatter={(value: number, name: string) => [
                        name === 'count' ? `${value} projects` : formatCurrency(value),
                        name === 'count' ? 'Projects' : 'Investment',
                      ]}
                    />
                    <Bar dataKey="count" fill={theme.palette.primary.main} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">No data available</Typography>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Box sx={{ mb: 4 }}>
        <Card>
          <CardHeader title="Quick Actions" />
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Button
                variant="primary"
                fullWidth
                onClick={() => navigate('/portal/projects')}
                startIcon={<ClipboardList size={20} />}
              >
                View All Projects
              </Button>
            </Grid>
            <Grid item xs={12} md={6}>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/map')}
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/portal/projects')}>
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
            onRowClick={(row) => navigate(`/portal/projects/${row.project_id}`)}
          />
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              {stats && stats.total_projects === 0
                ? 'No projects available.'
                : 'No projects match the current filters.'}
            </Typography>
          </Box>
        )}
      </Card>
    </Box>
  );
}
