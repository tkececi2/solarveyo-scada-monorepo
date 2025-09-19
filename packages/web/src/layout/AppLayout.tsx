import { PropsWithChildren, useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SolarVeyoLogo from '@/components/SolarVeyoLogo';
import NotificationCenter from '@/components/NotificationCenter';

const DRAWER_WIDTH = 280;

const getMenuItems = (isAdmin: boolean, isManager: boolean) => [
  { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
  { label: 'Santrallar', path: '/sites', icon: BusinessIcon },
  { label: 'Raporlar', path: '/reports', icon: TrendingUpIcon },
  ...(isManager ? [{ label: 'Tahminler', path: '/estimates', icon: AssessmentIcon }] : []),
  ...(isAdmin ? [{ label: 'Ekip', path: '/team', icon: PeopleIcon }] : []),
  ...(isManager ? [{ label: 'Santral Ekle', path: '/add-site', icon: AddIcon }] : []),
  ...(isManager ? [{ label: '🔔 Bildirimler', path: '/notifications', icon: NotificationsIcon }] : []),
  ...(isAdmin ? [{ label: 'Ayarlar', path: '/settings', icon: SettingsIcon }] : []),
];

export default function AppLayout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, isManager } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const drawer = (
    <Box>
      <Toolbar sx={{ px: 2 }}>
        <SolarVeyoLogo />
      </Toolbar>
      <List sx={{ px: 2 }}>
        {getMenuItems(isAdmin, isManager).map((item) => {
          const active = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
          const Icon = item.icon;
          
          return (
            <ListItemButton
              key={item.path}
              onClick={() => {
                navigate(item.path);
                if (isMobile) setMobileOpen(false);
              }}
              sx={{
                my: 0.5,
                borderRadius: 2,
                ...(active && {
                  bgcolor: 'primary.main',
                  color: 'common.white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '& .MuiListItemIcon-root': { color: 'common.white' },
                }),
              }}
            >
              <ListItemIcon>
                <Icon />
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
      
      {/* User Section */}
      <Box sx={{ position: 'absolute', bottom: 0, width: '100%', p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {user?.email}
            </Typography>
          </Box>
          <IconButton
            onClick={handleLogout}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <LogoutIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        color="default"
        elevation={1}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          color: 'text.primary',
          bgcolor: 'background.paper',
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
            SolarVeyo - SCADA Monitoring
          </Typography>
          
          {/* Bildirim Merkezi */}
          <NotificationCenter />
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
        
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

