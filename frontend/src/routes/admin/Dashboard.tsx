import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { StatCard, Card, CardHeader, LoadingSpinner, Table, Button } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../api/client';
import type { Column } from '../../components/common';

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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: 'bg-gray-100 text-gray-800',
      ongoing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      suspended: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const columns: Column<RecentProject>[] = [
    {
      key: 'project_title',
      header: 'Project',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.project_title}</p>
          {row.deo_name && <p className="text-xs text-gray-500">{row.deo_name}</p>}
        </div>
      )
    },
    {
      key: 'current_progress',
      header: 'Progress',
      align: 'center',
      render: (row) => (
        <div className="flex items-center justify-center">
          <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${row.current_progress}%` }}
            />
          </div>
          <span className="text-sm font-medium">{row.current_progress.toFixed(0)}%</span>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(row.status)}`}>
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </span>
      )
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.username}
        </h1>
        <p className="text-gray-600 mt-1">
          {user?.role === 'super_admin' && 'System Administrator Dashboard'}
          {user?.role === 'regional_admin' && 'Regional Administrator Dashboard'}
          {user?.role === 'deo_user' && 'DEO User Dashboard'}
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {projectsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-32 animate-pulse bg-gray-100"><div /></Card>
          ))
        ) : stats ? (
          <>
            <StatCard
              title={user?.role === 'deo_user' ? 'My DEO Projects' : 'Total Projects'}
              value={user?.role === 'deo_user' ? (stats.my_deo_projects || 0) : stats.total_projects}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />
            <StatCard
              title="Ongoing"
              value={stats.ongoing_projects}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            />
            <StatCard
              title="Completed"
              value={stats.completed_projects}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              title="Total Investment"
              value={formatCurrency(stats.total_investment)}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </>
        ) : null}
      </div>

      {/* Quick Actions */}
      <Card className="mb-8">
        <CardHeader title="Quick Actions" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="primary"
            onClick={() => navigate('/admin/projects/new')}
            className="justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/admin/projects')}
            className="justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            View All Projects
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/map')}
            className="justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            View Map
          </Button>
        </div>
      </Card>

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
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" className="text-blue-600" />
          </div>
        ) : recentProjects.length > 0 ? (
          <Table
            columns={columns}
            data={recentProjects}
            rowKey={(row) => row.project_id}
            onRowClick={(row) => navigate(`/admin/projects/${row.project_id}`)}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            No projects yet. Create your first project to get started.
          </div>
        )}
      </Card>
    </div>
  );
}
