import { useState } from 'react'
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import {
  Filter,
  X,
  RefreshCw,
  Search,
} from 'lucide-react';
import { FilterButton } from './FilterButton';

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

interface DashboardFilterProps {
  filterOptions: FilterOptions | null;
  filterOptionsLoading: boolean;
  // Filter values
  search: string;
  onSearchChange: (search: string) => void;
  selectedDEOs: number[];
  onDEOChange: (deoIds: number[]) => void;
  selectedProvinces: string[];
  onProvinceChange: (provinces: string[]) => void;
  selectedStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  selectedFundYears: number[];
  onFundYearChange: (years: number[]) => void;
  selectedFundSources: string[];
  onFundSourceChange: (sources: string[]) => void;
  selectedModes: string[];
  onModeChange: (modes: string[]) => void;
  selectedScales: string[];
  onScaleChange: (scales: string[]) => void;
  onRefresh: () => void;
  loading?: boolean;
  // Optional action buttons to display on the right
  actionButtons?: React.ReactNode;
}

export function DashboardFilter({
  filterOptions,
  filterOptionsLoading,
  search,
  onSearchChange,
  selectedDEOs,
  onDEOChange,
  selectedProvinces,
  onProvinceChange,
  selectedStatuses,
  onStatusChange,
  selectedFundYears,
  onFundYearChange,
  selectedFundSources,
  onFundSourceChange,
  selectedModes,
  onModeChange,
  selectedScales,
  onScaleChange,
  onRefresh,
  loading = false,
  actionButtons,
}: DashboardFilterProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  // Calculate active filters count (excluding search)
  const activeFiltersCount =
    selectedDEOs.length +
    selectedProvinces.length +
    selectedStatuses.length +
    selectedFundYears.length +
    selectedFundSources.length +
    selectedModes.length +
    selectedScales.length;

  const hasActiveFilters = activeFiltersCount > 0 || search.length > 0;

  // Clear all filters
  const clearAllFilters = () => {
    onSearchChange('');
    onDEOChange([]);
    onProvinceChange([]);
    onStatusChange([]);
    onFundYearChange([]);
    onFundSourceChange([]);
    onModeChange([]);
    onScaleChange([]);
  };

  // Get DEO options as strings for FilterButton
  const deoOptions = filterOptions?.deos.map((d) => d.deo_name) || [];
  const selectedDEONames =
    filterOptions?.deos
      .filter((d) => selectedDEOs.includes(d.deo_id))
      .map((d) => d.deo_name) || [];

  const handleDEOChange = (names: string[]) => {
    const ids =
      filterOptions?.deos
        .filter((d) => names.includes(d.deo_name))
        .map((d) => d.deo_id) || [];
    onDEOChange(ids);
  };

  // Fund years as strings
  const fundYearOptions = filterOptions?.fund_years.map(String) || [];
  const selectedFundYearStrings = selectedFundYears.map(String);

  const handleFundYearChange = (years: string[]) => {
    onFundYearChange(years.map((y) => parseInt(y, 10)));
  };

  // Status display names
  const statusDisplayNames: Record<string, string> = {
    planning: 'Planning',
    ongoing: 'Ongoing',
    completed: 'Completed',
    suspended: 'Suspended',
  };

  const handleOpenFilters = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseFilters = () => {
    setAnchorEl(null);
  };

  if (filterOptionsLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Skeleton width={200} height={40} sx={{ borderRadius: 1 }} />
        <Skeleton width={100} height={40} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      {/* Search and Filter Button Row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 200, flex: { xs: 1, sm: '0 0 auto' } }}
        />

        {/* Filter Button */}
        <Badge badgeContent={activeFiltersCount} color="primary">
          <Button
            variant={activeFiltersCount > 0 ? "contained" : "outlined"}
            size="medium"
            startIcon={<Filter size={18} />}
            onClick={handleOpenFilters}
            sx={{ textTransform: 'none' }}
          >
            Filters
          </Button>
        </Badge>

        {/* Clear All Button */}
        {hasActiveFilters && (
          <Button
            size="small"
            startIcon={<X size={16} />}
            onClick={clearAllFilters}
            sx={{ textTransform: 'none' }}
          >
            Clear
          </Button>
        )}

        {/* Refresh Button */}
        <Tooltip title="Refresh Data">
          <span>
            <IconButton onClick={onRefresh} disabled={loading} size="small">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Spacer */}
        {actionButtons && <Box sx={{ flex: 1 }} />}

        {/* Action Buttons */}
        {actionButtons}
      </Box>

      {/* Filter Popover */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleCloseFilters}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        sx={{ mt: 1 }}
      >
        <Box sx={{ p: 2, minWidth: 280, maxWidth: 400 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
            Filter Options
          </Typography>

          <Stack spacing={1.5}>
            {/* DEO Filter */}
            <FilterButton
              label="DEO"
              options={deoOptions}
              selected={selectedDEONames}
              onChange={handleDEOChange}
              disabled={loading}
              fullWidth
            />

            {/* Province Filter */}
            <FilterButton
              label="Province"
              options={filterOptions?.provinces || []}
              selected={selectedProvinces}
              onChange={onProvinceChange}
              disabled={loading}
              fullWidth
            />

            {/* Status Filter */}
            <FilterButton
              label="Status"
              options={filterOptions?.statuses || []}
              selected={selectedStatuses}
              onChange={onStatusChange}
              disabled={loading}
              fullWidth
            />

            {/* Fund Year Filter */}
            <FilterButton
              label="Fund Year"
              options={fundYearOptions}
              selected={selectedFundYearStrings}
              onChange={handleFundYearChange}
              disabled={loading}
              fullWidth
            />

            {/* Fund Source Filter */}
            <FilterButton
              label="Fund Source"
              options={filterOptions?.fund_sources || []}
              selected={selectedFundSources}
              onChange={onFundSourceChange}
              disabled={loading}
              fullWidth
            />

            {/* Mode of Implementation Filter */}
            <FilterButton
              label="Mode of Implementation"
              options={filterOptions?.modes_of_implementation || []}
              selected={selectedModes}
              onChange={onModeChange}
              disabled={loading}
              fullWidth
            />

            {/* Project Scale Filter */}
            <FilterButton
              label="Project Scale"
              options={filterOptions?.project_scales || []}
              selected={selectedScales}
              onChange={onScaleChange}
              disabled={loading}
              fullWidth
            />
          </Stack>

          {hasActiveFilters && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Button
                fullWidth
                size="small"
                startIcon={<X size={16} />}
                onClick={() => {
                  clearAllFilters();
                  handleCloseFilters();
                }}
                sx={{ textTransform: 'none' }}
              >
                Clear All Filters
              </Button>
            </Box>
          )}
        </Box>
      </Popover>

      {/* Active Filters Chips */}
      {hasActiveFilters && (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}
          useFlexGap
        >
          {search && (
            <Chip
              label={`"${search}"`}
              size="small"
              onDelete={() => onSearchChange('')}
              color="primary"
              variant="outlined"
            />
          )}
          {selectedDEONames.map((name) => (
            <Chip
              key={name}
              label={name}
              size="small"
              onDelete={() => {
                const deo = filterOptions?.deos.find((d) => d.deo_name === name);
                if (deo) {
                  onDEOChange(selectedDEOs.filter((id) => id !== deo.deo_id));
                }
              }}
              color="primary"
              variant="outlined"
            />
          ))}
          {selectedProvinces.map((province) => (
            <Chip
              key={province}
              label={province}
              size="small"
              onDelete={() => onProvinceChange(selectedProvinces.filter((p) => p !== province))}
              color="primary"
              variant="outlined"
            />
          ))}
          {selectedStatuses.map((status) => (
            <Chip
              key={status}
              label={statusDisplayNames[status] || status}
              size="small"
              onDelete={() => onStatusChange(selectedStatuses.filter((s) => s !== status))}
              color="primary"
              variant="outlined"
            />
          ))}
          {selectedFundYears.map((year) => (
            <Chip
              key={year}
              label={year}
              size="small"
              onDelete={() => onFundYearChange(selectedFundYears.filter((y) => y !== year))}
              color="primary"
              variant="outlined"
            />
          ))}
          {selectedFundSources.map((source) => (
            <Chip
              key={source}
              label={source}
              size="small"
              onDelete={() => onFundSourceChange(selectedFundSources.filter((s) => s !== source))}
              color="primary"
              variant="outlined"
            />
          ))}
          {selectedModes.map((mode) => (
            <Chip
              key={mode}
              label={mode}
              size="small"
              onDelete={() => onModeChange(selectedModes.filter((m) => m !== mode))}
              color="primary"
              variant="outlined"
            />
          ))}
          {selectedScales.map((scale) => (
            <Chip
              key={scale}
              label={scale}
              size="small"
              onDelete={() => onScaleChange(selectedScales.filter((s) => s !== scale))}
              color="primary"
              variant="outlined"
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
