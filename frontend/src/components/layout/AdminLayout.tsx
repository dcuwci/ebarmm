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
  Menu as MenuIcon,
  ChevronLeft,
  LayoutDashboard,
  FolderKanban,
  Map,
  LogOut,
  Sun,
  Moon,
  Users,
  Shield,
  Key,
  History,
  User,
} from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useAuthStore } from '../../stores/authStore';

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  children?: NavItem[];
  roles?: string[];
}

// Main navigation items shown in header and sidebar
const mainNavItems = [
  { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/admin' },
  { label: 'Projects', icon: <FolderKanban size={20} />, path: '/admin/projects' },
  { label: 'Map', icon: <Map size={20} />, path: '/admin/map' },
];

// Settings items (admin only)
const settingsItems: NavItem[] = [
  { label: 'Users', icon: <Users size={20} />, path: '/admin/settings/users' },
  { label: 'Groups', icon: <Shield size={20} />, path: '/admin/settings/groups' },
  { label: 'Access Rights', icon: <Key size={20} />, path: '/admin/settings/access-rights' },
  { label: 'Audit Logs', icon: <History size={20} />, path: '/admin/settings/audit-logs', roles: ['super_admin'] },
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

  // Check if path is active
  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  // Check if user has access to settings
  const hasSettingsAccess = user?.role === 'super_admin' || user?.role === 'regional_admin';

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

          {/* Settings Section - Only for admins */}
          {hasSettingsAccess && (
            <>
              <Divider sx={{ my: 1 }} />
              {drawerOpen && (
                <Typography
                  variant="overline"
                  sx={{ px: 3, py: 1, display: 'block', color: 'text.secondary' }}
                >
                  Settings
                </Typography>
              )}
              <List>
                {settingsItems
                  .filter((item) => !item.roles || item.roles.includes(user?.role || ''))
                  .map((item) => (
                    <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
                      <Tooltip title={!drawerOpen ? item.label : ''} placement="right">
                        <ListItemButton
                          onClick={() => navigate(item.path)}
                          selected={location.pathname === item.path}
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
            </>
          )}
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
