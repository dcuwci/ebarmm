import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { StatCard, Card, CardHeader, LoadingSpinner, EmptyState, Table, Pagination, Button } from '../../components/common';
import { apiClient } from '../../api/client';
import type { Column } from '../../components/common';

interface PublicStats {
  total_projects: number;
  total_cost: number;
  by_province: Record<string, number>;
  by_status: Record<string, number>;
  avg_completion: number;
}

interface PublicProject {
  project_id: string;
  project_title: string;
  location: string;
  fund_source: string;
  project_cost: number;
  fund_year: number;
  status: string;
  deo_name: string;
  current_progress: number;
  last_updated: string | null;
}

interface ProjectsResponse {
  total: number;
  limit: number;
  offset: number;
  items: PublicProject[];
}

export default function PublicPortal() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const itemsPerPage = 10;

  // Fetch statistics
  const { data: stats, isLoading: statsLoading } = useQuery<PublicStats>({
    queryKey: ['publicStats'],
    queryFn: async () => {
      const response = await apiClient.get('/public/stats');
      return response.data;
    }
  });

  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useQuery<ProjectsResponse>({
    queryKey: ['publicProjects', currentPage, searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: ((currentPage - 1) * itemsPerPage).toString()
      });

      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);

      const response = await apiClient.get(`/public/projects?${params}`);
      return response.data;
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
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

  const columns: Column<PublicProject>[] = [
    {
      key: 'project_title',
      header: 'Project Title',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.project_title}</p>
          <p className="text-xs text-gray-500">{row.location}</p>
        </div>
      )
    },
    {
      key: 'deo_name',
      header: 'DEO',
      render: (row) => (
        <span className="text-sm text-gray-700">{row.deo_name}</span>
      )
    },
    {
      key: 'project_cost',
      header: 'Cost',
      align: 'right',
      render: (row) => (
        <span className="font-medium">{formatCurrency(row.project_cost)}</span>
      )
    },
    {
      key: 'current_progress',
      header: 'Progress',
      align: 'center',
      render: (row) => (
        <div className="flex items-center">
          <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${row.current_progress}%` }}
            />
          </div>
          <span className="text-sm font-medium">{formatPercent(row.current_progress)}</span>
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

  const totalPages = projects ? Math.ceil(projects.total / itemsPerPage) : 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-4xl font-bold mb-4">
            E-BARMM Transparency Portal
          </h1>
          <p className="text-xl text-blue-100 mb-8">
            Track infrastructure projects across the Bangsamoro Autonomous Region in Muslim Mindanao
          </p>
          <div className="flex gap-4">
            <Button
              variant="secondary"
              onClick={() => navigate('/map')}
            >
              View Map
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate('/login')}
              className="text-white border-white hover:bg-white hover:text-blue-600"
            >
              Admin Login
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="h-32 animate-pulse bg-gray-100"><div /></Card>
            ))
          ) : stats ? (
            <>
              <StatCard
                title="Total Projects"
                value={stats.total_projects.toLocaleString()}
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
              />
              <StatCard
                title="Total Investment"
                value={formatCurrency(stats.total_cost)}
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <StatCard
                title="Average Completion"
                value={formatPercent(stats.avg_completion)}
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
              <StatCard
                title="Ongoing Projects"
                value={stats.by_status.ongoing || 0}
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
              />
            </>
          ) : null}
        </div>

        {/* Projects by Province */}
        {stats && (
          <Card className="mb-8">
            <CardHeader title="Projects by Province" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(stats.by_province).map(([province, count]) => (
                <div key={province} className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{count}</p>
                  <p className="text-sm text-gray-600 mt-1">{province}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Projects Table */}
        <Card>
          <CardHeader
            title="Infrastructure Projects"
            subtitle={projects ? `${projects.total} total projects` : undefined}
          />

          {/* Filters */}
          <div className="mb-6 flex gap-4">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="planning">Planning</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {projectsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" className="text-blue-600" />
            </div>
          ) : projects && projects.items.length > 0 ? (
            <>
              <Table
                columns={columns}
                data={projects.items}
                rowKey={(row) => row.project_id}
                onRowClick={(row) => navigate(`/projects/${row.project_id}`)}
              />
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={projects.total}
                itemsPerPage={itemsPerPage}
              />
            </>
          ) : (
            <EmptyState
              title="No projects found"
              description={searchTerm || statusFilter ? "Try adjusting your filters" : "No projects available at this time"}
            />
          )}
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-lg font-semibold mb-2">Ministry of Public Works - BARMM</p>
            <p className="text-gray-400">Bangsamoro Autonomous Region in Muslim Mindanao</p>
            <p className="text-gray-400 text-sm mt-4">
              &copy; {new Date().getFullYear()} E-BARMM. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
