import { useState, useEffect, useRef } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Pagination,
} from '@mui/material';
import { Edit, Visibility, Power, TrendingUp, WbSunny, SolarPower, Factory, BatteryChargingFull, LocationOn, Delete, ViewModule, TableRows, Warning, ElectricBolt, Search, ViewComfy, ViewCompact } from '@mui/icons-material';
import SolarFarmIcon from '@/components/SolarFarmIcon';
import { LinearProgress, Tooltip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc, query, where, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Site, InverterData } from '@/types';
import { formatNumberTR, formatPower, formatEnergy } from '@/utils/format';
import { parseAndCompareSiteNames, subscribeToCollection, subscribeToPVStringStates, isNightOrIdle } from '@/utils/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationService } from '@/services/notificationService';
import { NotificationAlert } from '@/types';

interface SiteData {
  totalPower: number;
  dailyYield: number;
  activeInverters: number;
  totalInverters: number;
  faultyInverters: number;
  pvStringStats: {
    total: number;
    active: number;
    faulty: number;
  };
}

type ViewMode = 'cards' | 'table';

export default function Sites() {
  console.log('🔔🔔🔔 SANTRALLER SAYFASI YÜKLENDİ 🔔🔔🔔');
  const { user, getAccessibleSites } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteData, setSiteData] = useState<Map<string, SiteData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'faulty' | 'ok'>('all');
  const [sortMode, setSortMode] = useState<'name' | 'power' | 'faults'>('name');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('compact');
  const [pvStates, setPvStates] = useState<Map<string, Map<string, boolean>>>(new Map());
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(12); // Kart görünümü için 12, tablo için daha fazla olabilir
  const [notificationSettings, setNotificationSettings] = useState<any>(null);
  const navigate = useNavigate();
  
  // Cooldown bilgisini localStorage'dan yükle ve eskilerini temizle
  const loadCooldownData = () => {
    const stored = localStorage.getItem('alertCooldowns');
    if (stored) {
      const parsed = JSON.parse(stored);
      const map = new Map<string, Date>();
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      
      Object.entries(parsed).forEach(([key, value]) => {
        const date = new Date(value as string);
        // Sadece son 30 dakika içindeki cooldown'ları koru
        if (date > thirtyMinutesAgo) {
          map.set(key, date);
        }
      });
      
      // Temizlenmiş veriyi geri kaydet
      const cleanedData: Record<string, string> = {};
      map.forEach((value, key) => {
        cleanedData[key] = value.toISOString();
      });
      localStorage.setItem('alertCooldowns', JSON.stringify(cleanedData));
      
      return map;
    }
    return new Map<string, Date>();
  };
  
  const lastAlertTimesRef = useRef<Map<string, Date>>(loadCooldownData());

  // Bildirim oluşturma fonksiyonu
  const createAlert = async (
    siteId: string,
    siteName: string,
    type: 'inverter' | 'pvstring' | 'temperature',
    severity: 'warning' | 'critical',
    title: string,
    message: string,
    deviceId?: string,
    deviceName?: string,
    value?: number
  ) => {
    if (!user) return;
    
    // Cooldown kontrolü (30 dakika)
    const alertKey = `${siteId}-${type}-${deviceId || 'general'}`;
    const lastAlertTime = lastAlertTimesRef.current.get(alertKey);
    const now = new Date();
    
    const COOLDOWN_MINUTES = 30;
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;
    
    if (lastAlertTime && (now.getTime() - lastAlertTime.getTime()) < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - (now.getTime() - lastAlertTime.getTime())) / 60000);
      console.log(`🔔 Cooldown aktif: ${alertKey} - ${remainingMinutes} dakika kaldı`);
      return; // Cooldown süresi henüz geçmedi
    }

    try {
      const alert: Omit<NotificationAlert, 'id'> = {
        userId: user.uid,
        siteId,
        siteName,
        type,
        severity,
        title,
        message,
        deviceId,
        deviceName,
        timestamp: now,
        acknowledged: false
      };
      
      // value sadece varsa ekle
      if (value !== undefined) {
        alert.value = value;
      }

      await NotificationService.createAlert(alert);
      
      // Cooldown'u güncelle ve localStorage'a kaydet
      lastAlertTimesRef.current.set(alertKey, now);
      
      // localStorage'a kaydet
      const cooldownData: Record<string, string> = {};
      lastAlertTimesRef.current.forEach((value, key) => {
        cooldownData[key] = value.toISOString();
      });
      localStorage.setItem('alertCooldowns', JSON.stringify(cooldownData));
      
      console.log(`🔔 Alert created: ${title} for ${siteName}`);
    } catch (error) {
      console.error('Error creating alert:', error);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  // User değiştiğinde yeniden fetch et ve bildirim ayarlarını yükle
  useEffect(() => {
    if (user) {
      fetchSites();
      
      // 🔒 SADECE admin/manager için notification settings yükle
      if (user.role === 'admin' || user.role === 'manager') {
        console.log('🔔 Manager/Admin - Bildirim ayarları kontrol ediliyor...');
        NotificationService.getUserNotificationSettings(user.uid).then(async settings => {
          if (settings) {
            setNotificationSettings(settings);
            console.log('🔔 Bildirim ayarları yüklendi:', settings);
          } else {
            // Sadece manager/admin için varsayılan ayarları oluştur
            console.log('🔔 Manager/Admin için varsayılan bildirim ayarları oluşturuluyor...');
            try {
              const defaultSettings = await NotificationService.createDefaultSettings(user.uid, user.assignedSites || []);
              setNotificationSettings(defaultSettings);
              console.log('🔔 Varsayılan bildirim ayarları oluşturuldu:', defaultSettings);
            } catch (error) {
              console.error('🔔 Varsayılan ayarlar oluşturulamadı (permissions):', error);
            }
          }
        }).catch(error => {
          console.error('🔔 Bildirim ayarları yüklenirken hata:', error);
        });
      } else {
        console.log('🔔 Viewer rolü - Bildirim ayarları atlanıyor');
        setNotificationSettings(null); // Viewer için null
      }
    }
  }, [user]);

  useEffect(() => {
    // Sadece görünen siteler için real-time veri dinleme (performans optimizasyonu)
    const unsubscribeFunctions: (() => void)[] = [];
    
    sites.forEach(site => {
      site.sources?.forEach(source => {
        const unsubscribe = subscribeToCollection(
          source.collection,
          source.type,
          (inverters: InverterData[]) => {
            // Her inverter için PV string state'lerini dinle
            const pvUnsubscribeFns: (() => void)[] = [];
            
            inverters.forEach(inverter => {
              if (inverter.id) {
                const unsubscribePv = subscribeToPVStringStates(
                  inverter.id,
                  (states) => {
                    setPvStates(prev => {
                      const next = new Map(prev);
                      next.set(inverter.id!, states);
                      return next;
                    });
                  }
                );
                pvUnsubscribeFns.push(unsubscribePv);
              }
            });
            
            // Inverter verisi her güncellendiğinde stats'i hesapla
            const calculateStats = () => {
              // notificationSettings'i parent scope'tan al
              const currentNotificationSettings = notificationSettings;
              // İnverter durumlarını hesapla ve bildirim oluştur
              const faultyInverters = inverters.filter(inv => {
                const s = (inv.status || '').toString().toLowerCase();
                const isFaulty = s.includes('fault') || s.includes('error') || s.includes('alarm');
                const isOffline = s.includes('offline') || s === '0' || s === 'offline';
                
                // Hatalı veya çevrimdışı inverter için bildirim oluştur (ayarlar aktifse)
                if (isFaulty || isOffline) {
                  console.log(`🔔 Problemli invertör tespit edildi: ${inv.name || inv.id}, Durum: ${inv.status}, Güç: ${inv.activePower}`);
                  console.log('🔔 Bildirim ayarları:', currentNotificationSettings);
                  
                  if (currentNotificationSettings?.inverterAlerts?.enabled) {
                    console.log(`🔔 Bildirim oluşturuluyor: ${inv.name || inv.id}`);
                    createAlert(
                      site.id,
                      site.name,
                      'inverter',
                      isFaulty ? 'critical' : 'warning',
                      isFaulty ? 'İnvertör Hatası' : 'İnvertör Çevrimdışı',
                      `${inv.name || inv.id} invertörü ${isFaulty ? 'hatalı' : 'çevrimdışı'}. Durum: ${inv.status}, Güç: ${inv.activePower || 0} kW`,
                      inv.id,
                      inv.name || inv.id
                    );
                  } else {
                    console.log('🔔 İnvertör bildirimleri kapalı veya ayarlar yüklenmemiş');
                  }
                }
                
                // Sıcaklık kontrolü (ayarlar aktifse)
                if (inv.temperature && currentNotificationSettings?.temperatureAlerts?.enabled) {
                  const highThreshold = currentNotificationSettings.temperatureAlerts.highTempThreshold || 75;
                  const criticalThreshold = currentNotificationSettings.temperatureAlerts.criticalTempThreshold || 85;
                  
                  if (inv.temperature > highThreshold) {
                    createAlert(
                      site.id,
                      site.name,
                      'temperature',
                      inv.temperature > criticalThreshold ? 'critical' : 'warning',
                      'Yüksek Sıcaklık Uyarısı',
                      `${inv.name || inv.id} invertörünün sıcaklığı yüksek: ${inv.temperature}°C`,
                      inv.id,
                      inv.name || inv.id,
                      inv.temperature
                    );
                  }
                }
                
                return isFaulty;
              }).length;

              // PV String istatistiklerini hesapla - Manuel pasif olanları işleme katma
              let totalStrings = 0;  // Manuel aktif olan toplam string sayısı
              let activeStrings = 0; // Çalışan stringler (akım > 0)
              let faultyStrings = 0; // Hatalı stringler (akım = 0)

              inverters.forEach(inv => {
                // Gece/boşta ise PV stringleri değerlendirme
                if (isNightOrIdle(inv)) return;
                const stringStates = pvStates.get(inv.id!) || new Map();
                
                const processStringData = (entries: Array<[string, any]>) => {
                  entries.forEach(([key, pvData]) => {
                    const current = pvData?.current !== undefined ? pvData.current : (pvData?.I !== undefined ? pvData.I : undefined);
                    const voltage = pvData?.voltage !== undefined ? pvData.voltage : (pvData?.V !== undefined ? pvData.V : undefined);
                    
                    // Sadece veri olan stringleri kontrol et
                    if (current !== undefined || voltage !== undefined) {
                      // Manuel durum kontrolü - pasif olanları sayma
                      // PV states henüz yüklenmemişse (size 0), stringleri varsayılan olarak aktif kabul et
                      const pvStatesLoaded = pvStates.size > 0;
                      const isManuallyActive = !pvStatesLoaded ? true : stringStates.get(key) !== false;
                      
                      if (isManuallyActive) {
                        totalStrings++;
                        const actualCurrent = current || 0;
                        
                        // SADECE AKIM DEĞERİNE BAK - 0 ise pasif/hatalı say
                        if (actualCurrent > 0) {
                          activeStrings++;
                        } else {
                          // Akım 0 ise her zaman hatalı/pasif say
                          faultyStrings++;
                          
                          // PV String hatası için bildirim oluştur (ayarlar aktifse ve PV states yüklendiyse)
                          if (pvStatesLoaded && notificationSettings?.pvStringAlerts?.enabled) {
                            createAlert(
                              site.id,
                              site.name,
                              'pvstring',
                              'warning',
                              'PV String Pasif',
                              `${inv.name || inv.id} invertöründe ${key} PV string'i pasif. Akım: ${actualCurrent}A`,
                              `${inv.id}-${key}`,
                              `${inv.name || inv.id} - ${key}`,
                              actualCurrent
                            );
                          }
                        }
                      }
                    }
                  });
                };
                
                if (inv.pvInputs) {
                  processStringData(Object.entries(inv.pvInputs));
                } else if (inv.mpptData) {
                  processStringData(inv.mpptData);
                }
              });

              const stats: SiteData = {
                totalPower: inverters.reduce((sum, inv) => sum + (inv.activePower || 0), 0),
                dailyYield: inverters.reduce((sum, inv) => sum + (inv.dailyYield || 0), 0),
                activeInverters: inverters.filter(inv => (inv.activePower || 0) > 0).length,
                totalInverters: inverters.length,
                faultyInverters,
                pvStringStats: {
                  total: totalStrings,
                  active: activeStrings,
                  faulty: faultyStrings
                }
              };

              setSiteData(prev => {
                const next = new Map(prev);
                next.set(site.id, stats);
                return next;
              });
            };
            
            // İlk hesaplama
            calculateStats();
            
            // Cleanup fonksiyonunu güncelle
            unsubscribeFunctions.push(() => {
              pvUnsubscribeFns.forEach(fn => fn());
            });
          }
        );
        unsubscribeFunctions.push(unsubscribe);
      });
    });

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [sites, notificationSettings]); // notificationSettings değiştiğinde yeniden dinle

  // PV states değiştiğinde site stats'leri yeniden hesapla
  useEffect(() => {
    if (sites.length === 0) return;
    
    // Her site için güncel inverter verilerini al ve stats hesapla
    sites.forEach(site => {
      site.sources?.forEach(source => {
        subscribeToCollection(
          source.collection,
          source.type,
          (inverters: InverterData[]) => {
            // İnverter durumlarını hesapla
            const faultyInverters = inverters.filter(inv => {
              const s = (inv.status || '').toString().toLowerCase();
              return s.includes('fault') || s.includes('error') || s.includes('alarm');
            }).length;

            // PV String istatistiklerini hesapla
            let totalStrings = 0;
            let activeStrings = 0;
            let faultyStrings = 0;

            inverters.forEach(inv => {
              if (isNightOrIdle(inv)) return;
              const stringStates = pvStates.get(inv.id!) || new Map();
              
              const processStringData = (entries: Array<[string, any]>) => {
                entries.forEach(([key, pvData]) => {
                  const current = pvData?.current !== undefined ? pvData.current : (pvData?.I !== undefined ? pvData.I : undefined);
                  const voltage = pvData?.voltage !== undefined ? pvData.voltage : (pvData?.V !== undefined ? pvData.V : undefined);
                  
                  if (current !== undefined || voltage !== undefined) {
                    // PV states kontrolü
                    const pvStatesLoaded = pvStates.size > 0;
                    const isManuallyActive = !pvStatesLoaded ? true : stringStates.get(key) !== false;
                    
                    if (isManuallyActive) {
                      totalStrings++;
                      const actualCurrent = current || 0;
                      
                      if (actualCurrent > 0) {
                        activeStrings++;
                      } else if (pvStatesLoaded) {
                        // Sadece PV states yüklendikten sonra hataları say
                        faultyStrings++;
                      } else {
                        // PV states yüklenmemişse, akımı 0 olanları da aktif say
                        activeStrings++;
                      }
                    }
                  }
                });
              };
              
              if (inv.pvInputs) {
                processStringData(Object.entries(inv.pvInputs));
              } else if (inv.mpptData) {
                processStringData(inv.mpptData);
              }
            });

            const stats: SiteData = {
              totalPower: inverters.reduce((sum, inv) => sum + (inv.activePower || 0), 0),
              dailyYield: inverters.reduce((sum, inv) => sum + (inv.dailyYield || 0), 0),
              activeInverters: inverters.filter(inv => (inv.activePower || 0) > 0).length,
              totalInverters: inverters.length,
              faultyInverters,
              pvStringStats: {
                total: totalStrings,
                active: activeStrings,
                faulty: faultyStrings
              }
            };

            setSiteData(prev => {
              const next = new Map(prev);
              next.set(site.id, stats);
              return next;
            });
          }
        );
      });
    });
  }, [pvStates, sites]);

  const fetchSites = async () => {
    try {
      const accessibleSites = getAccessibleSites();
      let sitesSnapshot;
      
      // Viewer kullanıcılar için saha filtreleme
      if (accessibleSites.length > 0) {
        // Viewer için sadece atanan siteleri getir
        const sitesQuery = query(
          collection(db, 'sites'),
          where(documentId(), 'in', accessibleSites)
        );
        sitesSnapshot = await getDocs(sitesQuery);
      } else {
        // Admin/Manager için tüm siteleri getir
        sitesSnapshot = await getDocs(collection(db, 'sites'));
      }
      
      const sitesData = sitesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Site[];
      
      // Hiyerarşik sıralama
      sitesData.sort((a, b) => parseAndCompareSiteNames(a.name, b.name));
      setSites(sitesData);
    } catch (error) {
      console.error('Error fetching sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSite = (site: Site) => {
    // EditSite sayfasına yönlendir
    navigate(`/sites/${site.id}/edit`);
  };

  const handleDeleteSite = (site: Site) => {
    setSiteToDelete(site);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSite = async () => {
    if (!siteToDelete) return;
    
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'sites', siteToDelete.id!));
      setSites(prev => prev.filter(site => site.id !== siteToDelete.id));
      setDeleteDialogOpen(false);
      setSiteToDelete(null);
    } catch (error) {
      console.error('Error deleting site:', error);
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setSiteToDelete(null);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const handleViewModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newViewMode: ViewMode,
  ) => {
    if (newViewMode !== null) {
      setViewMode(newViewMode);
    }
  };

  // Derived helpers for filtering/sorting
  const getBarColor = (percent: number): string => {
    if (percent >= 95) return 'success.main';
    if (percent >= 80) return 'warning.main';
    return 'error.main';
  };

  const getFaultCount = (siteId: string): number => {
    const d = siteData.get(siteId);
    // VERİ YÜKLENMEMİŞSE 0 DÖNDÜR (yanlış arıza göstermemek için)
    if (!d || d.totalInverters === 0) return 0;
    const inactive = Math.max(0, d.totalInverters - d.activeInverters);
    return (d.faultyInverters || 0) + inactive + (d.pvStringStats?.faulty || 0);
  };

  const siteMatchesSearch = (site: Site): boolean => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (site.name || '').toLowerCase().includes(q) ||
      (site.location || '').toLowerCase().includes(q) ||
      (site.systemType || '').toLowerCase().includes(q)
    );
  };

  const siteMatchesStatus = (site: Site): boolean => {
    if (statusFilter === 'all') return true;
    const faults = getFaultCount(site.id);
    return statusFilter === 'faulty' ? faults > 0 : faults === 0;
  };

  const filteredSites = [...sites]
    .filter(siteMatchesSearch)
    .filter(siteMatchesStatus)
    .sort((a, b) => {
      if (sortMode === 'name') {
        return parseAndCompareSiteNames(a.name, b.name);
      }
      const da = siteData.get(a.id);
      const db = siteData.get(b.id);
      if (sortMode === 'power') {
        const pa = da?.totalPower || 0;
        const pb = db?.totalPower || 0;
        return pb - pa; // desc
      }
      // faults
      const fa = getFaultCount(a.id);
      const fb = getFaultCount(b.id);
      return fb - fa; // most faulty first
    });

  // Pagination hesaplaması
  const totalPages = Math.ceil(filteredSites.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const visibleSites = filteredSites.slice(startIndex, startIndex + itemsPerPage);

  // Sayfa değiştiğinde başa dön
  const handlePageChange = (_: React.ChangeEvent<unknown>, newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalCount = sites.length;
  const faultyCount = sites.reduce((sum, s) => sum + (getFaultCount(s.id) > 0 ? 1 : 0), 0);
  const healthyCount = totalCount - faultyCount;

  return (
    <Box>
      {/* Header / Toolbar */}
      <Grid container spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Grid item xs={12} md={3}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Santrallar
          </Typography>
        </Grid>

        <Grid item xs={12} md={3}>
          <TextField
            size="small"
            fullWidth
            placeholder="Ara: isim, konum, sistem..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              )
            }}
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <ToggleButtonGroup
            value={statusFilter}
            exclusive
            onChange={(e, v) => v && setStatusFilter(v)}
            size="small"
            sx={{ '& .MuiToggleButton-root': { px: 1.2, py: 0.3 } }}
          >
            <ToggleButton value="all">Tümü</ToggleButton>
            <ToggleButton value="ok">Sağlıklı</ToggleButton>
            <ToggleButton value="faulty">Hatalı</ToggleButton>
          </ToggleButtonGroup>
        </Grid>

        <Grid item xs={12} md={3}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <ToggleButtonGroup
              value={sortMode}
              exclusive
              onChange={(e, v) => v && setSortMode(v)}
              size="small"
            >
              <ToggleButton value="name">Ada Göre</ToggleButton>
              <ToggleButton value="power">Güce Göre</ToggleButton>
              <ToggleButton value="faults">Hata Önce</ToggleButton>
            </ToggleButtonGroup>

            <ToggleButtonGroup
              value={density}
              exclusive
              onChange={(e, v) => v && setDensity(v)}
              size="small"
            >
              <ToggleButton value="comfortable" aria-label="Rahat">
                <ViewComfy sx={{ fontSize: 16 }} />
              </ToggleButton>
              <ToggleButton value="compact" aria-label="Kompakt">
                <ViewCompact sx={{ fontSize: 16 }} />
              </ToggleButton>
            </ToggleButtonGroup>

            <Paper elevation={1} sx={{ p: 0.5 }}>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={handleViewModeChange}
                size="small"
                sx={{ 
                  '& .MuiToggleButton-root': {
                    border: 'none',
                    borderRadius: 1,
                    px: 1.5,
                    py: 0.3,
                    fontSize: '0.75rem'
                  }
                }}
              >
                <ToggleButton value="cards" aria-label="Kart Görünümü">
                  <ViewModule sx={{ mr: 0.5, fontSize: 16 }} />
                  Kart
                </ToggleButton>
                <ToggleButton value="table" aria-label="Liste Görünümü">
                  <TableRows sx={{ mr: 0.5, fontSize: 16 }} />
                  Liste
                </ToggleButton>
              </ToggleButtonGroup>
            </Paper>
          </Box>
        </Grid>
      </Grid>

      {/* Summary chips */}
      <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip label={`Toplam: ${totalCount}`} color="default" variant="outlined" />
        <Chip label={`Sağlıklı: ${healthyCount}`} color="success" variant="outlined" onClick={() => setStatusFilter('ok')} />
        <Chip label={`Hatalı: ${faultyCount}`} color="error" variant="outlined" onClick={() => setStatusFilter('faulty')} />
        <Chip label={`Filtre Sonucu: ${visibleSites.length}`} color="primary" variant="outlined" />
      </Box>

      {/* Cards View */}
      {viewMode === 'cards' && (
        <Grid container spacing={density === 'compact' ? 1 : 2}>
          {visibleSites.map((site) => {
            const data = siteData.get(site.id);
            return (
              <Grid item xs={12} sm={6} lg={4} key={site.id}>
                <Card onClick={() => navigate(`/sites/${site.id}`)} sx={{ 
                  height: '100%',
                  border: (data?.faultyInverters || 0) > 0 || ((data?.totalInverters || 0) - (data?.activeInverters || 0)) > 0 || (data?.pvStringStats?.faulty || 0) > 0 
                    ? '2px solid' 
                    : '1px solid',
                  borderColor: (data?.faultyInverters || 0) > 0 || ((data?.totalInverters || 0) - (data?.activeInverters || 0)) > 0 || (data?.pvStringStats?.faulty || 0) > 0 
                    ? 'error.light' 
                    : 'grey.200',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                  '&:hover': { boxShadow: 4, transform: 'translateY(-1px)' }
                }}>
                  <CardContent sx={{ p: density === 'compact' ? 1.2 : 2 }}>
                    {/* Header with Status Indicator */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ mr: 1.2 }}>
                          <SolarFarmIcon system={site.systemType as any} size={30} />
                        </Box>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: density === 'compact' ? '0.95rem' : '1.1rem', lineHeight: 1.2 }}>
                            {site.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: density === 'compact' ? '0.75rem' : '0.8rem' }}>
                            {site.systemType} • {formatNumberTR(site.capacityMWp || 0, 1)} MWp
                          </Typography>
                        </Box>
                      </Box>
                      
                      {/* Status Indicator - İyileştirilmiş loading kontrolü */}
                      {(() => {
                        // Veri henüz yüklenmemiş mi kontrol et
                        const hasInverterData = data && data.totalInverters > 0;
                        
                        if (!hasInverterData) {
                          // Loading skeleton
                          return (
                            <Box sx={{ 
                              bgcolor: 'grey.100', 
                              color: 'grey.500', 
                              px: 1, 
                              py: 0.4, 
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'grey.300',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              animation: 'pulse 1.5s ease-in-out infinite'
                            }}>
                              ⏳ Yükleniyor...
                            </Box>
                          );
                        }
                        
                        // Veri yüklendi, gerçek arıza kontrolü yap
                        const totalFaults = getFaultCount(site.id);
                        
                        if (totalFaults > 0) {
                          return (
                            <Box sx={{ 
                              bgcolor: 'error.50', 
                              color: 'error.dark', 
                              px: 1, 
                              py: 0.4, 
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'error.light',
                              fontSize: '0.7rem',
                              fontWeight: 600
                            }}>
                              🚨 {totalFaults} Problem
                            </Box>
                          );
                        }
                        
                        // Sorunsuz durum
                        return (
                          <Box sx={{ 
                            bgcolor: 'success.50', 
                            color: 'success.dark', 
                            px: 1, 
                            py: 0.4, 
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'success.light',
                            fontSize: '0.7rem',
                            fontWeight: 600
                          }}>
                            ✅ Sorunsuz
                          </Box>
                        );
                      })()}
                    </Box>

                    {/* Location (hidden in compact) */}
                    {density !== 'compact' && (
                      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                          {site.location}
                        </Typography>
                      </Box>
                    )}

                    {/* Real-time Data - Clean Layout */}
                    {data && density !== 'compact' && (
                      <Box sx={{ mb: 2 }}>
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'success.50' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                                ANLIK GÜÇ
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', color: 'success.dark' }}>
                                {formatPower(data.totalPower)}
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={6}>
                            <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'info.50' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                                GÜNLÜK ÜRETİM
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', color: 'info.dark' }}>
                                {formatEnergy(data.dailyYield)}
                              </Typography>
                            </Paper>
                          </Grid>
                          {/* Health bars */}
                          <Grid item xs={12}>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              {/* Inverter availability bar */}
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">İnverter</Typography>
                                  {data && (
                                    <Typography variant="caption" color="text.secondary">
                                      {data.activeInverters}/{data.totalInverters}
                                    </Typography>
                                  )}
                                </Box>
                                {data && (
                                  <LinearProgress 
                                    variant="determinate" 
                                    value={(data.activeInverters / Math.max(1, data.totalInverters)) * 100}
                                    sx={{
                                      height: 8,
                                      borderRadius: 0.5,
                                      [`& .MuiLinearProgress-bar`]: { backgroundColor: getBarColor((data.activeInverters / Math.max(1, data.totalInverters)) * 100) }
                                    }}
                                  />
                                )}
                              </Box>
                              {/* PV strings health bar */}
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">PV String</Typography>
                                  {data && (
                                    <Typography variant="caption" color="text.secondary">
                                      {data.pvStringStats.active}/{data.pvStringStats.total}
                                    </Typography>
                                  )}
                                </Box>
                                {data && (
                                  <LinearProgress 
                                    variant="determinate" 
                                    value={(data.pvStringStats.active / Math.max(1, data.pvStringStats.total)) * 100}
                                    sx={{
                                      height: 8,
                                      borderRadius: 0.5,
                                      [`& .MuiLinearProgress-bar`]: { backgroundColor: getBarColor((data.pvStringStats.active / Math.max(1, data.pvStringStats.total)) * 100) }
                                    }}
                                  />
                                )}
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>
                      </Box>
                    )}
                    {data && density === 'compact' && (
                      <Box sx={{ mb: 1, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                        <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
                          <Chip size="small" color="success" variant="outlined" icon={<Power sx={{ fontSize: 16 }} />} label={`Güç: ${formatPower(data.totalPower)}`} />
                          <Chip size="small" color="info" variant="outlined" icon={<TrendingUp sx={{ fontSize: 16 }} />} label={`Günlük: ${formatEnergy(data.dailyYield)}`} />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
                          {(() => {
                            const invInactive = Math.max(0, data.totalInverters - data.activeInverters);
                            const invFaulty = data.faultyInverters + invInactive;
                            return (
                              <Chip 
                                size="small" 
                                icon={<Power sx={{ fontSize: 16 }} />} 
                                color={invFaulty > 0 ? 'error' : 'primary'} 
                                variant={invFaulty > 0 ? 'filled' : 'outlined'}
                                label={`İnv: ${data.activeInverters}/${data.totalInverters}${invFaulty>0?` (${invFaulty} çalışmıyor)`:''}`} 
                              />
                            );
                          })()}
                          {(() => {
                            const pvFaulty = data.pvStringStats.faulty;
                            return (
                              <Chip 
                                size="small" 
                                icon={<ElectricBolt sx={{ fontSize: 16 }} />} 
                                color={pvFaulty > 0 ? 'warning' : 'success'} 
                                variant={pvFaulty > 0 ? 'filled' : 'outlined'}
                                label={`PV: ${data.pvStringStats.active}/${data.pvStringStats.total}${pvFaulty>0?` (${pvFaulty} pasif)`:''}`} 
                              />
                            );
                          })()}
                        </Box>
                      </Box>
                    )}

                    {/* Status Information */}
                    {data && density !== 'compact' && (
                      <Box sx={{ mb: 2 }}>
                        <Grid container spacing={1}>
                          {/* İnverter Status */}
                          <Grid item xs={6}>
                            <Paper sx={{ 
                              p: 1.5, 
                              bgcolor: data.faultyInverters > 0 || (data.totalInverters - data.activeInverters) > 0 ? 'error.50' : 'primary.50',
                              border: data.faultyInverters > 0 || (data.totalInverters - data.activeInverters) > 0 ? '1px solid' : 'none',
                              borderColor: 'error.light'
                            }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Power sx={{ 
                                  fontSize: 16, 
                                  color: data.faultyInverters > 0 || (data.totalInverters - data.activeInverters) > 0 ? 'error.main' : 'primary.main' 
                                }} />
                                <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                  İnverter
                                </Typography>
                              </Box>
                              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                {data.activeInverters}/{data.totalInverters}
                              </Typography>
                              {(data.faultyInverters > 0 || (data.totalInverters - data.activeInverters) > 0) && (
                                <Chip 
                                  label={`${data.faultyInverters + (data.totalInverters - data.activeInverters)} çalışmıyor`}
                                  size="small" 
                                  color="error" 
                                  variant="outlined"
                                  sx={{ mt: 0.5, height: 18, fontSize: '0.65rem', bgcolor: 'error.0' }}
                                />
                              )}
                            </Paper>
                          </Grid>
                          
                          {/* PV String Status */}
                          <Grid item xs={6}>
                            <Paper sx={{ 
                              p: 1.5, 
                              bgcolor: data.pvStringStats.faulty > 0 ? 'warning.50' : 'success.50',
                              border: data.pvStringStats.faulty > 0 ? '1px solid' : 'none',
                              borderColor: 'warning.light'
                            }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <ElectricBolt sx={{ 
                                  fontSize: 16, 
                                  color: data.pvStringStats.faulty > 0 ? 'warning.main' : 'success.main' 
                                }} />
                                <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                  PV String
                                </Typography>
                              </Box>
                              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                {data.pvStringStats.active}/{data.pvStringStats.total}
                              </Typography>
                              {data.pvStringStats.faulty > 0 && (
                                <Chip 
                                  label={`${data.pvStringStats.faulty} pasif`}
                                  size="small" 
                                  color="warning" 
                                  variant="outlined"
                                  sx={{ mt: 0.5, height: 18, fontSize: '0.65rem' }}
                                />
                              )}
                            </Paper>
                          </Grid>
                        </Grid>
                      </Box>
                    )}

                    {/* Action Buttons (compactta gizli, kart tıklanabilir) */}
                    {density !== 'compact' && (
                      <Box sx={{ display: 'flex', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<Visibility sx={{ fontSize: 16 }} />}
                          onClick={() => navigate(`/sites/${site.id}`)}
                          sx={{ fontSize: '0.75rem', py: 0.5, px: 1.5, flex: 1 }}
                        >
                          Görüntüle
                        </Button>
                        <IconButton
                          size="small"
                          onClick={() => handleEditSite(site)}
                          sx={{ color: 'primary.main' }}
                        >
                          <Edit sx={{ fontSize: 18 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteSite(site)}
                          sx={{ color: 'error.main' }}
                        >
                          <Delete sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Santral</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Sistem</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Kapasite</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Anlık Güç</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Günlük Üretim</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>İnverterler</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>PV Stringler</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>İşlemler</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleSites.map((site) => {
                const data = siteData.get(site.id);
                return (
                  <TableRow 
                    key={site.id} 
                    hover
                    sx={{
                      bgcolor: (data?.faultyInverters || 0) > 0 || ((data?.totalInverters || 0) - (data?.activeInverters || 0)) > 0 || (data?.pvStringStats?.faulty || 0) > 0 
                        ? 'error.50' 
                        : 'inherit',
                      '&:hover': {
                        bgcolor: (data?.faultyInverters || 0) > 0 || ((data?.totalInverters || 0) - (data?.activeInverters || 0)) > 0 || (data?.pvStringStats?.faulty || 0) > 0 
                          ? 'error.100' 
                          : 'action.hover'
                      }
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box 
                          sx={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: '50%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            bgcolor: site.systemType === 'SANGROW' ? 'orange.100' : 'green.100'
                          }}
                        >
                          <WbSunny 
                            sx={{ 
                              color: site.systemType === 'SANGROW' ? 'orange.600' : 'green.600',
                              fontSize: 14
                            }} 
                          />
                        </Box>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {site.name}
                            </Typography>
                            {data && (data.faultyInverters > 0 || (data.totalInverters - data.activeInverters) > 0 || data.pvStringStats.faulty > 0) && (
                              <Chip 
                                label="Çalışmıyor" 
                                size="small" 
                                color="error" 
                                sx={{ height: 16, fontSize: '0.6rem', fontWeight: 600 }}
                              />
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {site.location}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={site.systemType} 
                        size="small" 
                        color={site.systemType === 'SANGROW' ? 'warning' : 'primary'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatNumberTR(site.capacityMWp || 0, 1)} MWp
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {data ? formatPower(data.totalPower) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {data ? formatEnergy(data.dailyYield) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {data && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box component="span">
                            {data.activeInverters}/{data.totalInverters}
                          </Box>
                          {(data.faultyInverters > 0 || (data.totalInverters - data.activeInverters) > 0) && (
                            <Chip 
                              label={`${data.faultyInverters + (data.totalInverters - data.activeInverters)} çalışmıyor`}
                              size="small" 
                              color="error"
                              sx={{ height: 18, fontSize: '0.6rem' }}
                            />
                          )}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      {data && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2">
                            {data.pvStringStats.active}/{data.pvStringStats.total}
                          </Typography>
                          {data.pvStringStats.faulty > 0 && (
                            <Chip 
                              label={`${data.pvStringStats.faulty} pasif`} 
                              size="small" 
                              color="warning"
                              sx={{ height: 18, fontSize: '0.6rem' }}
                            />
                          )}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/sites/${site.id}`)}
                          sx={{ color: 'primary.main' }}
                        >
                          <Visibility sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleEditSite(site)}
                          sx={{ color: 'info.main' }}
                        >
                          <Edit sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteSite(site)}
                          sx={{ color: 'error.main' }}
                        >
                          <Delete sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
          <Pagination 
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Sonuç bilgisi */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {filteredSites.length} santraldan {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredSites.length)} arası gösteriliyor
        </Typography>
      </Box>

      {/* Silme Onay Dialog'u */}
      <Dialog
        open={deleteDialogOpen}
        onClose={cancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Santral Sil
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            "{siteToDelete?.name}" santralını silmek istediğinizden emin misiniz? 
            Bu işlem geri alınamaz ve tüm veri bağlantıları kesilecektir.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete} disabled={deleting}>
            İptal
          </Button>
          <Button 
            onClick={confirmDeleteSite} 
            color="error" 
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <Delete />}
          >
            {deleting ? 'Siliniyor...' : 'Sil'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
