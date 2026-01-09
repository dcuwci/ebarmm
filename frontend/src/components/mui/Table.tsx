import React from 'react';
import MuiTable from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { LoadingSpinner } from './Loading';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  /** Hide column on mobile (< 600px) */
  hideOnMobile?: boolean;
  /** Hide column on tablet (< 900px) */
  hideOnTablet?: boolean;
  /** Minimum width for this column */
  minWidth?: number;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string | number;
  /** Minimum width for the table (enables horizontal scroll) */
  minWidth?: number;
}

export function Table<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  rowKey,
  minWidth = 650,
}: TableProps<T>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Filter columns based on screen size
  const visibleColumns = columns.filter((col) => {
    if (isMobile && col.hideOnMobile) return false;
    if (isTablet && col.hideOnTablet) return false;
    return true;
  });

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 6,
        }}
      >
        <LoadingSpinner size="lg" />
      </Box>
    );
  }

  if (data.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        overflowX: 'auto',
        '&::-webkit-scrollbar': {
          height: 8,
        },
        '&::-webkit-scrollbar-track': {
          bgcolor: 'action.hover',
        },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'action.disabled',
          borderRadius: 4,
        },
      }}
    >
      <MuiTable sx={{ minWidth }}>
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            {visibleColumns.map((column) => (
              <TableCell
                key={column.key}
                align={column.align || 'left'}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  width: column.width,
                  minWidth: column.minWidth,
                  whiteSpace: 'nowrap',
                }}
              >
                {column.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              hover={!!onRowClick}
              sx={{
                cursor: onRowClick ? 'pointer' : 'default',
                '&:last-child td, &:last-child th': { border: 0 },
              }}
            >
              {visibleColumns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align || 'left'}
                  sx={{ minWidth: column.minWidth }}
                >
                  {column.render
                    ? column.render(row)
                    : String((row as Record<string, unknown>)[column.key] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </MuiTable>
    </TableContainer>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  onPageChange,
  totalItems = 0,
  itemsPerPage = 10,
  onItemsPerPageChange,
}) => {
  return (
    <TablePagination
      component="div"
      count={totalItems}
      page={currentPage - 1}
      onPageChange={(_, newPage) => onPageChange(newPage + 1)}
      rowsPerPage={itemsPerPage}
      onRowsPerPageChange={(e) => onItemsPerPageChange?.(parseInt(e.target.value, 10))}
      rowsPerPageOptions={[5, 10, 25, 50]}
      sx={{
        borderTop: 1,
        borderColor: 'divider',
        '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
          fontSize: { xs: '0.75rem', sm: '0.875rem' },
        },
        '& .MuiTablePagination-toolbar': {
          flexWrap: 'wrap',
          justifyContent: { xs: 'center', sm: 'flex-end' },
          px: { xs: 1, sm: 2 },
        },
      }}
    />
  );
};

export default Table;
