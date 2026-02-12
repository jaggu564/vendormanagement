import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Container,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Description as RFPIcon,
  Assignment as ContractIcon,
  ShoppingCart as ProcurementIcon,
  Assessment as PerformanceIcon,
  Warning as RiskIcon,
  Analytics as AnalyticsIcon,
  Support as HelpdeskIcon,
  Poll as SurveyIcon,
  Settings as AdminIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const drawerWidth = 240;

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { path: '/rfp', label: 'modules.rfp', icon: RFPIcon },
  { path: '/contracts', label: 'modules.contracts', icon: ContractIcon },
  { path: '/procurement', label: 'modules.procurement', icon: ProcurementIcon },
  { path: '/performance', label: 'modules.performance', icon: PerformanceIcon },
  { path: '/risk', label: 'modules.risk', icon: RiskIcon },
  { path: '/analytics', label: 'modules.analytics', icon: AnalyticsIcon },
  { path: '/helpdesk', label: 'modules.helpdesk', icon: HelpdeskIcon },
  { path: '/surveys', label: 'modules.surveys', icon: SurveyIcon },
  { path: '/admin', label: 'modules.admin', icon: AdminIcon },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Vendor Management Platform
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.first_name} {user?.last_name}
          </Typography>
          <Typography
  variant="body2"
  component="button"
  onClick={handleLogout}
  sx={{
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    color: 'inherit',
    textDecoration: 'underline',
    '&:focus-visible': {
      outline: '2px solid white',
      outlineOffset: '2px',
    },
  }}
>
  {t('auth.logout')}
</Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <ListItem key={item.path} disablePadding>
                  <ListItemButton
                    selected={isActive}
                    onClick={() => navigate(item.path)}
                    sx={{
                      '&.Mui-selected': {
                        backgroundColor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': {
                          backgroundColor: 'primary.dark',
                        },
                      },
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: '-2px',
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: isActive ? 'primary.contrastText' : 'inherit',
                      }}
                    >
                      <Icon />
                    </ListItemIcon>
                    <ListItemText primary={t(item.label)} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Container maxWidth="xl">
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
