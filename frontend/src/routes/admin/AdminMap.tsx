/**
 * Admin Map View
 * Displays projects with geometry on an interactive map within the admin layout
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import { Search, X, MapPin } from 'lucide-react';
import { LeafletMap } from '../../components/map/LeafletMap';
import { LoadingSpinner } from '../../components/mui';
import { apiClient } from '../../api/client';

interface Project {
  project_id: string;
  project_title: string;
  status: string;
  location?: string;
  geometry_wkt?: string;
  current_progress?: number;
  project_cost?: number;
  deo_name?: string;
}

interface ProjectsResponse {
  total: number;
  items: Project[];
}

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  planning: 'default',
  ongoing: 'primary',
  completed: 'success',
  suspended: 'warning',
  cancelled: 'error',
};

export default function AdminMap() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch all projects with geometry (using public endpoint which includes geometry_wkt)
  const { data, isLoading, error } = useQuery<ProjectsResponse>({
    queryKey: ['adminProjectsMap'],
    queryFn: async () => {
      const response = await apiClient.get('/public/projects?limit=200');
      return response.data;
    },
  });

  // Filter projects that have geometry and match search
  const projectsWithGeometry = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((p) => {
      const matchesSearch = !searchTerm ||
        p.project_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.location?.toLowerCase().includes(searchTerm.toLowerCase());
      return p.geometry_wkt && matchesSearch;
    });
  }, [data, searchTerm]);

  // All projects for sidebar list (with or without geometry)
  const filteredProjects = useMemo(() => {
    if (!data?.items) return [];
    if (!searchTerm) return data.items;
    return data.items.filter((p) =>
      p.project_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const handleProjectSelect = (project: { project_id: string }) => {
    setSelectedProjectId(project.project_id);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 64px)' }}>
        <LoadingSpinner size="lg" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 64px)' }}>
        <Typography color="error">Error loading projects</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Sidebar */}
      {sidebarOpen && (
        <Paper
          elevation={2}
          sx={{
            width: 350,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
            zIndex: 1000,
          }}
        >
          {/* Header */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Projects
              </Typography>
              <IconButton size="small" onClick={() => setSidebarOpen(false)}>
                <X size={20} />
              </IconButton>
            </Box>

            <TextField
              size="small"
              fullWidth
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} />
                  </InputAdornment>
                ),
              }}
            />

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {projectsWithGeometry.length} of {data?.total || 0} projects on map
            </Typography>
          </Box>

          {/* Project List */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <List disablePadding>
              {filteredProjects.map((project) => (
                <ListItem key={project.project_id} disablePadding divider>
                  <ListItemButton
                    selected={selectedProjectId === project.project_id}
                    onClick={() => setSelectedProjectId(project.project_id)}
                    sx={{ py: 1.5 }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                            {project.project_title}
                          </Typography>
                          {!project.geometry_wkt && (
                            <Chip label="No GIS" size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          {project.location && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                              <MapPin size={12} />
                              <Typography variant="caption" color="text.secondary">
                                {project.location}
                              </Typography>
                            </Box>
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={project.status}
                              size="small"
                              color={STATUS_COLORS[project.status] || 'default'}
                              sx={{ fontSize: '0.65rem', height: 20 }}
                            />
                            {project.current_progress !== undefined && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={project.current_progress}
                                  sx={{ flex: 1, height: 4, borderRadius: 1 }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {Math.round(project.current_progress)}%
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>

            {filteredProjects.length === 0 && (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  No projects found
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Map */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        {/* Toggle sidebar button when closed */}
        {!sidebarOpen && (
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              left: 10,
              zIndex: 1100,
            }}
          >
            <Tooltip title="Show projects">
              <IconButton
                onClick={() => setSidebarOpen(true)}
                sx={{
                  bgcolor: 'background.paper',
                  boxShadow: 2,
                  '&:hover': { bgcolor: 'background.paper' },
                }}
              >
                <Search size={20} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        <LeafletMap
          projects={projectsWithGeometry}
          selectedProjectId={selectedProjectId}
          onProjectSelect={handleProjectSelect}
          height="100%"
          showThemeToggle={true}
        />
      </Box>
    </Box>
  );
}
