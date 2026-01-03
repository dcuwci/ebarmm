import React from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MuiSkeleton from '@mui/material/Skeleton';
import Backdrop from '@mui/material/Backdrop';
import Paper from '@mui/material/Paper';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'inherit';
}

const sizeMap = {
  sm: 20,
  md: 32,
  lg: 48,
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
}) => {
  return <CircularProgress size={sizeMap[size]} color={color} />;
};

interface LoadingOverlayProps {
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Loading...',
}) => {
  return (
    <Backdrop open sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}>
      <Paper
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          borderRadius: 2,
        }}
      >
        <LoadingSpinner size="lg" />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          {message}
        </Typography>
      </Paper>
    </Backdrop>
  );
};

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 6,
      }}
    >
      {icon && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: 2,
            color: 'text.disabled',
          }}
        >
          {icon}
        </Box>
      )}
      <Typography variant="h6" fontWeight={500} gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}
        >
          {description}
        </Typography>
      )}
      {action && <Box>{action}</Box>}
    </Box>
  );
};

interface SkeletonProps {
  variant?: 'text' | 'rectangular' | 'rounded' | 'circular';
  width?: number | string;
  height?: number | string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  count = 1,
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <MuiSkeleton
          key={index}
          variant={variant}
          width={width}
          height={height}
          sx={{ mb: 0.5 }}
        />
      ))}
    </>
  );
};

export default LoadingSpinner;
