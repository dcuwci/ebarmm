import { useState } from 'react'
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import {
  Filter,
  X,
  RefreshCw,
  ChevronUp,
  ChevronDown,
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
}: DashboardFilterProps) {
  const [expanded, setExpanded] = useState(true);
  // Calculate active filters count
  const activeFiltersCount =
    (search ? 1 : 0) +
    selectedDEOs.length +
    selectedProvinces.length +
    selectedStatuses.length +
    selectedFundYears.length +
    selectedFundSources.length +
    selectedModes.length +
    selectedScales.length;
  const hasActiveFilters = activeFiltersCount > 0;
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
  if (filterOptionsLoading) {
    return (
      <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Filter size={20} />
          <Skeleton width={100} height={24} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} width={120} height={36} sx={{ borderRadius: 1 }} />
          ))}
        </Box>
      </Paper>
    );
  }
  return (
    <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid', borderColor: 'divider' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: expanded ? 2 : 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Filter size={20} />
          <Typography variant="subtitle1" fontWeight={600}>
            Filters {hasActiveFilters && `(${activeFiltersCount} active)`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {hasActiveFilters && (
            <Button
              size="small"
              startIcon={<X size={16} />}
              onClick={clearAllFilters}
              sx={{ textTransform: 'none' }}
            >
              Clear All
            </Button>
          )}
          <Tooltip title="Refresh Data">
            <span>
              <IconButton onClick={onRefresh} disabled={loading} size="small">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
            <IconButton onClick={() => setExpanded(!expanded)} size="small">
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Collapse in={expanded}>
        {/* Search and Filter Buttons */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
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
            sx={{ minWidth: 200 }}
          />
          {/* DEO Filter */}
          <FilterButton
            label="DEO"
            options={deoOptions}
            selected={selectedDEONames}
            onChange={handleDEOChange}
            disabled={loading}
          />
          {/* Province Filter */}
          <FilterButton
            label="Province"
            options={filterOptions?.provinces || []}
            selected={selectedProvinces}
            onChange={onProvinceChange}
            disabled={loading}
          />
          {/* Status Filter */}
          <FilterButton
            label="Status"
            options={filterOptions?.statuses || []}
            selected={selectedStatuses}
            onChange={onStatusChange}
            disabled={loading}
          />
          {/* Fund Year Filter */}
          <FilterButton
            label="Fund Year"
            options={fundYearOptions}
            selected={selectedFundYearStrings}
            onChange={handleFundYearChange}
            disabled={loading}
          />
          {/* Fund Source Filter */}
          <FilterButton
            label="Fund Source"
            options={filterOptions?.fund_sources || []}
            selected={selectedFundSources}
            onChange={onFundSourceChange}
            disabled={loading}
          />
          {/* Mode of Implementation Filter */}
          <FilterButton
            label="Implementation"
            options={filterOptions?.modes_of_implementation || []}
            selected={selectedModes}
            onChange={onModeChange}
            disabled={loading}
          />
          {/* Project Scale Filter */}
          <FilterButton
            label="Scale"
            options={filterOptions?.project_scales || []}
            selected={selectedScales}
            onChange={onScaleChange}
            disabled={loading}
          />
        </Box>
        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Active Filters:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {search && (
                  <Chip
                    label={`Search: "${search}"`}
                    size="small"
                    onDelete={() => onSearchChange('')}
                    color="primary"
                    variant="outlined"
                  />
                )}
                {selectedDEONames.map((name) => (
                  <Chip
                    key={name}
                    label={`DEO: ${name}`}
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
                    label={`Province: ${province}`}
                    size="small"
                    onDelete={() => onProvinceChange(selectedProvinces.filter((p) => p !== province))}
                    color="primary"
                    variant="outlined"
                  />
                ))}
                {selectedStatuses.map((status) => (
                  <Chip
                    key={status}
                    label={`Status: ${statusDisplayNames[status] || status}`}
                    size="small"
                    onDelete={() => onStatusChange(selectedStatuses.filter((s) => s !== status))}
                    color="primary"
                    variant="outlined"
                  />
                ))}
                {selectedFundYears.map((year) => (
                  <Chip
                    key={year}
                    label={`Year: ${year}`}
                    size="small"
                    onDelete={() => onFundYearChange(selectedFundYears.filter((y) => y !== year))}
                    color="primary"
                    variant="outlined"
                  />
                ))}
                {selectedFundSources.map((source) => (
                  <Chip
                    key={source}
                    label={`Fund: ${source}`}
                    size="small"
                    onDelete={() => onFundSourceChange(selectedFundSources.filter((s) => s !== source))}
                    color="primary"
                    variant="outlined"
                  />
                ))}
                {selectedModes.map((mode) => (
                  <Chip
                    key={mode}
                    label={`Mode: ${mode}`}
                    size="small"
                    onDelete={() => onModeChange(selectedModes.filter((m) => m !== mode))}
                    color="primary"
                    variant="outlined"
                  />
                ))}
                {selectedScales.map((scale) => (
                  <Chip
                    key={scale}
                    label={`Scale: ${scale}`}
                    size="small"
                    onDelete={() => onScaleChange(selectedScales.filter((s) => s !== scale))}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Box>
          </>
        )}
      </Collapse>
    </Paper>
  );
}
