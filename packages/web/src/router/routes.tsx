import { RouteObject } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import Reports from '../pages/Reports';
import Sites from '../pages/Sites';
import SiteDetail from '../pages/SiteDetail';
import AddSite from '../pages/AddSite';
import EditSite from '../pages/EditSite';
import Settings from '../pages/Settings';
import Team from '../pages/Team';
import ProductionEstimates from '../pages/ProductionEstimates';
import NotificationSettings from '../pages/NotificationSettings';

export const routes: RouteObject[] = [
  { path: '/', element: <Dashboard /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/sites', element: <Sites /> },
  { path: '/sites/:id', element: <SiteDetail /> },
  { path: '/sites/:id/edit', element: <EditSite /> },
  { path: '/add-site', element: <AddSite /> },
  { path: '/reports', element: <Reports /> },
  { path: '/estimates', element: <ProductionEstimates /> },
  { path: '/team', element: <Team /> },
  { path: '/notifications', element: <NotificationSettings /> },
  { path: '/settings', element: <Settings /> },
];

