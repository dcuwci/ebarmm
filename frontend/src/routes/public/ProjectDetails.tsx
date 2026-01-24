/**
 * Public Project Details Page
 * Read-only view for transparency portal within the public layout
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  Image,
  Map,
  Building2,
  Wallet,
  Scale,
  Wrench,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

import { fetchPublicProject } from '../../api/public';
import { Card, StatCard, Button } from '../../components/mui';
import MediaGallery from '../../components/media/MediaGallery';
import ProjectGISView from '../../components/map/ProjectGISView';
import type { PublicProjectDetail } from '../../types/project';

type TabId = 'overview' | 'progress' | 'media' | 'map';

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
};

export default function ProjectDetails() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const { data: project, isLoading, error } = useQuery<PublicProjectDetail>({
    queryKey: ['publicProject', projectId],
    queryFn: () => fetchPublicProject(projectId!),
    enabled: Boolean(projectId),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: TabId) => {
    setActiveTab(newValue);
  };

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={32} />
            <Skeleton variant="text" width={200} />
          </Box>
        </Box>
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rounded" height={100} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={400} />
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          Error loading project details. The project may not exist or has been removed.
        </Alert>
        <Button
          variant="secondary"
          startIcon={<ArrowLeft size={18} />}
          onClick={() => navigate('/portal/projects')}
        >
          Back to Projects
        </Button>
      </Box>
    );
  }

  // Prepare chart data from progress history
  const chartData = project.progress_history.map((entry) => ({
    date: format(new Date(entry.report_date), 'MMM dd'),
    progress: entry.reported_percent,
    fullDate: entry.report_date,
  }));

  const infoItems = [
    { icon: Building2, label: 'DEO', value: project.deo_name || 'N/A' },
    { icon: MapPin, label: 'Location', value: project.location || 'N/A' },
    { icon: Wallet, label: 'Fund Source', value: project.fund_source || 'N/A' },
    { icon: Wrench, label: 'Implementation Mode', value: project.mode_of_implementation || 'N/A' },
    { icon: Scale, label: 'Project Scale', value: project.project_scale || 'N/A' },
    { icon: Calendar, label: 'Fund Year', value: project.fund_year.toString() },
  ];

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
        <Tooltip title="Back to Projects">
          <IconButton onClick={() => navigate('/portal/projects')} sx={{ mt: 0.5 }}>
            <ArrowLeft size={24} />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h5" fontWeight={600}>
              {project.project_title}
            </Typography>
            <Chip
              label={project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              color={STATUS_COLORS[project.status] || 'default'}
              size="small"
            />
          </Box>
          {project.location && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <MapPin size={16} />
              <Typography variant="body2" color="text.secondary">
                {project.location}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Project Budget"
            value={formatCurrency(project.project_cost)}
            icon={<DollarSign size={24} />}
            color={theme.palette.success.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Current Progress"
            value={`${Math.round(project.current_progress)}%`}
            icon={<TrendingUp size={24} />}
            color={theme.palette.primary.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Fund Year"
            value={project.fund_year.toString()}
            icon={<Calendar size={24} />}
            color={theme.palette.info.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Progress Reports"
            value={project.progress_history.length.toString()}
            icon={<FileText size={24} />}
            color={theme.palette.warning.main}
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            px: 2,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
            },
          }}
        >
          <Tab value="overview" label="Overview" icon={<FileText size={18} />} iconPosition="start" />
          <Tab value="progress" label="Progress" icon={<TrendingUp size={18} />} iconPosition="start" />
          <Tab value="media" label="Media" icon={<Image size={18} />} iconPosition="start" />
          <Tab value="map" label="Map" icon={<Map size={18} />} iconPosition="start" />
        </Tabs>

        {/* Overview Tab */}
        <TabPanel value="overview" current={activeTab}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Project Information
            </Typography>
            <Grid container spacing={2}>
              {infoItems.map((item) => (
                <Grid item xs={12} sm={6} md={4} key={item.label}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <item.icon size={20} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {item.label}
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {item.value}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* Progress Bar */}
            <Box sx={{ mt: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  Overall Progress
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {project.current_progress.toFixed(1)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={project.current_progress}
                sx={{ height: 10, borderRadius: 5 }}
              />
            </Box>

            {/* Last Updated */}
            {project.last_updated && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                Last updated: {format(new Date(project.last_updated), 'MMMM d, yyyy')}
              </Typography>
            )}
          </Box>
        </TabPanel>

        {/* Progress Tab */}
        <TabPanel value="progress" current={activeTab}>
          <Box sx={{ p: 3 }}>
            {chartData.length > 0 ? (
              <>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Progress Over Time
                </Typography>
                <Box sx={{ height: 300, mt: 2 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                      <XAxis dataKey="date" stroke={theme.palette.text.secondary} fontSize={12} />
                      <YAxis domain={[0, 100]} stroke={theme.palette.text.secondary} fontSize={12} />
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 8,
                        }}
                        formatter={(value: number) => [`${value}%`, 'Progress']}
                      />
                      <ReferenceLine y={100} stroke={theme.palette.success.main} strokeDasharray="5 5" />
                      <Line
                        type="monotone"
                        dataKey="progress"
                        stroke={theme.palette.primary.main}
                        strokeWidth={2}
                        dot={{ fill: theme.palette.primary.main, strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>

                {/* Progress History Table */}
                <Typography variant="h6" fontWeight={600} sx={{ mt: 4, mb: 2 }}>
                  Progress Reports
                </Typography>
                <Box sx={{ overflow: 'auto' }}>
                  <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                    <Box component="thead">
                      <Box component="tr" sx={{ bgcolor: 'action.hover' }}>
                        <Box component="th" sx={{ p: 1.5, textAlign: 'left', fontWeight: 600 }}>Date</Box>
                        <Box component="th" sx={{ p: 1.5, textAlign: 'center', fontWeight: 600 }}>Progress</Box>
                        <Box component="th" sx={{ p: 1.5, textAlign: 'left', fontWeight: 600 }}>Remarks</Box>
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {project.progress_history.map((entry, idx) => (
                        <Box component="tr" key={idx} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                          <Box component="td" sx={{ p: 1.5 }}>
                            {format(new Date(entry.report_date), 'MMM d, yyyy')}
                          </Box>
                          <Box component="td" sx={{ p: 1.5, textAlign: 'center' }}>
                            <Chip label={`${entry.reported_percent}%`} size="small" color="primary" />
                          </Box>
                          <Box component="td" sx={{ p: 1.5, color: 'text.secondary' }}>
                            {entry.remarks || '-'}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography color="text.secondary">
                  No progress reports available yet.
                </Typography>
              </Box>
            )}
          </Box>
        </TabPanel>

        {/* Media Tab */}
        <TabPanel value="media" current={activeTab}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Project Media
            </Typography>
            {Object.keys(project.media_counts).length > 0 ? (
              <MediaGallery projectId={projectId!} canDelete={false} />
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Image size={48} style={{ opacity: 0.3 }} />
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  No media files uploaded for this project.
                </Typography>
              </Box>
            )}
          </Box>
        </TabPanel>

        {/* Map Tab */}
        <TabPanel value="map" current={activeTab}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Project Location
            </Typography>
            {project.gis_feature_count > 0 ? (
              <Box sx={{ height: 400, borderRadius: 1, overflow: 'hidden' }}>
                <ProjectGISView projectId={projectId!} />
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Map size={48} style={{ opacity: 0.3 }} />
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  No GIS data available for this project.
                </Typography>
              </Box>
            )}
          </Box>
        </TabPanel>
      </Card>
    </Box>
  );
}
