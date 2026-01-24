import React from 'react';
import MuiCard from '@mui/material/Card';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import type { SxProps, Theme } from '@mui/material/styles';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  elevation?: number;
  onClick?: () => void;
  sx?: SxProps<Theme>;
}

const paddingMap = {
  none: 0,
  sm: 1.5,
  md: 3,
  lg: 4,
};

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  hover = false,
  elevation = 1,
  onClick,
  sx,
}) => {
  return (
    <MuiCard
      elevation={elevation}
      onClick={onClick}
      sx={{
        borderRadius: 2,
        p: paddingMap[padding],
        ...(hover && {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            transform: 'translateY(-2px)',
          },
        }),
        ...sx,
      }}
    >
      {children}
    </MuiCard>
  );
};

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        mb: 2,
      }}
    >
      <Box>
        <Typography variant="h6" fontWeight={600}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && <Box>{action}</Box>}
    </Box>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color = '#1976d2',
  trend,
  loading = false,
  onClick,
}) => {
  if (loading) {
    return (
      <Card>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="40%" height={40} sx={{ mt: 1 }} />
          </Box>
          <Skeleton variant="rounded" width={48} height={48} />
        </Box>
      </Card>
    );
  }

  return (
    <Card hover onClick={onClick} sx={onClick ? { cursor: 'pointer' } : undefined}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={600} sx={{ mt: 1 }}>
            {value}
          </Typography>
          {trend && (
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                color: trend.isPositive ? 'success.main' : 'error.main',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span style={{ marginRight: 4 }}>
                {trend.isPositive ? '↑' : '↓'}
              </span>
              {Math.abs(trend.value)}%
            </Typography>
          )}
        </Box>
        {icon && (
          <Box
            sx={{
              bgcolor: `${color}15`,
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color,
            }}
          >
            {icon}
          </Box>
        )}
      </Box>
    </Card>
  );
};

export default Card;
