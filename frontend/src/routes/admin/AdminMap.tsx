/**
 * Admin Map View
 * Displays projects with geometry on an interactive map within the admin layout
 */

import { useState, useMemo, useCallback } from 'react';
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
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import { X, MapPin, List as ListIcon } from 'lucide-react';
import { LeafletMap } from '../../components/map/LeafletMap';
import { LoadingSpinner, DashboardFilter } from '../../components/mui';
import { apiClient } from '../../api/client';

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
  location?: string;
  geometry_wkt?: string;
  current_progress?: number;
  project_cost?: number;
  deo_id: number;
  deo_name?: string;
  fund_source?: string;
  mode_of_implementation?: string;
  project_scale?: string;
  fund_year?: number;
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all projects with geometry (using public endpoint which includes geometry_wkt)
  const { data, isLoading, error, refetch: refetchProjects } = useQuery<ProjectsResponse>({
    queryKey: ['adminProjectsMap'],
    queryFn: async () => {
      const response = await apiClient.get('/public/projects?limit=200');
      return response.data;
    },
  });

  // Apply client-side filtering
  const filteredProjects = useMemo(() => {
    if (!data?.items) return [];

    let items = data.items;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter((p) =>
        p.project_title.toLowerCase().includes(searchLower) ||
        p.location?.toLowerCase().includes(searchLower)
      );
    }

    // DEO filter
    if (selectedDEOs.length > 0) {
      items = items.filter((p) => selectedDEOs.includes(p.deo_id));
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      items = items.filter((p) => selectedStatuses.includes(p.status));
    }

    // Fund Year filter
    if (selectedFundYears.length > 0) {
      items = items.filter((p) => p.fund_year && selectedFundYears.includes(p.fund_year));
    }

    // Province filter
    if (selectedProvinces.length > 0 && filterOptions) {
      const deoIdsInProvinces = filterOptions.deos
        .filter((d) => selectedProvinces.includes(d.province))
        .map((d) => d.deo_id);
      items = items.filter((p) => deoIdsInProvinces.includes(p.deo_id));
    }

    // Fund Source filter
    if (selectedFundSources.length > 0) {
      items = items.filter((p) => p.fund_source && selectedFundSources.includes(p.fund_source));
    }

    // Mode of Implementation filter
    if (selectedModes.length > 0) {
      items = items.filter((p) => p.mode_of_implementation && selectedModes.includes(p.mode_of_implementation));
    }

    // Project Scale filter
    if (selectedScales.length > 0) {
      items = items.filter((p) => p.project_scale && selectedScales.includes(p.project_scale));
    }

    return items;
  }, [data, search, selectedDEOs, selectedStatuses, selectedFundYears, selectedProvinces, selectedFundSources, selectedModes, selectedScales, filterOptions]);

  // Filter projects that have geometry for the map
  const projectsWithGeometry = useMemo(() => {
    return filteredProjects.filter((p) => p.geometry_wkt);
  }, [filteredProjects]);

  const handleProjectSelect = (project: { project_id: string }) => {
    setSelectedProjectId(project.project_id);
  };

  const handleRefresh = useCallback(() => {
    refetchProjects();
  }, [refetchProjects]);

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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Dashboard Filter */}
      <Box sx={{ px: { xs: 1, sm: 2 }, pt: { xs: 1, sm: 2 }, flexShrink: 0 }}>
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
          loading={isLoading}
        />
      </Box>

      {/* Map and Sidebar Container */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <Paper
            elevation={2}
            sx={{
              width: { xs: 280, sm: 320 },
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 0,
              zIndex: 1000,
            }}
          >
            {/* Header */}
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Projects ({filteredProjects.length})
                </Typography>
                <IconButton size="small" onClick={() => setSidebarOpen(false)}>
                  <X size={18} />
                </IconButton>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {projectsWithGeometry.length} with map location
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
                <ListIcon size={20} />
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
    </Box>
  );
}
