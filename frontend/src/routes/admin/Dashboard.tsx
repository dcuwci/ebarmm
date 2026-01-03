import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import { Building2, Zap, CheckCircle, DollarSign, Plus, ClipboardList, Map } from 'lucide-react';
import { StatCard, Card, CardHeader, LoadingSpinner, Table, Button } from '../../components/mui';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../api/client';
import type { Column } from '../../components/mui';

interface DashboardStats {
  total_projects: number;
  ongoing_projects: number;
  completed_projects: number;
  total_investment: number;
  my_deo_projects?: number;
  avg_progress: number;
}

interface RecentProject {
  project_id: string;
  project_title: string;
  status: string;
  current_progress: number;
  created_at: string;
  deo_name?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  // Fetch projects for statistics
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['adminProjects'],
    queryFn: async () => {
      const response = await apiClient.get('/projects?limit=100');
      return response.data;
    }
  });

  // Calculate statistics from projects
  const stats = React.useMemo((): DashboardStats | null => {
    if (!projects?.items) return null;

    const total = projects.items.length;
    const ongoing = projects.items.filter((p: any) => p.status === 'ongoing').length;
    const completed = projects.items.filter((p: any) => p.status === 'completed').length;
    const totalCost = projects.items.reduce((sum: number, p: any) => sum + (p.project_cost || 0), 0);
    const avgProgress = total > 0
      ? projects.items.reduce((sum: number, p: any) => sum + (p.current_progress || 0), 0) / total
      : 0;

    const myDeoProjects = user?.role === 'deo_user'
      ? projects.items.filter((p: any) => p.deo_id === user.deo_id).length
      : undefined;

    return {
      total_projects: total,
      ongoing_projects: ongoing,
      completed_projects: completed,
      total_investment: totalCost,
      my_deo_projects: myDeoProjects,
      avg_progress: avgProgress
    };
  }, [projects, user]);

  // Get recent projects
  const recentProjects = React.useMemo((): RecentProject[] => {
    if (!projects?.items) return [];
    return projects.items
      .slice(0, 5)
      .map((p: any) => ({
        project_id: p.project_id,
        project_title: p.project_title,
        status: p.status,
        current_progress: p.current_progress || 0,
        created_at: p.created_at,
        deo_name: p.deo_name
      }));
  }, [projects]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'success' | 'warning' => {
    const colors: Record<string, 'default' | 'primary' | 'success' | 'warning'> = {
      planning: 'default',
      ongoing: 'primary',
      completed: 'success',
      suspended: 'warning'
    };
    return colors[status] || 'default';
  };

  const columns: Column<RecentProject>[] = [
    {
      key: 'project_title',
      header: 'Project',
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>{row.project_title}</Typography>
          {row.deo_name && (
            <Typography variant="caption" color="text.secondary">{row.deo_name}</Typography>
          )}
        </Box>
      )
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
      )
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
      )
    }
  ];

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, py: 4 }}>
      {/* Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          Welcome back, {user?.username}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          {user?.role === 'super_admin' && 'System Administrator Dashboard'}
          {user?.role === 'regional_admin' && 'Regional Administrator Dashboard'}
          {user?.role === 'deo_user' && 'DEO User Dashboard'}
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {projectsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} md={6} lg={3} key={i}>
              <StatCard title="" value="" loading />
            </Grid>
          ))
        ) : stats ? (
          <>
            <Grid item xs={12} md={6} lg={3}>
              <StatCard
                title={user?.role === 'deo_user' ? 'My DEO Projects' : 'Total Projects'}
                value={user?.role === 'deo_user' ? (stats.my_deo_projects || 0) : stats.total_projects}
                icon={<Building2 size={24} />}
                color="#1976d2"
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <StatCard
                title="Ongoing"
                value={stats.ongoing_projects}
                icon={<Zap size={24} />}
                color="#ed6c02"
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <StatCard
                title="Completed"
                value={stats.completed_projects}
                icon={<CheckCircle size={24} />}
                color="#2e7d32"
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <StatCard
                title="Total Investment"
                value={formatCurrency(stats.total_investment)}
                icon={<DollarSign size={24} />}
                color="#9c27b0"
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
          title="Recent Projects"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/projects')}
            >
              View All →
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
              No projects yet. Create your first project to get started.
            </Typography>
          </Box>
        )}
      </Card>
    </Box>
  );
}
