import React, { useState, useEffect } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Box,
  IconButton,
  Slide,
  Stack,
  Typography,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { NotificationAlert } from '../types';
import { NotificationService } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';

interface InAppNotificationProps {
  alert: NotificationAlert;
  onClose: () => void;
  onAcknowledge: () => void;
}

const InAppNotificationItem: React.FC<InAppNotificationProps> = ({
  alert,
  onClose,
  onAcknowledge,
}) => {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <ErrorIcon />;
      case 'warning': return <WarningIcon />;
      default: return <InfoIcon />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  return (
    <Alert
      severity={getSeverityColor(alert.severity) as any}
      onClose={onClose}
      sx={{
        width: '100%',
        boxShadow: 3,
        '& .MuiAlert-message': { width: '100%' },
      }}
      action={
        <Stack direction="row" spacing={1}>
          {!alert.acknowledged && (
            <IconButton
              size="small"
              onClick={onAcknowledge}
              sx={{ color: 'inherit' }}
            >
              <CheckCircleIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      }
    >
      <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {getSeverityIcon(alert.severity)}
        {alert.title}
        <Chip
          size="small"
          label={alert.severity}
          color={getSeverityColor(alert.severity) as any}
          variant="outlined"
        />
      </AlertTitle>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {alert.message}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {alert.siteName} • {alert.deviceName} • {alert.timestamp?.toLocaleString()}
      </Typography>
    </Alert>
  );
};

const InAppNotificationSystem: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationAlert[]>([]);
  const [currentNotification, setCurrentNotification] = useState<NotificationAlert | null>(null);

  useEffect(() => {
    if (!user) return;

    // Gerçek zamanlı bildirim dinleyicisi
    const unsubscribe = NotificationService.subscribeToUserAlerts(
      user.uid,
      user.role || 'viewer',
      user.assignedSites || [],
      (alerts: NotificationAlert[]) => {
        // Sadece yeni ve okunmamış bildirimleri göster
        const newAlerts = alerts.filter((alert: NotificationAlert) => 
          !alert.acknowledged && 
          alert.timestamp && 
          Date.now() - alert.timestamp.getTime() < 30000 // Son 30 saniye
        );

        if (newAlerts.length > 0) {
          setNotifications(newAlerts);
          setCurrentNotification(newAlerts[0]);
          
          // Ses çal (iOS'ta çalışabilir)
          try {
            const audio = new Audio('/notification-sound.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {
              // Ses çalamazsa vibration dene
              if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
              }
            });
          } catch (error) {
            console.log('Audio/vibration failed:', error);
          }
        }
      }
    );

    return unsubscribe;
  }, [user]);

  const handleClose = () => {
    setCurrentNotification(null);
    if (notifications.length > 1) {
      // Sıradaki bildirimi göster
      const nextNotifications = notifications.slice(1);
      setNotifications(nextNotifications);
      setTimeout(() => {
        setCurrentNotification(nextNotifications[0] || null);
      }, 500);
    } else {
      setNotifications([]);
    }
  };

  const handleAcknowledge = async () => {
    if (!currentNotification || !user) return;

    try {
      await NotificationService.acknowledgeAlert(currentNotification.id, user.uid);
      handleClose();
    } catch (error) {
      console.error('Bildirim onaylanırken hata:', error);
    }
  };

  if (!currentNotification) return null;

  return (
    <Snackbar
      open={!!currentNotification}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ 
        top: { xs: 80, sm: 24 },
        width: { xs: '95%', sm: 400 },
        maxWidth: '95vw',
      }}
      TransitionComponent={Slide}
      TransitionProps={{ direction: 'down' } as any}
    >
      <Box>
        <InAppNotificationItem
          alert={currentNotification}
          onClose={handleClose}
          onAcknowledge={handleAcknowledge}
        />
        {notifications.length > 1 && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              mt: 1,
              color: 'text.secondary',
              bgcolor: 'background.paper',
              p: 0.5,
              borderRadius: 1,
            }}
          >
            +{notifications.length - 1} bildirim daha
          </Typography>
        )}
      </Box>
    </Snackbar>
  );
};

export default InAppNotificationSystem;
