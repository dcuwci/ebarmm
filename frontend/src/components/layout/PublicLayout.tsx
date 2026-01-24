/**
 * Public Layout
 * MUI-based layout with collapsible sidebar and header for public transparency portal
 * Mirrors AdminLayout but without authentication-required features
 */

import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import {
  Menu as MenuIcon,
  ChevronLeft,
  LayoutDashboard,
  FolderKanban,
  Map,
  LogIn,
  Sun,
  Moon,
  Home,
} from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

// Main navigation items for public portal (mirrors admin structure)
const mainNavItems = [
  { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/portal' },
  { label: 'Projects', icon: <FolderKanban size={20} />, path: '/portal/projects' },
  { label: 'Map', icon: <Map size={20} />, path: '/map' },
];

export default function PublicLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleTheme } = useTheme();

  const [drawerOpen, setDrawerOpen] = useState(false); // Collapsed by default

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  // Get current header tab value
  const getHeaderTabValue = () => {
    if (location.pathname === '/portal') return '/portal';
    if (location.pathname.startsWith('/portal/projects')) return '/portal/projects';
    if (location.pathname === '/map') return '/map';
    return false;
  };

  // Check if path is active
  const isActive = (path: string) => {
    if (path === '/portal') {
      return location.pathname === '/portal';
    }
    if (path === '/portal/projects') {
      return location.pathname.startsWith('/portal/projects');
    }
    return location.pathname === path;
  };

  const drawerWidth = drawerOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1,
        }}
      >
        <Toolbar>
          <Typography
            variant="h6"
            fontWeight={600}
            sx={{ mr: 4, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            E-BARMM
          </Typography>

          {/* Header Navigation Tabs */}
          <Tabs
            value={getHeaderTabValue()}
            onChange={(_, value) => navigate(value)}
            sx={{
              flexGrow: 1,
              '& .MuiTab-root': {
                minHeight: 64,
                textTransform: 'none',
                fontSize: '0.9rem',
                fontWeight: 500,
              },
            }}
          >
            {mainNavItems.map((item) => (
              <Tab
                key={item.path}
                value={item.path}
                label={item.label}
                icon={item.icon}
                iconPosition="start"
              />
            ))}
          </Tabs>

          {/* Home Button */}
          <Tooltip title="Back to Home">
            <IconButton onClick={() => navigate('/')} sx={{ mr: 1 }}>
              <Home size={20} />
            </IconButton>
          </Tooltip>

          {/* Theme Toggle */}
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton onClick={toggleTheme} sx={{ mr: 1 }}>
              {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </IconButton>
          </Tooltip>

          {/* Login Button */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<LogIn size={18} />}
            onClick={() => navigate('/login')}
            sx={{ textTransform: 'none' }}
          >
            Login
          </Button>
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
            transition: (theme) =>
              theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            overflow: 'hidden',
          },
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}

        {/* Toggle Button inside sidebar */}
        <Box sx={{ display: 'flex', justifyContent: drawerOpen ? 'flex-end' : 'center', px: 1, py: 1 }}>
          <IconButton onClick={handleDrawerToggle} size="small">
            {drawerOpen ? <ChevronLeft size={20} /> : <MenuIcon size={20} />}
          </IconButton>
        </Box>

        <Box sx={{ overflowY: 'auto', overflowX: 'hidden', flex: 1 }}>
          {/* Main Navigation */}
          <List>
            {mainNavItems.map((item) => (
              <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
                <Tooltip title={!drawerOpen ? item.label : ''} placement="right">
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    selected={isActive(item.path)}
                    sx={{
                      minHeight: 48,
                      justifyContent: drawerOpen ? 'initial' : 'center',
                      px: 2.5,
                      mx: 1,
                      borderRadius: 1,
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                        '& .MuiListItemIcon-root': {
                          color: 'inherit',
                        },
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: drawerOpen ? 2 : 'auto',
                        justifyContent: 'center',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      sx={{ opacity: drawerOpen ? 1 : 0 }}
                    />
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        <Outlet />
      </Box>
    </Box>
  );
}
