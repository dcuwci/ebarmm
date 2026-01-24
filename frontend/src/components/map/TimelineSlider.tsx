/**
 * Timeline Slider Component
 * Allows filtering map features by year using an interactive slider
 */

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import { Calendar, X, Play, Pause } from 'lucide-react';

interface TimelineSliderProps {
  /** Available years to display on the slider */
  years: number[];
  /** Currently selected year (null = show all) */
  selectedYear: number | null;
  /** Callback when year selection changes */
  onChange: (year: number | null) => void;
  /** Optional: Enable auto-play through years */
  enableAutoPlay?: boolean;
  /** Auto-play interval in ms (default: 2000) */
  autoPlayInterval?: number;
}

export function TimelineSlider({
  years,
  selectedYear,
  onChange,
  enableAutoPlay = false,
  autoPlayInterval = 2000,
}: TimelineSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  // Sort years ascending
  const sortedYears = [...years].sort((a, b) => a - b);
  const minYear = sortedYears[0];
  const maxYear = sortedYears[sortedYears.length - 1];

  // Auto-play effect
  useEffect(() => {
    if (!isPlaying || !enableAutoPlay || sortedYears.length === 0) return;

    const interval = setInterval(() => {
      if (selectedYear === null) {
        onChange(minYear);
      } else {
        const currentIndex = sortedYears.indexOf(selectedYear);
        if (currentIndex === sortedYears.length - 1) {
          // Loop back to start
          onChange(minYear);
        } else {
          onChange(sortedYears[currentIndex + 1]);
        }
      }
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [isPlaying, selectedYear, sortedYears, minYear, onChange, autoPlayInterval, enableAutoPlay]);

  // Don't render if no years available
  if (sortedYears.length === 0) {
    return null;
  }

  // Create marks for each year
  const marks = sortedYears.map((year) => ({
    value: year,
    label: year.toString(),
  }));

  const handleSliderChange = (_event: Event, newValue: number | number[]) => {
    const year = newValue as number;
    onChange(year);
  };

  const handleClear = () => {
    onChange(null);
    setIsPlaying(false);
  };

  const toggleAutoPlay = () => {
    if (!isPlaying && selectedYear === null) {
      onChange(minYear);
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <Paper
      elevation={2}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1,
        borderRadius: 2,
        minWidth: 300,
      }}
    >
      {/* Calendar icon */}
      <Tooltip title="Filter by year">
        <Calendar size={20} style={{ flexShrink: 0, opacity: 0.7 }} />
      </Tooltip>

      {/* Slider */}
      <Box sx={{ flex: 1, px: 1 }}>
        <Slider
          value={selectedYear ?? minYear}
          onChange={handleSliderChange}
          min={minYear}
          max={maxYear}
          step={null}
          marks={marks}
          valueLabelDisplay="auto"
          sx={{
            '& .MuiSlider-markLabel': {
              fontSize: '0.7rem',
            },
            '& .MuiSlider-mark': {
              height: 8,
              width: 2,
            },
          }}
        />
      </Box>

      {/* Year display */}
      <Typography
        variant="body2"
        fontWeight={600}
        sx={{
          minWidth: 40,
          textAlign: 'center',
          color: selectedYear ? 'primary.main' : 'text.secondary',
        }}
      >
        {selectedYear ?? 'All'}
      </Typography>

      {/* Auto-play button (optional) */}
      {enableAutoPlay && (
        <Tooltip title={isPlaying ? 'Pause' : 'Play through years'}>
          <IconButton size="small" onClick={toggleAutoPlay}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </IconButton>
        </Tooltip>
      )}

      {/* Clear button */}
      {selectedYear !== null && (
        <Tooltip title="Show all years">
          <IconButton size="small" onClick={handleClear}>
            <X size={18} />
          </IconButton>
        </Tooltip>
      )}
    </Paper>
  );
}

export default TimelineSlider;
