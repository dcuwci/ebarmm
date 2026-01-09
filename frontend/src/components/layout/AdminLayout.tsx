/**
 * Admin Layout
 * MUI-based layout with collapsible sidebar and header
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
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import {
  ChevronLeft,
  LayoutDashboard,
  FolderKanban,
  Map,
  LogOut,
  Sun,
  Moon,
  Settings,
  Users,
  Shield,
  Key,
  History,
  User,
} from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useAuthStore } from '../../stores/authStore';

const DRAWER_WIDTH = 240;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  children?: NavItem[];
  roles?: string[];
}

// Main navigation items shown in header
const headerNavItems = [
  { label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/admin' },
  { label: 'Projects', icon: <FolderKanban size={18} />, path: '/admin/projects' },
  { label: 'Map', icon: <Map size={18} />, path: '/admin/map' },
];

// Sidebar items (Settings only)
const sidebarItems: NavItem[] = [
  {
    label: 'Settings',
    icon: <Settings size={20} />,
    path: '/admin/settings',
    roles: ['super_admin', 'regional_admin'],
    children: [
      { label: 'Users', icon: <Users size={18} />, path: '/admin/settings/users' },
      { label: 'Groups', icon: <Shield size={18} />, path: '/admin/settings/groups' },
      { label: 'Access Rights', icon: <Key size={18} />, path: '/admin/settings/access-rights' },
      { label: 'Audit Logs', icon: <History size={18} />, path: '/admin/settings/audit-logs', roles: ['super_admin'] },
    ],
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleTheme } = useTheme();
  const { user, logout } = useAuthStore();

  const [drawerOpen, setDrawerOpen] = useState(false); // Collapsed by default
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
    navigate('/login');
  };

  // Get current header tab value
  const getHeaderTabValue = () => {
    if (location.pathname === '/admin') return '/admin';
    if (location.pathname.startsWith('/admin/projects')) return '/admin/projects';
    if (location.pathname.startsWith('/admin/map')) return '/admin/map';
    return false; // No tab selected (e.g., settings pages)
  };

  // Check if user has access to settings
  const hasSettingsAccess = user?.role === 'super_admin' || user?.role === 'regional_admin';

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
          {/* Settings Toggle - only show if user has access */}
          {hasSettingsAccess && (
            <IconButton
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              {drawerOpen ? <ChevronLeft size={24} /> : <Settings size={24} />}
            </IconButton>
          )}

          <Typography variant="h6" fontWeight={600} sx={{ mr: 4 }}>
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
            {headerNavItems.map((item) => (
              <Tab
                key={item.path}
                value={item.path}
                label={item.label}
                icon={item.icon}
                iconPosition="start"
              />
            ))}
          </Tabs>

          {/* Theme Toggle */}
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton onClick={toggleTheme} sx={{ mr: 1 }}>
              {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </IconButton>
          </Tooltip>

          {/* Profile Menu */}
          <Tooltip title="Account">
            <IconButton onClick={handleProfileMenuOpen}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {user?.username}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.role?.replace('_', ' ')}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { handleProfileMenuClose(); navigate('/admin/profile'); }}>
              <ListItemIcon>
                <User size={18} />
              </ListItemIcon>
              <ListItemText>Profile</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogOut size={18} />
              </ListItemIcon>
              <ListItemText>Logout</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer - Only shown for users with settings access */}
      {hasSettingsAccess && (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerOpen ? DRAWER_WIDTH : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerOpen ? DRAWER_WIDTH : 0,
              boxSizing: 'border-box',
              borderRight: drawerOpen ? 1 : 0,
              borderColor: 'divider',
              transition: (theme) =>
                theme.transitions.create('width', {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen,
                }),
              overflowX: 'hidden',
              overflowY: 'auto',
              '&::-webkit-scrollbar': {
                width: 0,
                display: 'none',
              },
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            },
          }}
        >
          <Toolbar /> {/* Spacer for AppBar */}

          <Box sx={{ overflow: 'auto', mt: 1, display: drawerOpen ? 'block' : 'none' }}>
            <Typography
              variant="overline"
              sx={{ px: 3, py: 1, display: 'block', color: 'text.secondary' }}
            >
              Settings
            </Typography>
            <List>
              {sidebarItems[0]?.children
                ?.filter((child) => !child.roles || child.roles.includes(user?.role || ''))
                .map((child) => (
                  <ListItem key={child.path} disablePadding>
                    <ListItemButton
                      onClick={() => navigate(child.path)}
                      selected={location.pathname === child.path}
                      sx={{
                        minHeight: 44,
                        px: 3,
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
                      <ListItemIcon sx={{ minWidth: 0, mr: 2 }}>
                        {child.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={child.label}
                        primaryTypographyProps={{ fontSize: '0.875rem' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
            </List>
          </Box>
        </Drawer>
      )}

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
