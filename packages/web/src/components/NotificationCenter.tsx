import React, { useState, useEffect } from 'react';
import {
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Box,
  Button,
  Chip,
  Divider,
  Stack,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  DeleteSweep as DeleteSweepIcon,
} from '@mui/icons-material';
import { NotificationAlert } from '../types';
import { NotificationService } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [alerts, setAlerts] = useState<NotificationAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    console.log('🔔 NotificationCenter: Subscribing to alerts for user:', user.uid);
    
    // Gerçek zamanlı bildirim dinleyicisi - role ve site bazlı
    const unsubscribe = NotificationService.subscribeToUserAlerts(
      user.uid, 
      user.role || 'viewer',
      user.assignedSites || [],
      (newAlerts) => {
        console.log('🔔 NotificationCenter: Received alerts:', newAlerts.length);
        setAlerts(newAlerts);
        const unread = newAlerts.filter(alert => !alert.acknowledged).length;
        setUnreadCount(unread);
        console.log('🔔 NotificationCenter: Unread count:', unread);
      }
    );

    return unsubscribe;
  }, [user]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAcknowledge = async (alertId: string) => {
    if (!user) return;
    
    try {
      await NotificationService.acknowledgeAlert(alertId, user.uid);
    } catch (error) {
      console.error('Uyarı onaylanırken hata:', error);
    }
  };

  const handleDeleteAll = async () => {
    if (!user) return;
    
    if (!window.confirm('Tüm bildirimleri silmek istediğinizden emin misiniz?')) {
      return;
    }
    
    try {
      await NotificationService.deleteAllUserAlerts(user.uid);
      toast.success('Tüm bildirimler silindi');
      setAlerts([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Bildirimler silinirken hata:', error);
      toast.error('Bildirimler silinemedi');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton color="inherit" onClick={handleClick}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { width: 400, maxHeight: 500 }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Bildirimler ({unreadCount} okunmamış)
            </Typography>
            {alerts.length > 0 && (
              <Button
                size="small"
                color="error"
                startIcon={<DeleteSweepIcon />}
                onClick={handleDeleteAll}
                sx={{ minWidth: 'auto' }}
              >
                Tümünü Sil
              </Button>
            )}
          </Stack>
          
          {alerts.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              Bildirim bulunmuyor
            </Typography>
          ) : (
            <List sx={{ maxHeight: 350, overflow: 'auto' }}>
              {alerts.map((alert, index) => (
                <React.Fragment key={alert.id}>
                  <ListItem
                    sx={{
                      bgcolor: alert.acknowledged ? 'transparent' : 'action.hover',
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'transparent' }}>
                        {getSeverityIcon(alert.severity)}
                      </Avatar>
                    </ListItemAvatar>
                    
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {alert.title}
                          </Typography>
                          <Chip 
                            size="small" 
                            label={alert.severity} 
                            color={getSeverityColor(alert.severity) as any}
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography component="span" variant="body2" color="text.secondary" display="block">
                            {alert.message}
                          </Typography>
                          <Typography component="span" variant="caption" color="text.secondary" display="block">
                            {alert.siteName} • {alert.deviceName}
                          </Typography>
                          <Typography component="span" variant="caption" color="text.secondary" display="block">
                            {alert.timestamp?.toLocaleString()}
                          </Typography>
                          
                          {!alert.acknowledged && (
                            <Box component="span" sx={{ mt: 1, display: 'block' }}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<CheckCircleIcon />}
                                onClick={() => handleAcknowledge(alert.id)}
                              >
                                Onayla
                              </Button>
                            </Box>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                  
                  {index < alerts.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
};

export default NotificationCenter;
