/**
 * Public Map View
 * Displays all projects with geometry on an interactive Leaflet map
 * Enhanced with floating controls and filters similar to admin map
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Popover from '@mui/material/Popover';
import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import { Search, Filter, X, RefreshCw, Camera } from 'lucide-react';
import { LeafletMap } from '../../components/map/LeafletMap';
import { PhotoMarkers } from '../../components/map/PhotoMarkers';
import { TimelineSlider } from '../../components/map/TimelineSlider';
import { LoadingSpinner, FilterButton } from '../../components/mui';
import { useFilterStore } from '../../stores/filterStore';
import { apiClient } from '../../api/client';
import { fetchGeotaggedMedia } from '../../api/media';

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

export default function PublicMap() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();

  // Filter state - persisted globally via Zustand store (shared with Dashboard/Projects)
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
    clearAllFilters: storeClearAllFilters,
  } = useFilterStore();

  // Map-specific UI state (not persisted)
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const [sliderYear, setSliderYear] = useState<number | null>(null);

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['filterOptions'],
    queryFn: async () => {
      const response = await apiClient.get('/public/filter-options');
      return response.data as FilterOptions;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all projects with geometry
  const { data, isLoading, error, refetch: refetchProjects } = useQuery<ProjectsResponse>({
    queryKey: ['publicProjectsMap'],
    queryFn: async () => {
      const response = await apiClient.get('/public/projects?limit=200');
      return response.data;
    },
  });

  // Fetch geotagged photos when toggle is enabled
  const { data: geotaggedPhotos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ['geotaggedMedia'],
    queryFn: () => fetchGeotaggedMedia(undefined, 200),
    enabled: showPhotos,
    staleTime: 60 * 1000,
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

    // Fund Year filter (slider takes priority over dropdown)
    if (sliderYear !== null) {
      items = items.filter((p) => p.fund_year === sliderYear);
    } else if (selectedFundYears.length > 0) {
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
  }, [data, search, selectedDEOs, selectedStatuses, selectedFundYears, sliderYear, selectedProvinces, selectedFundSources, selectedModes, selectedScales, filterOptions]);

  // Filter projects that have geometry for the map
  const projectsWithGeometry = useMemo(() => {
    return filteredProjects.filter((p) => p.geometry_wkt);
  }, [filteredProjects]);

  // Filter photos by active filters
  const filteredPhotos = useMemo(() => {
    if (!showPhotos || geotaggedPhotos.length === 0) return [];

    // If no project filters active, show all photos
    const hasActiveFilters = selectedDEOs.length > 0 || selectedStatuses.length > 0 ||
      selectedFundYears.length > 0 || sliderYear !== null || selectedProvinces.length > 0 ||
      selectedFundSources.length > 0 || selectedModes.length > 0 || selectedScales.length > 0;

    if (!hasActiveFilters) return geotaggedPhotos;

    // Filter photos to only show those belonging to filtered projects
    const filteredProjectIds = new Set(filteredProjects.map(p => p.project_id));
    return geotaggedPhotos.filter((photo: { project_id?: string }) =>
      photo.project_id && filteredProjectIds.has(photo.project_id)
    );
  }, [showPhotos, geotaggedPhotos, filteredProjects, selectedDEOs, selectedStatuses, selectedFundYears, sliderYear, selectedProvinces, selectedFundSources, selectedModes, selectedScales]);

  const handleProjectSelect = (project: { project_id: string }) => {
    setSelectedProjectId(project.project_id);
  };

  const handleRefresh = useCallback(() => {
    refetchProjects();
    if (showPhotos) {
      refetchPhotos();
    }
  }, [refetchProjects, refetchPhotos, showPhotos]);

  // Calculate active filters count
  const activeFiltersCount =
    selectedDEOs.length +
    selectedProvinces.length +
    selectedStatuses.length +
    selectedFundYears.length +
    selectedFundSources.length +
    selectedModes.length +
    selectedScales.length +
    (sliderYear !== null ? 1 : 0);

  const hasActiveFilters = activeFiltersCount > 0 || search.length > 0;

  const clearAllFilters = () => {
    storeClearAllFilters();
    setSliderYear(null);
  };

  // Handle slider year change - clear dropdown filter when using slider
  const handleSliderYearChange = (year: number | null) => {
    setSliderYear(year);
    if (year !== null) {
      setSelectedFundYears([]); // Clear dropdown when using slider
    }
  };

  // DEO helpers
  const deoOptions = filterOptions?.deos.map((d) => d.deo_name) || [];
  const selectedDEONames = filterOptions?.deos
    .filter((d) => selectedDEOs.includes(d.deo_id))
    .map((d) => d.deo_name) || [];

  const handleDEOChange = (names: string[]) => {
    const ids = filterOptions?.deos
      .filter((d) => names.includes(d.deo_name))
      .map((d) => d.deo_id) || [];
    setSelectedDEOs(ids);
  };

  // Fund year helpers
  const fundYearOptions = filterOptions?.fund_years.map(String) || [];
  const selectedFundYearStrings = selectedFundYears.map(String);
  const handleFundYearChange = (years: string[]) => {
    setSelectedFundYears(years.map((y) => parseInt(y, 10)));
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
    <Box sx={{ position: 'relative', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Floating Control Bar */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {/* Main Control Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 2,
            overflow: 'hidden',
          }}
        >
          {/* Search Section */}
          <Collapse in={searchExpanded} orientation="horizontal" collapsedSize={0}>
            <TextField
              size="small"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              InputProps={{
                sx: { pr: 0 },
                endAdornment: search && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')}>
                      <X size={16} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ width: 180, '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}
            />
          </Collapse>

          {/* Search Toggle */}
          <IconButton
            onClick={() => setSearchExpanded(!searchExpanded)}
            sx={{
              bgcolor: searchExpanded || search ? 'action.selected' : 'transparent',
            }}
          >
            <Search size={20} />
          </IconButton>

          {/* Filter Button */}
          <Badge badgeContent={activeFiltersCount} color="primary" overlap="circular">
            <IconButton
              onClick={(e) => setFilterAnchorEl(e.currentTarget)}
              sx={{
                bgcolor: filterAnchorEl || activeFiltersCount > 0 ? 'action.selected' : 'transparent',
              }}
            >
              <Filter size={20} />
            </IconButton>
          </Badge>

          {/* Photo Toggle Button */}
          <Tooltip title={showPhotos ? 'Hide geotagged photos' : 'Show geotagged photos'}>
            <IconButton
              onClick={() => setShowPhotos(!showPhotos)}
              sx={{
                bgcolor: showPhotos ? 'primary.main' : 'transparent',
                color: showPhotos ? 'white' : 'inherit',
                '&:hover': {
                  bgcolor: showPhotos ? 'primary.dark' : 'action.hover',
                },
              }}
            >
              <Camera size={20} />
            </IconButton>
          </Tooltip>

          {/* Refresh Button */}
          <IconButton onClick={handleRefresh}>
            <RefreshCw size={20} />
          </IconButton>
        </Box>

        {/* Project Count & Active Filters */}
        <Box
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 1,
            px: 1.5,
            py: 0.5,
            boxShadow: 1,
            width: 'fit-content',
          }}
        >
          <Typography variant="caption">
            {projectsWithGeometry.length} of {filteredProjects.length} projects on map
            {showPhotos && filteredPhotos.length > 0 && ` | ${filteredPhotos.length} photos`}
          </Typography>
        </Box>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              flexWrap: 'wrap',
              gap: 0.5,
              maxWidth: 300,
            }}
            useFlexGap
          >
            {search && (
              <Chip
                label={`"${search}"`}
                size="small"
                onDelete={() => setSearch('')}
                sx={{ bgcolor: 'background.paper' }}
              />
            )}
            {selectedDEONames.slice(0, 2).map((name) => (
              <Chip
                key={name}
                label={name}
                size="small"
                onDelete={() => {
                  const deo = filterOptions?.deos.find((d) => d.deo_name === name);
                  if (deo) setSelectedDEOs(selectedDEOs.filter((id) => id !== deo.deo_id));
                }}
                sx={{ bgcolor: 'background.paper' }}
              />
            ))}
            {activeFiltersCount > 2 && (
              <Chip
                label={`+${activeFiltersCount - 2} more`}
                size="small"
                onClick={(e) => setFilterAnchorEl(e.currentTarget as unknown as HTMLButtonElement)}
                sx={{ bgcolor: 'background.paper' }}
              />
            )}
            <Chip
              label="Clear"
              size="small"
              onClick={clearAllFilters}
              sx={{ bgcolor: 'background.paper' }}
            />
          </Stack>
        )}
      </Box>

      {/* Filter Popover */}
      <Popover
        open={Boolean(filterAnchorEl)}
        anchorEl={filterAnchorEl}
        onClose={() => setFilterAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        sx={{ mt: 1 }}
      >
        <Box sx={{ p: 2, minWidth: 280 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
            Filters
          </Typography>
          <Stack spacing={1.5}>
            <FilterButton
              label="DEO"
              options={deoOptions}
              selected={selectedDEONames}
              onChange={handleDEOChange}
              fullWidth
            />
            <FilterButton
              label="Province"
              options={filterOptions?.provinces || []}
              selected={selectedProvinces}
              onChange={setSelectedProvinces}
              fullWidth
            />
            <FilterButton
              label="Status"
              options={filterOptions?.statuses || []}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
              fullWidth
            />
            <FilterButton
              label="Fund Year"
              options={fundYearOptions}
              selected={selectedFundYearStrings}
              onChange={handleFundYearChange}
              fullWidth
            />
            <FilterButton
              label="Fund Source"
              options={filterOptions?.fund_sources || []}
              selected={selectedFundSources}
              onChange={setSelectedFundSources}
              fullWidth
            />
            <FilterButton
              label="Mode of Implementation"
              options={filterOptions?.modes_of_implementation || []}
              selected={selectedModes}
              onChange={setSelectedModes}
              fullWidth
            />
            <FilterButton
              label="Project Scale"
              options={filterOptions?.project_scales || []}
              selected={selectedScales}
              onChange={setSelectedScales}
              fullWidth
            />
          </Stack>
          {hasActiveFilters && (
            <Button
              fullWidth
              size="small"
              startIcon={<X size={16} />}
              onClick={() => {
                clearAllFilters();
                setFilterAnchorEl(null);
              }}
              sx={{ mt: 2, textTransform: 'none' }}
            >
              Clear All Filters
            </Button>
          )}
        </Box>
      </Popover>

      {/* Full-screen Map */}
      <LeafletMap
        projects={projectsWithGeometry}
        selectedProjectId={selectedProjectId}
        onProjectSelect={handleProjectSelect}
        height="100%"
        showThemeToggle={true}
        autoFitBounds={sliderYear === null && activeFiltersCount === 0}
      >
        {showPhotos && filteredPhotos.length > 0 && (
          <PhotoMarkers photos={filteredPhotos} />
        )}
      </LeafletMap>

      {/* Timeline Slider */}
      {filterOptions && filterOptions.fund_years.length > 1 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
        >
          <TimelineSlider
            years={filterOptions.fund_years}
            selectedYear={sliderYear}
            onChange={handleSliderYearChange}
            enableAutoPlay
          />
        </Box>
      )}
    </Box>
  );
}
