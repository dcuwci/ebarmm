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
import Collapse from '@mui/material/Collapse';
import {
  Menu as MenuIcon,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
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
const DRAWER_WIDTH_COLLAPSED = 64;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  children?: NavItem[];
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/admin' },
  { label: 'Projects', icon: <FolderKanban size={20} />, path: '/admin/projects' },
  { label: 'Map View', icon: <Map size={20} />, path: '/admin/map' },
  {
    label: 'Settings',
    icon: <Settings size={20} />,
    path: '/admin/settings',
    roles: ['super_admin', 'regional_admin'],
    children: [
      { label: 'Users', icon: <Users size={18} />, path: '/admin/settings/users' },
      { label: 'Groups', icon: <Shield size={18} />, path: '/admin/settings/groups' },
      { label: 'Access Rights', icon: <Key size={18} />, path: '/admin/settings/access-rights' },
      { label: 'Audit Logs', icon: <History size={18} />, path: '/admin/settings/audit-logs' },
    ],
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleTheme } = useTheme();
  const { user, logout } = useAuthStore();

  const [drawerOpen, setDrawerOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const handleSettingsClick = () => {
    if (drawerOpen) {
      setSettingsOpen(!settingsOpen);
    } else {
      navigate('/admin/settings/users');
    }
  };

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
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
          <IconButton
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            {drawerOpen ? <ChevronLeft size={24} /> : <MenuIcon size={24} />}
          </IconButton>

          <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1 }}>
            E-BARMM
          </Typography>

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

        <Box sx={{ overflow: 'auto', mt: 1 }}>
          <List>
            {navItems.map((item) => {
              // Skip Settings if user doesn't have access
              if (item.roles && !item.roles.includes(user?.role || '')) {
                return null;
              }

              // Handle items with children (Settings submenu)
              if (item.children) {
                return (
                  <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
                    <ListItemButton
                      onClick={handleSettingsClick}
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
                      {drawerOpen && (
                        settingsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                      )}
                    </ListItemButton>
                    <Collapse in={settingsOpen && drawerOpen} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        {item.children.map((child) => (
                          <ListItemButton
                            key={child.path}
                            onClick={() => navigate(child.path)}
                            selected={location.pathname === child.path}
                            sx={{
                              minHeight: 40,
                              pl: 4,
                              mx: 1,
                              borderRadius: 1,
                              '&.Mui-selected': {
                                bgcolor: 'action.selected',
                                '&:hover': {
                                  bgcolor: 'action.hover',
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
                        ))}
                      </List>
                    </Collapse>
                  </ListItem>
                );
              }

              // Regular nav items
              return (
                <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
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
                </ListItem>
              );
            })}
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
