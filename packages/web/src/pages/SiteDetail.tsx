import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ArrowBack, Power, TrendingUp, Warning } from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Site, InverterData } from '@/types';
import { subscribeToCollection, subscribeToPVStringStates, isNightOrIdle } from '@/utils/firestore';
import { formatPower, formatEnergy, formatNumberTR } from '@/utils/format';
import StatCard from '@/components/StatCard';
import InverterViewManager from '@/components/InverterViewManager';

export default function SiteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [inverterData, setInverterData] = useState<InverterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pvStates, setPvStates] = useState<Map<string, Map<string, boolean>>>(new Map());

  useEffect(() => {
    if (id) {
      fetchSite(id);
    }
  }, [id]);

  useEffect(() => {
    if (!site) return;

    const unsubscribeFunctions: (() => void)[] = [];

    // Her veri kaynağı için subscription oluştur
    site.sources?.forEach(source => {
      const unsubscribe = subscribeToCollection(
        source.collection,
        source.type,
        (data) => {
          setInverterData(prev => {
            // Aynı koleksiyondan gelen eski verileri kaldır, yenilerini ekle
            const filtered = prev.filter(item => 
              !data.some(newItem => newItem.id === item.id)
            );
            return [...filtered, ...data];
          });

          // PV string state'lerini de dinle (header istatistikleri için)
          data.forEach(inv => {
            if (inv.id) {
              const unsubPv = subscribeToPVStringStates(inv.id, (states) => {
                setPvStates(prev => {
                  const next = new Map(prev);
                  next.set(inv.id!, states);
                  return next;
                });
              });
              unsubscribeFunctions.push(unsubPv);
            }
          });
        }
      );
      unsubscribeFunctions.push(unsubscribe);
    });

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [site]);

  const fetchSite = async (siteId: string) => {
    try {
      const siteDoc = await getDoc(doc(db, 'sites', siteId));
      if (siteDoc.exists()) {
        setSite({ id: siteDoc.id, ...siteDoc.data() } as Site);
      } else {
        setError('Santral bulunamadı');
      }
    } catch (error) {
      console.error('Error fetching site:', error);
      setError('Veri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Calculate site stats (inverter fault + PV string faults)
  const pvFaultCount = (() => {
    let faults = 0;
    inverterData.forEach(inv => {
      // Gece/boşta iken PV hatası sayma
      if (isNightOrIdle(inv)) return;
      const stringStates = pvStates.get(inv.id || '') || new Map();
      const countEntries = (entries: Array<[string, any]>) => {
        entries.forEach(([key, pv]) => {
          const current = pv?.current !== undefined ? pv.current : (pv?.I !== undefined ? pv.I : undefined);
          const voltage = pv?.voltage !== undefined ? pv.voltage : (pv?.V !== undefined ? pv.V : undefined);
          if (current !== undefined || voltage !== undefined) {
            const pvStatesLoaded = pvStates.size > 0;
            const isManuallyActive = !pvStatesLoaded ? true : stringStates.get(key) !== false;
            if (!isManuallyActive) return;
            const actualCurrent = current || 0;
            // SADECE AKIM DEĞERİNE BAK - 0 ise hatalı say
            if (actualCurrent === 0) {
              faults++;
            }
          }
        });
      };

      if (inv.pvInputs) {
        countEntries(Object.entries(inv.pvInputs));
      } else if (inv.mpptData) {
        countEntries(inv.mpptData);
      }
    });
    return faults;
  })();

  const inverterFaultCount = inverterData.filter(inv => {
    const s = (inv.status || '').toString().toLowerCase();
    return s.includes('fault') || s.includes('error') || s.includes('alarm');
  }).length;

  const activeInvertersCount = inverterData.filter(inv => (inv.activePower || 0) > 0).length;

  const siteStats = {
    totalPower: inverterData.reduce((sum, inv) => sum + (inv.activePower || 0), 0),
    dailyYield: inverterData.reduce((sum, inv) => sum + (inv.dailyYield || 0), 0),
    totalYield: inverterData.reduce((sum, inv) => sum + (inv.totalYield || 0), 0),
    faultCount: inverterFaultCount + pvFaultCount,
    activeInverters: activeInvertersCount,
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/sites')}
        >
          Santrallara Dön
        </Button>
      </Box>
    );
  }

  if (!site) {
    return null;
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/sites')}
          variant="outlined"
        >
          Geri
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {site.name}
        </Typography>
      </Box>

      {/* Kompakt Real-time Stats */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}>
          <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'success.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <Power sx={{ color: 'success.main', fontSize: 20 }} />
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  ANLIK GÜÇ
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1, fontSize: '1rem' }}>
                  {formatPower(siteStats.totalPower)}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'info.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <TrendingUp sx={{ color: 'info.main', fontSize: 20 }} />
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  GÜNLÜK ÜRETİM
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1, fontSize: '1rem' }}>
                  {formatEnergy(siteStats.dailyYield)}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: siteStats.activeInverters < inverterData.length ? 'error.50' : 'primary.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <Power sx={{ color: siteStats.activeInverters < inverterData.length ? 'error.main' : 'primary.main', fontSize: 20 }} />
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  AKTİF INVERTER
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1, fontSize: '1rem' }}>
                  {siteStats.activeInverters}/{inverterData.length}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: siteStats.faultCount > 0 ? 'error.50' : 'success.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <Warning sx={{ color: siteStats.faultCount > 0 ? 'error.main' : 'success.main', fontSize: 20 }} />
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  ÇALIŞMAYAN SAYISI
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1, fontSize: '1rem' }}>
                  {siteStats.faultCount}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Ultra Kompakt Santral Bilgileri - Tek Satır */}
      <Paper sx={{ p: 1, mb: 2, bgcolor: 'grey.50' }}>
        <Grid container spacing={1} alignItems="center">
          <Grid item xs={12} sm={3}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>Konum:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                {site.location || 'Belirtilmemiş'}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>Kapasite:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                {formatNumberTR(site.capacityMWp || 0, 3)} MWp
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>Sistem:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                {site.systemType || 'FUSION'}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>Veri:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                {site.sources?.length || 0} Koleksiyon
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Inverter View Manager - Cards and Table view */}
      {inverterData.length > 0 && (
        <InverterViewManager 
          data={inverterData} 
          title={`${site?.name || 'Santral'} İnverterleri (${inverterData.length} adet)`}
        />
      )}
    </Box>
  );
}
