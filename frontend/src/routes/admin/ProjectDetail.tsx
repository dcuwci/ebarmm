/**
 * Project Detail Page
 * MUI-based tabbed interface for viewing project details, progress, GIS, media, and audit logs
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import {
  ArrowLeft,
  Edit,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  Image,
  Map,
  History,
  Shield,
} from 'lucide-react';
import { Button, LoadingSpinner } from '../../components/mui';
import { fetchProject } from '../../api/projects';
import { format } from 'date-fns';

type TabId = 'overview' | 'progress' | 'gis' | 'media' | 'audit';

interface TabPanelProps {
  children?: React.ReactNode;
  value: TabId;
  current: TabId;
}

function TabPanel({ children, value, current }: TabPanelProps) {
  return (
    <Box role="tabpanel" hidden={value !== current} sx={{ pt: 3 }}>
      {value === current && children}
    </Box>
  );
}

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  planning: 'default',
  ongoing: 'primary',
  completed: 'success',
  suspended: 'warning',
  cancelled: 'error',
  deleted: 'default',
};

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Fetch project data
  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId!),
    enabled: Boolean(projectId),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: TabId) => {
    setActiveTab(newValue);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <LoadingSpinner size="lg" />
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Loading project...
        </Typography>
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading project. Please try again.
        </Alert>
        <Button variant="secondary" onClick={() => navigate('/admin/projects')}>
          Back to Projects
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/projects')}
            startIcon={<ArrowLeft size={20} />}
            size="sm"
          >
            Back to Projects
          </Button>

          <Typography variant="h4" fontWeight={700} sx={{ mt: 2, mb: 1 }}>
            {project.project_title}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
              <MapPin size={16} />
              <Typography variant="body2">
                {project.location || 'No location specified'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
              <Calendar size={16} />
              <Typography variant="body2">
                Fund Year {project.fund_year}
              </Typography>
            </Box>

            <Chip
              label={project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              color={STATUS_COLORS[project.status] || 'default'}
              size="small"
            />
          </Box>
        </Box>

        <Button
          variant="primary"
          onClick={() => navigate(`/admin/projects/${projectId}/edit`)}
          startIcon={<Edit size={20} />}
        >
          Edit Project
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab icon={<FileText size={18} />} iconPosition="start" label="Overview" value="overview" />
          <Tab icon={<TrendingUp size={18} />} iconPosition="start" label="Progress" value="progress" />
          <Tab icon={<Map size={18} />} iconPosition="start" label="GIS Data" value="gis" />
          <Tab icon={<Image size={18} />} iconPosition="start" label="Media" value="media" />
          <Tab icon={<History size={18} />} iconPosition="start" label="Audit Log" value="audit" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Paper sx={{ p: 3, mt: 0 }}>
        {/* Overview Tab */}
        <TabPanel value="overview" current={activeTab}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
            Project Overview
          </Typography>

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Paper
                variant="outlined"
                sx={{ p: 2.5, bgcolor: 'primary.50', borderColor: 'primary.200' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main', mb: 1 }}>
                  <DollarSign size={20} />
                  <Typography variant="body2" fontWeight={500}>Project Cost</Typography>
                </Box>
                <Typography variant="h5" fontWeight={700}>
                  {formatCurrency(project.project_cost)}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper
                variant="outlined"
                sx={{ p: 2.5, bgcolor: 'success.50', borderColor: 'success.200' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main', mb: 1 }}>
                  <TrendingUp size={20} />
                  <Typography variant="body2" fontWeight={500}>Current Progress</Typography>
                </Box>
                <Typography variant="h5" fontWeight={700}>
                  {Math.round(project.current_progress || 0)}%
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper
                variant="outlined"
                sx={{ p: 2.5, bgcolor: 'secondary.50', borderColor: 'secondary.200' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'secondary.main', mb: 1 }}>
                  <Shield size={20} />
                  <Typography variant="body2" fontWeight={500}>DEO</Typography>
                </Box>
                <Typography variant="h6" fontWeight={700}>
                  {project.deo_name || 'N/A'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Progress Bar */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                Overall Progress
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {Math.round(project.current_progress || 0)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={project.current_progress || 0}
              sx={{ height: 10, borderRadius: 1 }}
            />
          </Box>

          {/* Project Details */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary">
                Fund Source
              </Typography>
              <Typography fontWeight={500}>
                {project.fund_source || '—'}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary">
                Mode of Implementation
              </Typography>
              <Typography fontWeight={500}>
                {project.mode_of_implementation || '—'}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary">
                Project Scale
              </Typography>
              <Typography fontWeight={500}>
                {project.project_scale || '—'}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary">
                Created
              </Typography>
              <Typography fontWeight={500}>
                {format(new Date(project.created_at), 'MMM dd, yyyy hh:mm a')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary">
                Last Updated
              </Typography>
              <Typography fontWeight={500}>
                {format(new Date(project.updated_at), 'MMM dd, yyyy hh:mm a')}
              </Typography>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Progress Tab */}
        <TabPanel value="progress" current={activeTab}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" fontWeight={600}>
              Progress Timeline
            </Typography>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/admin/projects/${projectId}/progress`)}
            >
              Report Progress →
            </Button>
          </Box>
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <TrendingUp size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
            <Typography>Progress timeline visualization will be displayed here.</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Component implementation in progress...
            </Typography>
          </Box>
        </TabPanel>

        {/* GIS Tab */}
        <TabPanel value="gis" current={activeTab}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" fontWeight={600}>
              GIS Data
            </Typography>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/admin/projects/${projectId}/gis`)}
            >
              Edit GIS Features →
            </Button>
          </Box>
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <Map size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
            <Typography>GIS map and features will be displayed here.</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Component implementation in progress...
            </Typography>
          </Box>
        </TabPanel>

        {/* Media Tab */}
        <TabPanel value="media" current={activeTab}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
            Media Gallery
          </Typography>
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <Image size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
            <Typography>Photo gallery will be displayed here.</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Component implementation in progress...
            </Typography>
          </Box>
        </TabPanel>

        {/* Audit Tab */}
        <TabPanel value="audit" current={activeTab}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
            Audit Log
          </Typography>
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <History size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
            <Typography>Change history and audit logs will be displayed here.</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Component implementation in progress...
            </Typography>
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  );
}
