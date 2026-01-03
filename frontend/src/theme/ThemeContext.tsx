import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Extend MUI palette to include custom colors
declare module '@mui/material/styles' {
  interface Palette {
    accent: Palette['primary'];
    select: {
      selectHover: string;
      contrastText: string;
    };
    sidebarIcon: {
      main: string;
      selected: string;
    };
    dataTable: {
      row: string;
      selectHover: string;
    };
  }
  interface PaletteOptions {
    accent?: PaletteOptions['primary'];
    select?: {
      selectHover: string;
      contrastText: string;
    };
    sidebarIcon?: {
      main: string;
      selected: string;
    };
    dataTable?: {
      row: string;
      selectHover: string;
    };
  }
  interface PaletteColor {
    transparent?: string;
  }
  interface SimplePaletteColorOptions {
    transparent?: string;
  }
}

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('light');

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('themeMode') as ThemeMode | null;
    if (savedMode && (savedMode === 'light' || savedMode === 'dark')) {
      setMode(savedMode);
    } else {
      // Default to system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(prefersDark ? 'dark' : 'light');
    }
  }, []);

  // Save to localStorage when mode changes
  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo<Theme>(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: mode === 'light' ? '#96987c' : '#a5a78a',
            dark: mode === 'light' ? '#4d4f3b' : '#5e604b',
            contrastText: mode === 'light' ? '#ffffff' : '#131410',
            transparent: mode === 'light' ? '#6b6d54d0' : '#8a8c6f90',
          },
          secondary: {
            main: mode === 'light' ? '#7a9087' : '#5a706a',
            light: mode === 'light' ? '#adbdb4' : '#7a9087',
            dark: mode === 'light' ? '#5a706a' : '#425249',
            contrastText: '#ffffff',
          },
          accent: {
            main: mode === 'light' ? '#8b6f47' : '#b8935f',
            light: mode === 'light' ? '#a68a5f' : '#d4b081',
            dark: mode === 'light' ? '#6d5638' : '#8b6f47',
            contrastText: mode === 'light' ? '#ffffff' : '#131410',
          },
          background: {
            default: mode === 'light' ? '#dfe1dd' : '#1a1c19',
            paper: mode === 'light' ? '#f5f6f4' : '#242622',
          },
          text: {
            primary: mode === 'light' ? '#0f110d' : '#f2f3f0',
            secondary: mode === 'light' ? '#4a4c48' : '#b8bab6',
          },
          divider: mode === 'light' ? '#c5c7c3' : '#3a3c38',
          select: {
            selectHover: mode === 'light' ? '#d3d5d0' : '#3b3d39',
            contrastText: mode === 'light' ? '#ffffff' : '#f5f6f4',
          },
          sidebarIcon: {
            main: mode === 'light' ? '#5a5c58' : '#9a9c98',
            selected: mode === 'light' ? '#6b6d54' : '#b8935f',
          },
          dataTable: {
            row: mode === 'light' ? '#ececec' : '#2c2e2b',
            selectHover: mode === 'light' ? '#d3d5d0' : '#3b3d39',
          },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                '&:hover': {
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                },
                '&:focus': {
                  border: 'none',
                  outline: 'none',
                },
                '&:active': {
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                },
                '&:focus-visible': {
                  outline: 'none',
                },
              },
              outlined: {
                border: 'none',
                outline: 'none',
              },
            },
          },
          MuiIconButton: {
            styleOverrides: {
              root: {
                border: 'none',
                outline: 'none',
                '&:hover': {
                  border: 'none',
                  outline: 'none',
                },
                '&:active': {
                  border: 'none',
                  outline: 'none',
                },
                '&:focus': {
                  outline: 'none',
                },
                '&:focus-visible': {
                  outline: 'none',
                },
              },
            },
          },
          MuiFab: {
            styleOverrides: {
              root: {
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                '&:hover': {
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                },
                '&:active': {
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                },
                '&:focus': {
                  outline: 'none',
                },
                '&:focus-visible': {
                  outline: 'none',
                },
              },
            },
          },
          MuiSpeedDial: {
            styleOverrides: {
              fab: {
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                '&:hover': {
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                },
                '&:active': {
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                },
                '&:focus': {
                  outline: 'none',
                },
                '&:focus-visible': {
                  outline: 'none',
                },
              },
            },
          },
          MuiSpeedDialAction: {
            styleOverrides: {
              fab: {
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                '&:hover': {
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                },
                '&:active': {
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                },
                '&:focus': {
                  outline: 'none',
                },
                '&:focus-visible': {
                  outline: 'none',
                },
              },
            },
          },
        },
      }),
    [mode]
  );

  const contextValue = useMemo(() => ({ mode, toggleTheme }), [mode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
