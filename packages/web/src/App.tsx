import { useRoutes } from 'react-router-dom';
import { useEffect } from 'react';
import { routes } from './router/routes';
import AppLayout from './layout/AppLayout';
import AuthWrapper from './components/AuthWrapper';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider, useToast, setGlobalToast } from './components/ToastNotification';
import { errorHandler } from './utils/errorHandler';
import { logger } from './utils/productionLogger';

function AppContent() {
  const element = useRoutes(routes);
  const toast = useToast();
  
  useEffect(() => {
    // Global toast setter
    setGlobalToast(toast);
    
    // Global error handler setup
    const unsubscribe = errorHandler.onError((error, severity) => {
      switch (severity) {
        case 'critical':
          toast.showError(error.message, 'Kritik Hata');
          break;
        case 'error':
          toast.showError(error.message);
          break;
        case 'warning':
          toast.showWarning(error.message);
          break;
        case 'info':
          toast.showInfo(error.message);
          break;
      }
    });
    
    logger.info('Application initialized');
    
    return () => {
      unsubscribe();
    };
  }, [toast]);
  
  return (
    <AuthProvider>
      <AuthWrapper>
        <AppLayout>
          {element}
        </AppLayout>
      </AuthWrapper>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
}
