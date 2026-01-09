import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import Badge from '@mui/material/Badge';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { ChevronDown } from 'lucide-react';

interface FilterButtonProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export function FilterButton({
  label,
  options,
  selected,
  onChange,
  disabled = false,
}: FilterButtonProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleToggle = (item: string) => {
    const currentIndex = selected.indexOf(item);
    const newSelected = [...selected];

    if (currentIndex === -1) {
      newSelected.push(item);
    } else {
      newSelected.splice(currentIndex, 1);
    }

    onChange(newSelected);
  };

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  return (
    <>
      <Badge
        badgeContent={selected.length}
        color="primary"
        invisible={selected.length === 0}
      >
        <Button
          variant="outlined"
          onClick={handleClick}
          endIcon={<ChevronDown size={16} />}
          disabled={disabled || options.length === 0}
          size="small"
          sx={{
            textTransform: 'none',
            minWidth: { xs: isMobile ? 'auto' : 100, sm: 120 },
            flex: { xs: '1 1 calc(50% - 8px)', sm: '0 0 auto' },
            justifyContent: 'space-between',
            fontSize: { xs: '0.75rem', sm: '0.8125rem' },
            px: { xs: 1, sm: 1.5 },
          }}
        >
          {label}
        </Button>
      </Badge>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          paper: {
            sx: {
              maxHeight: 300,
              minWidth: 200,
            },
          },
        }}
      >
        {options.length > 3 && (
          <MenuItem onClick={handleSelectAll} dense>
            <Checkbox
              checked={selected.length === options.length}
              indeterminate={selected.length > 0 && selected.length < options.length}
              size="small"
            />
            <ListItemText
              primary={selected.length === options.length ? 'Deselect All' : 'Select All'}
              primaryTypographyProps={{ fontSize: '0.875rem' }}
            />
          </MenuItem>
        )}
        {options.map((item) => (
          <MenuItem key={item} onClick={() => handleToggle(item)} dense>
            <Checkbox
              checked={selected.indexOf(item) > -1}
              size="small"
            />
            <ListItemText
              primary={item}
              primaryTypographyProps={{ fontSize: '0.875rem' }}
            />
          </MenuItem>
        ))}
        {options.length === 0 && (
          <MenuItem disabled dense>
            <ListItemText
              primary="No options available"
              primaryTypographyProps={{ fontSize: '0.875rem', color: 'text.secondary' }}
            />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
