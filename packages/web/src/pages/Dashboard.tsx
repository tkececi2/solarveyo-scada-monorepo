import { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Button,
  Alert,
  Card,
  CardContent,
  Avatar,
  LinearProgress,
  Chip,
  Stack,
  Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Power,
  TrendingUp,
  Warning,
  Save,
  WbSunny,
  BatteryChargingFull,
  Factory,
  ElectricBolt,
  Timeline,
  CheckCircle,
  ErrorOutline,
} from '@mui/icons-material';
import { collection, getDocs, query, where, documentId, orderBy, limit as fbLimit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Site, InverterData } from '@/types';
import { subscribeToCollection } from '@/utils/firestore';
import { formatPower, formatEnergy, formatNumberTR } from '@/utils/format';
import { saveDailyProductionData, collectDailyProductionData } from '@/services/dailyProductionService';
import StatCard from '@/components/StatCard';
import TrendLineChart from '@/components/TrendLineChart';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { user, getAccessibleSites } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<Map<string, InverterData[]>>(new Map());
  const [summary, setSummary] = useState({
    totalPower: 0,
    dailyProduction: 0,
    totalProduction: 0,
    faultCount: 0,
  });
  const [history, setHistory] = useState<Array<{ name: string; value: number }>>([]);
  const [dailySeries, setDailySeries] = useState<Array<{ name: string; value: number }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    fetchSites();
    fetchDailySeries();
  }, []);

  // Kullanıcı değiştiğinde verileri sıfırla ve yeniden yükle
  useEffect(() => {
    setAllData(new Map());
    setSites([]);
    setSummary({ totalPower: 0, dailyProduction: 0, totalProduction: 0, faultCount: 0 });
    fetchSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchSites = async () => {
    try {
      const accessible = getAccessibleSites();
      let snapshot;
      if (accessible.length > 0) {
        const qSites = query(collection(db, 'sites'), where(documentId(), 'in', accessible));
        snapshot = await getDocs(qSites);
      } else {
        snapshot = await getDocs(collection(db, 'sites'));
      }

      const sitesData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' 
            ? data.createdAt.toDate() 
            : new Date()
        };
      }) as Site[];
      setSites(sitesData);
    } catch (error) {
      console.error('Error fetching sites:', error);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to all site data sources for realtime summary
  useEffect(() => {
    if (sites.length === 0) return;

    const unsubscribeFns: Array<() => void> = [];

    sites.forEach(site => {
      site.sources?.forEach(source => {
        const unsubscribe = subscribeToCollection(
          source.collection,
          source.type,
          (inverters: InverterData[]) => {
            setAllData(prev => {
              const next = new Map(prev);
              next.set(`${site.id}:${source.collection}`, inverters);
              return next;
            });
          }
        );
        unsubscribeFns.push(unsubscribe);
      });
    });

    return () => {
      unsubscribeFns.forEach(fn => fn());
    };
  }, [sites]);

  // Recompute summary whenever data changes
  useEffect(() => {
    const allInverters: InverterData[] = Array.from(allData.values()).flat();

    const totalPower = allInverters.reduce((sum, inv) => sum + (inv.activePower || 0), 0);
    const dailyProduction = allInverters.reduce((sum, inv) => sum + (inv.dailyYield || 0), 0);
    const totalProduction = allInverters.reduce((sum, inv) => sum + (inv.totalYield || 0), 0);

    const faultCount = allInverters.filter(inv => {
      const s = (inv.status || '').toString().toLowerCase();
      return s.includes('fault') || s.includes('error') || s.includes('alarm') || s.includes('warning');
    }).length;

    setSummary({ totalPower, dailyProduction, totalProduction, faultCount });
  }, [allData]);

  // Son 7 günün günlük üretim serisini çek
  const fetchDailySeries = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'daily_production'), orderBy('date', 'desc'), fbLimit(7)));
      const accessible = getAccessibleSites();
      const list: Array<{ name: string; value: number }> = [];
      snap.forEach((doc) => {
        const data: any = doc.data();
        let total = data?.summary?.totalProduction || 0;
        if (accessible.length > 0 && Array.isArray(data?.sites)) {
          total = data.sites
            .filter((s: any) => accessible.includes(s.siteId))
            .reduce((sum: number, s: any) => sum + (s.totalProduction || 0), 0);
        }
        list.push({ name: data.date, value: total });
      });
      setDailySeries(list.reverse());
    } catch (e) {
      console.error('Error loading daily series', e);
    }
  };



  const handleSaveDailyData = async () => {
    setIsSaving(true);
    try {
      const data = await collectDailyProductionData();
      await saveDailyProductionData(data);
      setLastSaved(new Date().toLocaleTimeString('tr-TR'));
    } catch (error) {
      console.error('Error saving daily data:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const totalCapacity = sites.reduce((sum, site) => sum + (site.capacityMWp || 0), 0);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const efficiency = totalCapacity > 0 ? (summary.totalPower / (totalCapacity * 1000)) * 100 : 0;
  const activeSites = Array.from(allData.values()).filter(inverters => 
    inverters.some(inv => (inv.activePower || 0) > 0)
  ).length;

  const allInvertersList = Array.from(allData.values()).flat();
  const totalInvertersCount = allInvertersList.length;
  const powerThresholdKW = 0.5;
  const activeInvertersNow = allInvertersList.filter(inv => (inv.activePower || 0) > powerThresholdKW).length;
  const inactiveInvertersNow = Math.max(0, totalInvertersCount - activeInvertersNow);

  return (
    <Box>
      {/* Modern Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: 'primary.main' }}>
          ☀️ SolarVeyo Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Güneş Enerjisi Santralları - Gerçek Zamanlı İzleme
        </Typography>
      </Box>
      
      <Grid container spacing={3}>
        {/* Ana Performans Kartları */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ 
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 3,
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              transform: 'translateY(-2px)'
            }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Toplam Kapasite
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {formatNumberTR(totalCapacity, 1)} MWp
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#fef3c7', width: 56, height: 56 }}>
                  <WbSunny sx={{ fontSize: 28, color: '#f59e0b' }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ 
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 3,
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              transform: 'translateY(-2px)'
            }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Anlık Güç
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {formatPower(summary.totalPower)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                    Verimlilik: %{formatNumberTR(efficiency, 1)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#dcfce7', width: 56, height: 56 }}>
                  <ElectricBolt sx={{ fontSize: 28, color: '#16a34a' }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ 
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 3,
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              transform: 'translateY(-2px)'
            }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Günlük Üretim
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {formatEnergy(summary.dailyProduction)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#dbeafe', width: 56, height: 56 }}>
                  <BatteryChargingFull sx={{ fontSize: 28, color: '#2563eb' }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ 
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 3,
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              transform: 'translateY(-2px)'
            }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    İnverter Sayısı (Fusion + Sangrow)
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {totalInvertersCount}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>Toplam inverter</Typography>
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <Chip label={`Aktif: ${activeInvertersNow}`} size="small" color="success" variant="outlined" />
                    <Chip label={`Çalışmıyor: ${inactiveInvertersNow}`} size="small" color="error" variant="outlined" />
                  </Box>
                </Box>
                <Avatar sx={{ 
                  bgcolor: '#eef2ff', 
                  width: 56, 
                  height: 56 
                }}>
                  <Factory sx={{ fontSize: 28, color: '#4f46e5' }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Sistem Genel Bakış */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Timeline sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Günlük Üretim (Son 7 Gün)
                </Typography>
              </Box>

              {dailySeries.length > 0 ? (
                <TrendLineChart data={dailySeries} />
              ) : (
                <Box sx={{ 
                  height: 300, 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  bgcolor: 'grey.50',
                  borderRadius: 2
                }}>
                  <CircularProgress sx={{ mb: 2 }} />
                  <Typography color="text.secondary" variant="h6">
                    Veri Toplanıyor...
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Son 7 güne ait kümülatif günlük üretim yükleniyor
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Hızlı İstatistikler */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 3, boxShadow: 2, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                📊 Sistem İstatistikleri
              </Typography>
              
              <Stack spacing={3}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Aktif Santrallar
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {activeSites}/{sites.length}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={sites.length > 0 ? (activeSites / sites.length) * 100 : 0}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Sistem Verimliliği
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      %{formatNumberTR(efficiency, 1)}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min(efficiency, 100)}
                    color={efficiency > 70 ? 'success' : efficiency > 40 ? 'warning' : 'error'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Divider />

                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      <Factory sx={{ fontSize: 16, mr: 1, verticalAlign: 'text-bottom' }} />
                      Toplam Santral
                    </Typography>
                    <Chip label={sites.length} color="primary" size="small" />
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      <Power sx={{ fontSize: 16, mr: 1, verticalAlign: 'text-bottom' }} />
                      Toplam İnverter
                    </Typography>
                    <Chip 
                      label={totalInvertersCount} 
                      color="success" 
                      size="small" 
                    />
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      <TrendingUp sx={{ fontSize: 16, mr: 1, verticalAlign: 'text-bottom' }} />
                      Toplam Üretim
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatEnergy(summary.totalProduction)}
                    </Typography>
                  </Box>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>



        {/* Veri Yönetimi */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Save sx={{ mr: 2, color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    💾 Veri Yönetimi
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={isSaving ? <CircularProgress size={16} /> : <Save />}
                  onClick={handleSaveDailyData}
                  disabled={isSaving}
                  sx={{ borderRadius: 2 }}
                >
                  {isSaving ? 'Kaydediliyor...' : 'Günlük Veri Kaydet'}
                </Button>
              </Box>
              
              {lastSaved && (
                <Alert 
                  severity="success" 
                  sx={{ mb: 2, borderRadius: 2 }}
                  icon={<CheckCircle />}
                >
                  ✅ Son başarılı kaydetme: {lastSaved}
                </Alert>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                📅 <strong>Günlük kayıt:</strong> Her gece saat 23:30'da otomatik
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                ⏱️ <strong>10 dakikalık kayıt:</strong> 06:00-22:00 arası her 10 dakikada
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                👁️ <strong>Tarayıcı durumu:</strong> Açık olduğunda sürekli, kapalı olduğunda sadece 22:00'a kadar
              </Typography>
              <Typography variant="body2" color="text.secondary">
                🔧 Manuel kaydetme ile anlık durumu da kaydedebilirsiniz.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}