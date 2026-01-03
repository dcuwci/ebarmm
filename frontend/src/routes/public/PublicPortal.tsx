import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import { useTheme } from '@mui/material/styles';
import {
  Search,
  Building2,
  DollarSign,
  TrendingUp,
  Zap,
  ArrowLeft,
  MapPin,
} from 'lucide-react';
import { apiClient } from '../../api/client';

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
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch statistics
  const { data: stats, isLoading: statsLoading } = useQuery<PublicStats>({
    queryKey: ['publicStats'],
    queryFn: async () => {
      const response = await apiClient.get('/public/stats');
      return response.data;
    },
  });

  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useQuery<ProjectsResponse>({
    queryKey: ['publicProjects', page, rowsPerPage, searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: rowsPerPage.toString(),
        offset: (page * rowsPerPage).toString(),
      });

      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);

      const response = await apiClient.get(`/public/projects?${params}`);
      return response.data;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
      planning: 'default',
      ongoing: 'primary',
      completed: 'success',
      suspended: 'warning',
    };
    return colors[status] || 'default';
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const statCards = [
    {
      title: 'Total Projects',
      value: stats?.total_projects.toLocaleString() || '0',
      icon: Building2,
      color: theme.palette.primary.main,
    },
    {
      title: 'Total Investment',
      value: stats ? formatCurrency(stats.total_cost) : '₱0',
      icon: DollarSign,
      color: theme.palette.success.main,
    },
    {
      title: 'Average Completion',
      value: stats ? formatPercent(stats.avg_completion) : '0%',
      icon: TrendingUp,
      color: theme.palette.info.main,
    },
    {
      title: 'Ongoing Projects',
      value: stats?.by_status?.ongoing?.toString() || '0',
      icon: Zap,
      color: theme.palette.warning.main,
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
          color: 'white',
          py: { xs: 6, md: 8 },
          px: { xs: 2, md: 4 },
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Button
            startIcon={<ArrowLeft size={18} />}
            onClick={() => navigate('/')}
            sx={{
              color: 'rgba(255,255,255,0.8)',
              mb: 3,
              '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            Back to Home
          </Button>
          <Typography variant="h3" fontWeight={700} gutterBottom>
            Transparency Portal
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, maxWidth: 600 }}>
            Track infrastructure projects across the Bangsamoro Autonomous Region in Muslim Mindanao
          </Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 4 }, py: 4 }}>
        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {statCards.map((stat, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              {statsLoading ? (
                <Skeleton variant="rounded" height={120} />
              ) : (
                <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {stat.title}
                        </Typography>
                        <Typography variant="h5" fontWeight={600}>
                          {stat.value}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 2,
                          bgcolor: `${stat.color}15`,
                          color: stat.color,
                        }}
                      >
                        <stat.icon size={24} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Grid>
          ))}
        </Grid>

        {/* Projects by Province */}
        {stats && Object.keys(stats.by_province).length > 0 && (
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 4 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Projects by Province
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {Object.entries(stats.by_province).map(([province, count]) => (
                  <Grid item xs={6} sm={4} md={2} key={province}>
                    <Box
                      sx={{
                        textAlign: 'center',
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'action.hover',
                      }}
                    >
                      <Typography variant="h4" fontWeight={700} color="primary.main">
                        {count}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {province}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Projects Table */}
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  Infrastructure Projects
                </Typography>
                {projects && (
                  <Typography variant="body2" color="text.secondary">
                    {projects.total} total projects
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <TextField
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                size="small"
                sx={{ minWidth: 300, flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={18} />
                    </InputAdornment>
                  ),
                }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="planning">Planning</MenuItem>
                  <MenuItem value="ongoing">Ongoing</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Table */}
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Project</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>DEO</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">
                      Cost
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Progress</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">
                      Status
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {projectsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton />
                        </TableCell>
                        <TableCell>
                          <Skeleton />
                        </TableCell>
                        <TableCell>
                          <Skeleton />
                        </TableCell>
                        <TableCell>
                          <Skeleton />
                        </TableCell>
                        <TableCell>
                          <Skeleton />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : projects && projects.items.length > 0 ? (
                    projects.items.map((project) => (
                      <TableRow
                        key={project.project_id}
                        hover
                        onClick={() => navigate(`/projects/${project.project_id}`)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {project.project_title}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <MapPin size={12} />
                            <Typography variant="caption" color="text.secondary">
                              {project.location}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{project.deo_name}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={500}>
                            {formatCurrency(project.project_cost)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={project.current_progress}
                              sx={{ flex: 1, height: 8, borderRadius: 4 }}
                            />
                            <Typography variant="body2" fontWeight={500} sx={{ minWidth: 45 }}>
                              {formatPercent(project.current_progress)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                            color={getStatusColor(project.status)}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                        <Typography color="text.secondary">
                          {searchTerm || statusFilter
                            ? 'No projects found. Try adjusting your filters.'
                            : 'No projects available.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            {projects && projects.total > 0 && (
              <TablePagination
                component="div"
                count={projects.total}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          bgcolor: 'grey.900',
          color: 'white',
          py: 4,
          mt: 8,
          textAlign: 'center',
        }}
      >
        <Typography variant="body1" fontWeight={600} gutterBottom>
          Ministry of Public Works - BARMM
        </Typography>
        <Typography variant="body2" color="grey.400">
          Bangsamoro Autonomous Region in Muslim Mindanao
        </Typography>
        <Typography variant="caption" color="grey.500" sx={{ mt: 2, display: 'block' }}>
          © {new Date().getFullYear()} E-BARMM. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}
