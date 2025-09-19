import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Alert,
  LinearProgress,
  Tabs,
  Tab,
  Button,
  Stack,
  useTheme,
  useMediaQuery,
  Paper,
} from '@mui/material';
import { 
  Assessment, 
  History,
  Refresh,
  Download,
  TrendingUp,
} from '@mui/icons-material';
import { collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Site } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';

// Components
import ReportFilters from '@/components/reports/ReportFilters';
import ReportStats from '@/components/reports/ReportStats';
import ReportChart from '@/components/reports/ReportChart';
import MonthlyReportTable from '@/components/reports/MonthlyReportTable';
import DataImportDialog from '@/components/reports/DataImportDialog';

// Services
import { getProductionReports, ReportData } from '@/services/reportsService';
import { importExcelDataUnified } from '@/services/unifiedProductionService';
import { ProductionEstimatesService } from '@/services/productionEstimatesService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`report-tabpanel-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: { xs: 2, sm: 3 } }}>{children}</Box>}
    </div>
  );
}

export default function Reports() {
  const { user, getAccessibleSites } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    end: new Date(),
  });
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearlyPerformance, setYearlyPerformance] = useState<number | undefined>(undefined);

  // Fetch sites on mount
  useEffect(() => {
    fetchSites();
  }, [user]);

  // Fetch report data when filters change
  useEffect(() => {
    if (sites.length > 0 && selectedSiteIds.length > 0) {
      fetchReportData();
    }
  }, [dateRange, selectedSiteIds, sites]);

  // Calculate yearly performance when relevant data changes
  useEffect(() => {
    if (sites.length > 0 && selectedSiteIds.length > 0) {
      calculateYearlyPerformance();
    }
  }, [selectedSiteIds, selectedYear, sites]);

  // Update date range when year changes
  useEffect(() => {
    setDateRange({
      start: new Date(selectedYear, 0, 1),
      end: new Date(selectedYear, 11, 31)
    });
  }, [selectedYear]);

  const fetchSites = async () => {
    try {
      const accessibleSites = getAccessibleSites();
      let sitesSnapshot;
      
      if (accessibleSites.length > 0) {
        const qSites = query(
          collection(db, 'sites'),
          where(documentId(), 'in', accessibleSites)
        );
        sitesSnapshot = await getDocs(qSites);
      } else {
        sitesSnapshot = await getDocs(collection(db, 'sites'));
      }

      const sitesData = sitesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Site[];

      setSites(sitesData);
      // Varsayılan: hiçbir santral seçili olmasın; kullanıcı seçim yaptığında veri çekilir
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Seçili sitelerin id'leri yanında isimlerini de gönder (eşleşme esnekliği için)
      const selectedIdsOrNames = selectedSiteIds.length > 0
        ? Array.from(new Set([
            ...selectedSiteIds,
            ...sites
              .filter(s => selectedSiteIds.includes(s.id!))
              .map(s => s.name)
          ]))
        : undefined;

      const reports = await getProductionReports(
        {
          type: 'custom',
          startDate: dateRange.start,
          endDate: dateRange.end,
        },
        selectedIdsOrNames
      );
      
      // Defensive: Bozuk tarihleri at
      const cleaned = reports.filter(r => r && typeof r.date === 'string' && r.date.length === 10)
      setReportData(cleaned);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const data = reportData.map(report => ({
      'Tarih': new Date(report.date).toLocaleDateString('tr-TR'),
      'Toplam Üretim (kWh)': report.summary.totalProduction.toFixed(2),
      'Ortalama Güç (kW)': report.summary.totalPower.toFixed(2),
      'Aktif Santral': report.summary.activeSites,
      'Toplam Santral': report.summary.totalSites,
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Üretim Raporu');
    
    const filename = `SolarVeyo_Rapor_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const handleImportData = async (data: any[]) => {
    if (!user) return;
    
    const normalizeDate = (raw: any): string | null => {
      if (!raw) return null;
      if (raw instanceof Date) {
        const y = raw.getFullYear();
        const m = String(raw.getMonth() + 1).padStart(2, '0');
        const d = String(raw.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      const s = String(raw).trim();
      const m1 = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
      if (m1) {
        const d = m1[1].padStart(2, '0');
        const m = m1[2].padStart(2, '0');
        const y = m1[3];
        return `${y}-${m}-${d}`;
      }
      const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m2) return s;
      const n = Number(s);
      if (!Number.isNaN(n) && n > 20000) {
        const d = new Date(Math.round((n - 25569) * 86400 * 1000));
        const y = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${mm}-${dd}`;
      }
      return null;
    };

    // Transform data for import service
    const transformedData = data.flatMap(row => {
      const dateRaw = row.Tarih ?? row.tarih ?? row.Date ?? row.date;
      const date = normalizeDate(dateRaw);
      if (!date) return [];
      
      return Object.entries(row)
        .filter(([key]) => !['Tarih', 'tarih', 'Date', 'date'].includes(key))
        .map(([siteName, production]) => {
          const value = typeof production === 'string' 
            ? Number(String(production).replace(/\./g, '').replace(',', '.'))
            : Number(production);
          return {
            date,
            siteName: String(siteName).trim(),
            dailyProduction: Number.isFinite(value) ? value : 0,
            siteId: String(siteName).toLowerCase().trim().replace(/\s+/g, '_'),
          };
        });
    });

    if (transformedData.length === 0) {
      console.error('Excel data parse failed: no valid rows');
      return;
    }

    await importExcelDataUnified(transformedData, user.uid);
    await fetchReportData(); // Refresh data
    await calculateYearlyPerformance(); // Refresh yearly performance
  };

  const calculateYearlyPerformance = async () => {
    if (selectedSiteIds.length === 0 || sites.length === 0) {
      setYearlyPerformance(undefined);
      return;
    }

    try {
      // Yıllık performans için TÜM yılın verilerini almamız gerekiyor
      // Mevcut reportData tarih aralığına göre filtrelenmiş olabilir
      const yearlySelected = selectedSiteIds.length > 0
        ? Array.from(new Set([
            ...selectedSiteIds,
            ...sites
              .filter(s => selectedSiteIds.includes(s.id!))
              .map(s => s.name)
          ]))
        : undefined;

      const yearlyReports = await getProductionReports(
        {
          type: 'custom',
          startDate: new Date(selectedYear, 0, 1),
          endDate: new Date(selectedYear, 11, 31),
        },
        yearlySelected
      );

      // 1) Gerçekleşen: tüm yılın toplamı
      const totalActual = yearlyReports
        .filter(r => new Date(r.date).getFullYear() === selectedYear)
        .reduce((sum, r) => sum + (r.summary.totalProduction || 0), 0);

      // 2) Tahmin: production_estimates'den sadece seçili siteler için 12 ayı paralel oku
      const months = Array.from({ length: 12 }, (_, i) => i + 1);
      const monthEstimates = await Promise.all(months.map(async (m) => {
        const list = await ProductionEstimatesService.getMonthlyEstimatesForSiteIds(m, selectedSiteIds);
        return list.reduce((s, e) => s + (e.estimatedProductionKWh || 0), 0);
      }));
      const totalEstimated = monthEstimates.reduce((a, b) => a + b, 0);
      
      if (totalEstimated > 0) {
        setYearlyPerformance((totalActual / totalEstimated) * 100);
      } else {
        setYearlyPerformance(undefined);
      }
    } catch (error) {
      console.error('Error calculating yearly performance:', error);
      setYearlyPerformance(undefined);
    }
  };

  // Calculate statistics
  const totalProduction = reportData.reduce(
    (sum, report) => sum + report.summary.totalProduction,
    0
  );
  
  const averageDailyProduction = reportData.length > 0
    ? totalProduction / reportData.length
    : 0;
  
  const bestDay = reportData.reduce(
    (best, report) => {
      if (!best || report.summary.totalProduction > best.production) {
        return {
          date: report.date,
          production: report.summary.totalProduction,
        };
      }
      return best;
    },
    null as { date: string; production: number } | null
  );
  
  const activeDays = reportData.filter(
    report => report.summary.totalProduction > 0
  ).length;
  
  const co2Saved = totalProduction * 0.4; // kg CO2 per kWh

  // Prepare chart data
  const chartData = reportData.map(report => ({
    date: report.date,
    production: report.summary.totalProduction,
    label: new Date(report.date).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
    }),
  })).reverse();

  // Prepare table data
  const tableData = reportData.map(report => ({
    date: report.date,
    totalProduction: report.summary.totalProduction,
    averagePower: report.summary.totalPower,
    activeSites: report.summary.activeSites,
    totalSites: report.summary.totalSites,
    efficiency: report.summary.averageEfficiency,
  }));

  return (
    <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3 } }}>
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
          justifyContent="space-between" 
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Box>
            <Typography 
              variant={isMobile ? "h5" : "h4"} 
              sx={{ 
                fontWeight: 700, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                mb: 1
              }}
            >
              <Assessment sx={{ fontSize: { xs: 28, sm: 32 } }} color="primary" />
              Üretim Raporları
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Santrallerinizin üretim performansını analiz edin
            </Typography>
          </Box>
          
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={{ xs: 1, sm: 2 }}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            <Button
              variant="outlined"
              startIcon={<History />}
              onClick={() => setShowImportDialog(true)}
              fullWidth={isMobile}
              size={isMobile ? "small" : "medium"}
            >
              Geçmiş Veri
            </Button>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={fetchReportData}
              disabled={loading || selectedSiteIds.length === 0}
              fullWidth={isMobile}
              size={isMobile ? "small" : "medium"}
            >
              Yenile
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Loading */}
      {loading && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress />
        </Box>
      )}

      {/* Filters Section */}
      <ReportFilters
        sites={sites}
        selectedSiteIds={selectedSiteIds}
        onSiteSelectionChange={setSelectedSiteIds}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        onExport={handleExport}
        loading={loading}
      />

      {/* Main Content */}
      <Box>
        {reportData.length > 0 ? (
          <>
            {/* Stats Cards */}
            <ReportStats
              totalProduction={totalProduction}
              averageDailyProduction={averageDailyProduction}
              bestDay={bestDay}
              activeDays={activeDays}
              totalDays={reportData.length}
              co2Saved={co2Saved}
              yearlyPerformance={yearlyPerformance}
            />

            {/* Tabs */}
            <Paper sx={{ mb: 2, borderRadius: 2 }}>
              <Tabs 
                value={activeTab} 
                onChange={(_, value) => setActiveTab(value)}
                variant={isMobile ? "fullWidth" : "standard"}
                sx={{
                  '& .MuiTab-root': {
                    minHeight: { xs: 48, sm: 64 },
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                  }
                }}
              >
                <Tab 
                  label={isMobile ? "Grafik" : "Grafik Görünümü"} 
                  icon={<TrendingUp />}
                  iconPosition="start"
                />
                <Tab 
                  label={isMobile ? "Tablo" : "Tablo Görünümü"} 
                  icon={<Assessment />}
                  iconPosition="start"
                />
              </Tabs>
            </Paper>
            
            {/* Tab Panels */}
            <TabPanel value={activeTab} index={0}>
              <ReportChart 
                data={chartData} 
                sites={sites}
                selectedSiteIds={selectedSiteIds}
                selectedYear={selectedYear}
                title="Üretim Analizi" 
              />
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <MonthlyReportTable 
                reportData={tableData}
                sites={sites}
                selectedSiteIds={selectedSiteIds}
                selectedYear={selectedYear}
              />
            </TabPanel>
          </>
        ) : !loading ? (
          <Alert 
            severity="info" 
            sx={{ 
              borderRadius: 2,
              '& .MuiAlert-message': {
                width: '100%',
              }
            }}
          >
            <Typography variant="h6" gutterBottom>
              Veri Bulunamadı
            </Typography>
            <Typography variant="body2">
              Seçilen tarih aralığı ve santraller için üretim verisi bulunamadı.
              Filtrelerinizi değiştirerek tekrar deneyebilirsiniz.
            </Typography>
          </Alert>
        ) : null}
      </Box>

      {/* Import Dialog */}
      <DataImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImport={handleImportData}
        sites={sites}
      />
    </Container>
  );
}