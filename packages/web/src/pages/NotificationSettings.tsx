import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Slider,
  TextField,
  Button,
  Alert,
  Divider,
  Grid,
  Chip,
  FormGroup,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Stack,
  useTheme,
  useMediaQuery,
  Collapse,
  Badge,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  VolumeUp as VolumeUpIcon,
  Email as EmailIcon,
  Thermostat as ThermostatIcon,
  ElectricBolt as ElectricBoltIcon,
  SolarPower as SolarPowerIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  BugReport as BugReportIcon,
  Done as DoneIcon,
  DoneAll as DoneAllIcon,
  Delete as DeleteIcon,
  DeleteSweep as DeleteSweepIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  NotificationsActive as NotificationsActiveIcon,
  NotificationsOff as NotificationsOffIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { NotificationSettings, NotificationAlert } from '../types';
import { NotificationService } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

const NotificationSettingsPage: React.FC = () => {
  const { user, isManager, isAdmin, isViewer } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // GÜVENLİK KONTROLÜ: Viewer'lar bu sayfaya erişemez
  if (isViewer) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            🔒 Erişim Reddedildi
          </Typography>
          <Typography>
            Bildirim ayarları sadece yöneticiler tarafından yapılandırılabilir. 
            Bu sayfa için yetkiniz bulunmamaktadır.
          </Typography>
        </Alert>
      </Box>
    );
  }
  
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<NotificationAlert[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  
  // Collapsible sections for mobile
  const [expandedSections, setExpandedSections] = useState({
    alerts: true,
    inverter: true,
    pvString: false,
    temperature: false,
    methods: false,
  });

  useEffect(() => {
    loadSettings();
    loadRecentAlerts();
    checkNotificationPermission();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    
    // GÜVENLİK KONTROLÜ: Sadece admin/manager ayarlara erişebilir
    if (!isManager) {
      toast.error('🔒 Bu sayfa için yetkiniz bulunmamaktadır');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      let userSettings = await NotificationService.getUserNotificationSettings(user.uid);
      
      // SADECE MANAGER/ADMIN İÇİN varsayılan ayar oluştur
      if (!userSettings && isManager) {
        console.log('🔧 Admin/Manager için varsayılan bildirim ayarları oluşturuluyor...');
        userSettings = await NotificationService.createDefaultSettings(
          user.uid, 
          user.assignedSites || []
        );
        toast.success('✅ Bildirim ayarları oluşturuldu');
      }
      
      setSettings(userSettings);
    } catch (error) {
      console.error('Ayarlar yüklenirken hata:', error);
      toast.error('Ayarlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentAlerts = async () => {
    if (!user) return;
    
    try {
      const alerts = await NotificationService.getUserActiveAlerts(user.uid);
      setRecentAlerts(alerts.slice(0, 5)); // Son 5 aktif uyarı
    } catch (error) {
      console.error('Uyarılar yüklenirken hata:', error);
    }
  };

  const checkNotificationPermission = async () => {
    const permission = await NotificationService.requestNotificationPermission();
    setHasPermission(permission);
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    if (!user) return;
    
    try {
      await NotificationService.acknowledgeAlert(alertId, user.uid);
      toast.success('Bildirim okundu olarak işaretlendi');
      await loadRecentAlerts();
    } catch (error) {
      console.error('Bildirim onaylanırken hata:', error);
      toast.error('Bildirim onaylanamadı');
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    if (!user) return;
    
    try {
      await NotificationService.resolveAlert(alertId, false);
      toast.success('Bildirim çözümlendi');
      await loadRecentAlerts();
    } catch (error) {
      console.error('Bildirim çözümlenirken hata:', error);
      toast.error('Bildirim çözümlenemedi');
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!user) return;
    
    if (!window.confirm('Bu bildirimi silmek istediğinizden emin misiniz?')) {
      return;
    }
    
    try {
      await NotificationService.deleteAlert(alertId);
      toast.success('Bildirim silindi');
      await loadRecentAlerts();
    } catch (error) {
      console.error('Bildirim silinirken hata:', error);
      toast.error('Bildirim silinemedi');
    }
  };

  const handleDeleteAllAlerts = async () => {
    if (!user) return;
    
    if (!window.confirm('Tüm bildirimleri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
      return;
    }
    
    try {
      await NotificationService.deleteAllUserAlerts(user.uid);
      toast.success('Tüm bildirimler silindi');
      setRecentAlerts([]);
    } catch (error) {
      console.error('Tüm bildirimler silinirken hata:', error);
      toast.error('Bildirimler silinemedi');
    }
  };

  const handleSave = async () => {
    if (!settings || !user) return;
    
    // GÜVENLİK KONTROLÜ: Sadece admin/manager kaydedebilir
    if (!isManager) {
      toast.error('🔒 Bildirim ayarlarını değiştirme yetkiniz bulunmamaktadır');
      return;
    }
    
    try {
      setSaving(true);
      await NotificationService.saveNotificationSettings(settings);
      toast.success('✅ Ayarlar başarıyla kaydedildi');
      console.log('🔧 Bildirim ayarları güncellendi by:', user.role, user.email);
    } catch (error) {
      console.error('Ayarlar kaydedilirken hata:', error);
      toast.error('❌ Ayarlar kaydedilemedi: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSettingChange = (path: string, value: any) => {
    if (!settings) return;
    
    const newSettings = { ...settings };
    const keys = path.split('.');
    let current: any = newSettings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setSettings(newSettings);
  };

  const handleTestNotification = async () => {
    if (!user) return;
    
    try {
      await NotificationService.createAlert({
        userId: user.uid,
        siteId: 'test-site',
        siteName: 'Test Santralı',
        type: 'inverter',
        severity: 'warning',
        title: 'Test Bildirimi',
        message: 'Bu bir test bildirimidir. Bildirim sistemi düzgün çalışıyor.',
        deviceId: 'test-inverter-1',
        deviceName: 'Test İnvertör #1',
        acknowledged: false,
      });
      
      toast.success('Test bildirimi gönderildi!');
      await loadRecentAlerts();
    } catch (error) {
      console.error('Test bildirimi gönderilirken hata:', error);
      toast.error('Test bildirimi gönderilemedi');
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <ErrorIcon fontSize="small" />;
      case 'warning': return <WarningIcon fontSize="small" />;
      default: return <CheckCircleIcon fontSize="small" />;
    }
  };

  if (loading || !settings) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <LinearProgress />
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Typography>Ayarlar yükleniyor...</Typography>
        </Box>
      </Box>
    );
  }

  const getUnreadCount = () => recentAlerts.filter(a => !a.acknowledged).length;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 2, sm: 3 }, 
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.primary.main}05 100%)`,
          borderRadius: 2,
        }}
      >
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={2} 
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant={isMobile ? "h5" : "h4"} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationsIcon sx={{ fontSize: { xs: 28, sm: 32 } }} />
              Bildirim Merkezi
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tüm bildirim ayarlarınızı buradan yönetebilirsiniz
            </Typography>
          </Box>
          
          <Stack direction="row" spacing={1}>
            <Chip 
              icon={hasPermission ? <NotificationsActiveIcon /> : <NotificationsOffIcon />}
              label={hasPermission ? "Bildirimler Açık" : "Bildirimler Kapalı"}
              color={hasPermission ? "success" : "default"}
              variant={hasPermission ? "filled" : "outlined"}
            />
            {getUnreadCount() > 0 && (
              <Chip 
                icon={<Badge badgeContent={getUnreadCount()} color="error"><HistoryIcon /></Badge>}
                label="Okunmamış"
                color="error"
                variant="outlined"
              />
            )}
          </Stack>
        </Stack>
      </Paper>

      {!hasPermission && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button 
              color="inherit" 
              size="small"
              onClick={checkNotificationPermission}
            >
              İzin Ver
            </Button>
          }
        >
          Tarayıcı bildirimleri için izin verilmemiş. Bildirimleri etkinleştirmek için izin verin.
        </Alert>
      )}

      {saving && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        {/* Aktif Uyarılar - Mobilde üstte */}
        <Grid item xs={12} md={5} lg={4} order={{ xs: 1, md: 2 }}>
          <Card sx={{ height: '100%', borderRadius: 2, overflow: 'visible' }}>
            <CardContent>
              <Stack 
                direction="row" 
                justifyContent="space-between" 
                alignItems="center" 
                mb={2}
              >
                <Box
                  onClick={() => isMobile && toggleSection('alerts')}
                  sx={{ 
                    cursor: isMobile ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Badge badgeContent={recentAlerts.length} color="primary">
                      <HistoryIcon />
                    </Badge>
                    Aktif Uyarılar
                  </Typography>
                  {isMobile && (
                    <IconButton size="small">
                      {expandedSections.alerts ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )}
                </Box>
                {recentAlerts.length > 0 && (
                  <Tooltip title="Tüm bildirimleri sil">
                    <IconButton 
                      size="small" 
                      color="error"
                      onClick={handleDeleteAllAlerts}
                      sx={{ 
                        bgcolor: 'error.main',
                        color: 'white',
                        '&:hover': { 
                          bgcolor: 'error.dark',
                          transform: 'scale(1.1)',
                        },
                        transition: 'all 0.2s',
                      }}
                    >
                      <DeleteSweepIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
              
              <Collapse in={!isMobile || expandedSections.alerts}>
                {recentAlerts.length === 0 ? (
                  <Paper 
                    sx={{ 
                      p: 3, 
                      textAlign: 'center',
                      bgcolor: 'background.default',
                      borderRadius: 2,
                    }}
                  >
                    <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                    <Typography color="text.secondary">
                      Aktif uyarı bulunmuyor
                    </Typography>
                  </Paper>
                ) : (
                  <List sx={{ p: 0 }}>
                    {recentAlerts.map((alert, index) => (
                      <React.Fragment key={alert.id}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            mb: 1,
                            bgcolor: alert.acknowledged ? 'background.default' : 'action.hover',
                            borderLeft: `4px solid ${theme.palette[getSeverityColor(alert.severity) as 'error' | 'warning' | 'info'].main}`,
                            borderRadius: 1,
                            transition: 'all 0.3s',
                            '&:hover': {
                              transform: 'translateX(4px)',
                              boxShadow: 1,
                            }
                          }}
                        >
                          <Stack spacing={1}>
                            <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1 }}>
                                {getSeverityIcon(alert.severity)}
                                <Box flex={1}>
                                  <Typography variant="subtitle2" fontWeight="bold">
                                    {alert.title}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {alert.message}
                                  </Typography>
                                  <Stack direction="row" spacing={0.5} mt={0.5} flexWrap="wrap">
                                    <Chip 
                                      size="small" 
                                      label={alert.severity} 
                                      color={getSeverityColor(alert.severity) as any}
                                      sx={{ height: 20 }}
                                    />
                                    <Chip 
                                      size="small" 
                                      label={alert.siteName} 
                                      variant="outlined"
                                      sx={{ height: 20 }}
                                    />
                                    {alert.deviceName && (
                                      <Chip 
                                        size="small" 
                                        label={alert.deviceName} 
                                        variant="outlined"
                                        sx={{ height: 20 }}
                                      />
                                    )}
                                  </Stack>
                                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                                    {alert.timestamp?.toLocaleString()}
                                  </Typography>
                                </Box>
                              </Box>
                            </Stack>
                            
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              {!alert.acknowledged && alert.id && (
                                <Tooltip title="Okundu olarak işaretle">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleAcknowledgeAlert(alert.id)}
                                    color="primary"
                                    sx={{ 
                                      bgcolor: 'primary.main',
                                      color: 'white',
                                      '&:hover': { bgcolor: 'primary.dark' }
                                    }}
                                  >
                                    <DoneIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {alert.id && (
                                <Tooltip title="Çözümlendi">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleResolveAlert(alert.id)}
                                    color="success"
                                    sx={{ 
                                      bgcolor: 'success.main',
                                      color: 'white',
                                      '&:hover': { bgcolor: 'success.dark' }
                                    }}
                                  >
                                    <DoneAllIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {alert.id && (
                                <Tooltip title="Sil">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleDeleteAlert(alert.id)}
                                    color="error"
                                    sx={{ 
                                      bgcolor: 'error.main',
                                      color: 'white',
                                      '&:hover': { bgcolor: 'error.dark' }
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </Stack>
                        </Paper>
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Collapse>
            </CardContent>
          </Card>
        </Grid>

        {/* Ayarlar */}
        <Grid item xs={12} md={7} lg={8} order={{ xs: 2, md: 1 }}>
          <Stack spacing={3}>
            {/* İnvertör Uyarıları */}
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack 
                  direction="row" 
                  justifyContent="space-between" 
                  alignItems="center"
                  onClick={() => isMobile && toggleSection('inverter')}
                  sx={{ cursor: isMobile ? 'pointer' : 'default', mb: 2 }}
                >
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ElectricBoltIcon color="primary" />
                    İnvertör Uyarıları
                  </Typography>
                  {isMobile && (
                    <IconButton size="small">
                      {expandedSections.inverter ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )}
                </Stack>
                
                <Collapse in={!isMobile || expandedSections.inverter}>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.inverterAlerts.enabled}
                          onChange={(e) => handleSettingChange('inverterAlerts.enabled', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Typography variant="body1" fontWeight={settings.inverterAlerts.enabled ? 'bold' : 'normal'}>
                          İnvertör uyarılarını etkinleştir
                        </Typography>
                      }
                    />
                    
                    {settings.inverterAlerts.enabled && (
                      <Paper sx={{ p: 2, mt: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={4}>
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={settings.inverterAlerts.offlineAlert}
                                  onChange={(e) => handleSettingChange('inverterAlerts.offlineAlert', e.target.checked)}
                                />
                              }
                              label="Çevrimdışı"
                            />
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={settings.inverterAlerts.faultAlert}
                                  onChange={(e) => handleSettingChange('inverterAlerts.faultAlert', e.target.checked)}
                                />
                              }
                              label="Arıza"
                            />
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={settings.inverterAlerts.alarmAlert}
                                  onChange={(e) => handleSettingChange('inverterAlerts.alarmAlert', e.target.checked)}
                                />
                              }
                              label="Alarm"
                            />
                          </Grid>
                        </Grid>
                      </Paper>
                    )}
                  </FormGroup>
                </Collapse>
              </CardContent>
            </Card>

            {/* PV String Uyarıları */}
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack 
                  direction="row" 
                  justifyContent="space-between" 
                  alignItems="center"
                  onClick={() => isMobile && toggleSection('pvString')}
                  sx={{ cursor: isMobile ? 'pointer' : 'default', mb: 2 }}
                >
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SolarPowerIcon color="warning" />
                    PV String Uyarıları
                  </Typography>
                  {isMobile && (
                    <IconButton size="small">
                      {expandedSections.pvString ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )}
                </Stack>
                
                <Collapse in={!isMobile || expandedSections.pvString}>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.pvStringAlerts.enabled}
                          onChange={(e) => handleSettingChange('pvStringAlerts.enabled', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Typography variant="body1" fontWeight={settings.pvStringAlerts.enabled ? 'bold' : 'normal'}>
                          PV String uyarılarını etkinleştir
                        </Typography>
                      }
                    />
                    
                    {settings.pvStringAlerts.enabled && (
                      <Paper sx={{ p: 2, mt: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={4}>
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={settings.pvStringAlerts.lowPerformanceAlert}
                                  onChange={(e) => handleSettingChange('pvStringAlerts.lowPerformanceAlert', e.target.checked)}
                                />
                              }
                              label="Düşük performans"
                            />
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={settings.pvStringAlerts.faultAlert}
                                  onChange={(e) => handleSettingChange('pvStringAlerts.faultAlert', e.target.checked)}
                                />
                              }
                              label="Arıza"
                            />
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={settings.pvStringAlerts.offlineAlert}
                                  onChange={(e) => handleSettingChange('pvStringAlerts.offlineAlert', e.target.checked)}
                                />
                              }
                              label="Çevrimdışı"
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <Box>
                              <Typography gutterBottom variant="body2">
                                Performans Eşik Değeri: <strong>%{settings.pvStringAlerts.performanceThreshold}</strong>
                              </Typography>
                              <Slider
                                value={settings.pvStringAlerts.performanceThreshold}
                                onChange={(_, value) => handleSettingChange('pvStringAlerts.performanceThreshold', value)}
                                min={50}
                                max={95}
                                step={5}
                                marks={[
                                  { value: 50, label: '%50' },
                                  { value: 70, label: '%70' },
                                  { value: 90, label: '%90' },
                                ]}
                                valueLabelDisplay="auto"
                                color="warning"
                              />
                            </Box>
                          </Grid>
                        </Grid>
                      </Paper>
                    )}
                  </FormGroup>
                </Collapse>
              </CardContent>
            </Card>

            {/* Sıcaklık Uyarıları */}
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack 
                  direction="row" 
                  justifyContent="space-between" 
                  alignItems="center"
                  onClick={() => isMobile && toggleSection('temperature')}
                  sx={{ cursor: isMobile ? 'pointer' : 'default', mb: 2 }}
                >
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ThermostatIcon color="error" />
                    Sıcaklık Uyarıları
                  </Typography>
                  {isMobile && (
                    <IconButton size="small">
                      {expandedSections.temperature ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )}
                </Stack>
                
                <Collapse in={!isMobile || expandedSections.temperature}>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.temperatureAlerts.enabled}
                          onChange={(e) => handleSettingChange('temperatureAlerts.enabled', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Typography variant="body1" fontWeight={settings.temperatureAlerts.enabled ? 'bold' : 'normal'}>
                          Sıcaklık uyarılarını etkinleştir
                        </Typography>
                      }
                    />
                    
                    {settings.temperatureAlerts.enabled && (
                      <Paper sx={{ p: 2, mt: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="Yüksek Sıcaklık Eşiği (°C)"
                              type="number"
                              size="small"
                              value={settings.temperatureAlerts.highTempThreshold}
                              onChange={(e) => handleSettingChange('temperatureAlerts.highTempThreshold', Number(e.target.value))}
                              inputProps={{ min: 40, max: 100 }}
                              InputProps={{
                                startAdornment: <ThermostatIcon fontSize="small" sx={{ mr: 1, color: 'warning.main' }} />,
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="Kritik Sıcaklık Eşiği (°C)"
                              type="number"
                              size="small"
                              value={settings.temperatureAlerts.criticalTempThreshold}
                              onChange={(e) => handleSettingChange('temperatureAlerts.criticalTempThreshold', Number(e.target.value))}
                              inputProps={{ min: 50, max: 120 }}
                              InputProps={{
                                startAdornment: <ThermostatIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} />,
                              }}
                            />
                          </Grid>
                        </Grid>
                      </Paper>
                    )}
                  </FormGroup>
                </Collapse>
              </CardContent>
            </Card>

            {/* Bildirim Yöntemleri */}
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack 
                  direction="row" 
                  justifyContent="space-between" 
                  alignItems="center"
                  onClick={() => isMobile && toggleSection('methods')}
                  sx={{ cursor: isMobile ? 'pointer' : 'default', mb: 2 }}
                >
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SettingsIcon color="secondary" />
                    Bildirim Yöntemleri
                  </Typography>
                  {isMobile && (
                    <IconButton size="small">
                      {expandedSections.methods ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )}
                </Stack>
                
                <Collapse in={!isMobile || expandedSections.methods}>
                  <Stack spacing={2}>
                    <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.notificationMethods.browser}
                            onChange={(e) => handleSettingChange('notificationMethods.browser', e.target.checked)}
                            color="primary"
                          />
                        }
                        label={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <NotificationsIcon color="primary" />
                            <Box>
                              <Typography variant="body1">Tarayıcı bildirimleri</Typography>
                              <Typography variant="caption" color="text.secondary">
                                Masaüstü ve mobil bildirimler
                              </Typography>
                            </Box>
                          </Stack>
                        }
                      />
                    </Paper>
                    
                    <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.notificationMethods.sound}
                            onChange={(e) => handleSettingChange('notificationMethods.sound', e.target.checked)}
                            color="primary"
                          />
                        }
                        label={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <VolumeUpIcon color="primary" />
                            <Box>
                              <Typography variant="body1">Ses uyarıları</Typography>
                              <Typography variant="caption" color="text.secondary">
                                Kritik uyarılarda ses çal
                              </Typography>
                            </Box>
                          </Stack>
                        }
                      />
                    </Paper>
                    
                    <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, opacity: 0.6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.notificationMethods.email}
                            onChange={(e) => handleSettingChange('notificationMethods.email', e.target.checked)}
                            disabled
                          />
                        }
                        label={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <EmailIcon />
                            <Box>
                              <Typography variant="body1">E-posta bildirimleri</Typography>
                              <Typography variant="caption" color="text.secondary">
                                Yakında eklenecek
                              </Typography>
                            </Box>
                          </Stack>
                        }
                        disabled
                      />
                    </Paper>
                  </Stack>
                </Collapse>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Box>
              <Stack 
                direction={{ xs: 'column', sm: 'row' }} 
                spacing={2} 
                justifyContent="flex-end"
              >
                <Button
                  variant="outlined"
                  color="info"
                  onClick={handleTestNotification}
                  startIcon={<BugReportIcon />}
                  disabled={saving}
                  fullWidth={isMobile}
                >
                  Test Bildirimi
                </Button>
                <Button
                  variant="outlined"
                  onClick={loadSettings}
                  startIcon={<RefreshIcon />}
                  disabled={saving}
                  fullWidth={isMobile}
                >
                  Yenile
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  startIcon={<SaveIcon />}
                  disabled={saving}
                  fullWidth={isMobile}
                  sx={{
                    background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.dark} 90%)`,
                    boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                  }}
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default NotificationSettingsPage;