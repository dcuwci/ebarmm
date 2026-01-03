import React from 'react';
import MuiButton from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

// Map custom variants to MUI variants and colors
const variantMap = {
  primary: { muiVariant: 'contained' as const, color: 'primary' as const },
  secondary: { muiVariant: 'outlined' as const, color: 'primary' as const },
  danger: { muiVariant: 'contained' as const, color: 'error' as const },
  ghost: { muiVariant: 'text' as const, color: 'inherit' as const },
};

const sizeMap = {
  sm: 'small' as const,
  md: 'medium' as const,
  lg: 'large' as const,
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  startIcon,
  endIcon,
  onClick,
  type = 'button',
}) => {
  const { muiVariant, color } = variantMap[variant];
  const muiSize = sizeMap[size];

  return (
    <MuiButton
      variant={muiVariant}
      color={color}
      size={muiSize}
      fullWidth={fullWidth}
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : startIcon}
      endIcon={endIcon}
      onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
      type={type}
      sx={{
        textTransform: 'none',
        fontWeight: 500,
        ...(size === 'sm' && { py: 0.75, px: 2 }),
        ...(size === 'md' && { py: 1, px: 2.5 }),
        ...(size === 'lg' && { py: 1.5, px: 3 }),
      }}
    >
      {loading ? 'Loading...' : children}
    </MuiButton>
  );
};

export default Button;
