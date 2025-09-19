import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  LinearProgress,
  useTheme,
  useMediaQuery,
  Paper,
  Stack,
  Divider,
} from '@mui/material';
import { 
  TableChart, 
  TrendingUp,
  TrendingDown,
  CheckCircle,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import { ProductionEstimatesService } from '@/services/productionEstimatesService';

interface MonthlyData {
  month: number;
  monthName: string;
  production: number; // kWh
  estimate: number; // kWh
  performancePercentage: number;
  status: 'above_target' | 'on_track' | 'below_target' | 'no_data';
}

interface MonthlyReportTableProps {
  reportData: Array<{
    date: string;
    totalProduction: number;
    averagePower: number;
    activeSites: number;
    totalSites: number;
  }>;
  sites: Array<{ id: string; name: string }>;
  selectedSiteIds: string[];
  selectedYear: number;
}

export default function MonthlyReportTable({ 
  reportData,
  sites,
  selectedSiteIds,
  selectedYear
}: MonthlyReportTableProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    aggregateMonthlyData();
  }, [reportData, selectedSiteIds, selectedYear]);

  const aggregateMonthlyData = async () => {
    setLoading(true);
    
    // Aylık verileri topla
    const monthlyProduction: { [month: number]: number } = {};
    
    reportData.forEach(report => {
      const date = new Date(report.date);
      if (date.getFullYear() === selectedYear) {
        const month = date.getMonth() + 1;
        if (!monthlyProduction[month]) {
          monthlyProduction[month] = 0;
        }
        monthlyProduction[month] += report.totalProduction;
      }
    });

    // Tahminleri al (production_estimates) – 12 ayı paralel ve yalnızca seçili siteler için
    const monthNames = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];

    // Ay bazlı tahminleri paralel oku
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const monthsEstimates = await Promise.all(months.map(async (m) => {
      if (selectedSiteIds.length === 0) return 0;
      const est = await ProductionEstimatesService.getMonthlyEstimatesForSiteIds(m, selectedSiteIds);
      return est.reduce((sum, e) => sum + (e.estimatedProductionKWh || 0), 0);
    }));

    const data: MonthlyData[] = months.map((month, idx) => {
      const estimate = monthsEstimates[idx] || 0;
      const production = monthlyProduction[month] || 0;
      let performancePercentage = 0;
      let status: MonthlyData['status'] = 'no_data';
      if (production > 0 && estimate > 0) {
        performancePercentage = (production / estimate) * 100;
        if (performancePercentage >= 110) status = 'above_target';
        else if (performancePercentage >= 90) status = 'on_track';
        else status = 'below_target';
      }
      return {
        month,
        monthName: monthNames[month - 1],
        production,
        estimate,
        performancePercentage,
        status,
      };
    });

    setMonthlyData(data);
    setLoading(false);
  };

  const getStatusIcon = (status: MonthlyData['status']) => {
    switch (status) {
      case 'above_target':
        return <TrendingUp sx={{ color: 'success.main', fontSize: 20 }} />;
      case 'on_track':
        return <CheckCircle sx={{ color: 'info.main', fontSize: 20 }} />;
      case 'below_target':
        return <TrendingDown sx={{ color: 'error.main', fontSize: 20 }} />;
      default:
        return null;
    }
  };

  const getStatusChip = (status: MonthlyData['status'], percentage: number) => {
    if (status === 'no_data') {
      return <Chip label="Veri Yok" size="small" variant="outlined" />;
    }
    
    const color = status === 'above_target' ? 'success' : 
                  status === 'on_track' ? 'info' : 'error';
    
    return (
      <Chip 
        label={`%${percentage.toFixed(1)}`}
        size="small" 
        color={color}
        icon={getStatusIcon(status) as any}
      />
    );
  };

  // Yıllık toplamlar
  const yearlyTotal = monthlyData.reduce((sum, m) => sum + m.production, 0);
  const yearlyEstimate = monthlyData.reduce((sum, m) => sum + m.estimate, 0);
  const yearlyPerformance = yearlyEstimate > 0 ? (yearlyTotal / yearlyEstimate) * 100 : 0;

  // Mobil için kart görünümü
  const MobileCard = ({ row }: { row: MonthlyData }) => (
    <Paper sx={{ p: 2, mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {row.monthName}
        </Typography>
        {getStatusChip(row.status, row.performancePercentage)}
      </Box>
      
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Gerçekleşen:</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
            {(row.production / 1000).toFixed(2)} MWh
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Tahmin:</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
            {(row.estimate / 1000).toFixed(2)} MWh
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Fark:</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 600,
                color: row.production - row.estimate > 0 ? 'success.main' : 'error.main'
              }}
            >
              {row.estimate > 0 ? ((row.production - row.estimate) / 1000).toFixed(2) : '-'} MWh
            </Typography>
            {row.estimate > 0 && (
              row.production - row.estimate > 0 
                ? <ArrowUpward sx={{ fontSize: 16, color: 'success.main' }} />
                : <ArrowDownward sx={{ fontSize: 16, color: 'error.main' }} />
            )}
          </Box>
        </Box>
      </Stack>
    </Paper>
  );

  return (
    <Card>
      <CardContent sx={{ p: isMobile ? 2 : 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <TableChart sx={{ mr: 1, fontSize: isMobile ? 20 : 24 }} color="primary" />
          <Typography variant={isMobile ? "subtitle1" : "h6"} sx={{ fontWeight: 600 }}>
            {selectedYear} Yılı Aylık Üretim
          </Typography>
        </Box>

        {loading ? (
          <LinearProgress />
        ) : (
          <>
            {isMobile ? (
              // Mobil Görünüm - Kartlar
              <Box>
                {monthlyData.map((row) => (
                  <MobileCard key={row.month} row={row} />
                ))}
                
                {/* Yıllık Toplam Kartı */}
                <Paper sx={{ 
                  p: 2, 
                  mt: 2, 
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.primary.main}05 100%)`,
                  border: `2px solid ${theme.palette.primary.main}`
                }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, textAlign: 'center' }}>
                    YILLIK TOPLAM
                  </Typography>
                  
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Toplam Üretim:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: 'success.main' }}>
                        {(yearlyTotal / 1000).toFixed(2)} MWh
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Toplam Tahmin:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {(yearlyEstimate / 1000).toFixed(2)} MWh
                      </Typography>
                    </Box>
                    
                    <Divider sx={{ my: 1 }} />
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Performans:</Typography>
                      <Chip 
                        label={`%${yearlyPerformance.toFixed(1)}`}
                        color={yearlyPerformance >= 100 ? 'success' : 'error'}
                        sx={{ fontWeight: 700 }}
                        size="medium"
                      />
                    </Box>
                  </Stack>
                </Paper>
              </Box>
            ) : (
              // Desktop/Tablet Görünüm - Tablo
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size={isTablet ? "small" : "medium"}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Ay</TableCell>
                      <TableCell align="right">Gerçekleşen (MWh)</TableCell>
                      {!isTablet && <TableCell align="right">Tahmin (MWh)</TableCell>}
                      <TableCell align="right">Fark (MWh)</TableCell>
                      <TableCell align="center">Performans</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthlyData.map((row) => (
                      <TableRow 
                        key={row.month} 
                        hover
                        sx={{
                          bgcolor: row.status === 'no_data' && row.production === 0 ? 'grey.50' : 'inherit'
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {row.monthName}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 600, 
                              color: row.production > 0 ? 'success.main' : 'text.secondary' 
                            }}
                          >
                            {(row.production / 1000).toFixed(2)}
                          </Typography>
                        </TableCell>
                        {!isTablet && (
                          <TableCell align="right">
                            <Typography variant="body2" color="primary">
                              {(row.estimate / 1000).toFixed(2)}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell align="right">
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 500,
                              color: row.production - row.estimate > 0 ? 'success.main' : 'error.main'
                            }}
                          >
                            {row.estimate > 0 ? (
                              <>
                                {((row.production - row.estimate) / 1000).toFixed(2)}
                                {row.production - row.estimate > 0 ? ' ↑' : ' ↓'}
                              </>
                            ) : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {getStatusChip(row.status, row.performancePercentage)}
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Yıllık Toplam */}
                    <TableRow sx={{ bgcolor: 'primary.50' }}>
                      <TableCell>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          TOPLAM
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'success.main' }}>
                          {(yearlyTotal / 1000).toFixed(2)}
                        </Typography>
                      </TableCell>
                      {!isTablet && (
                        <TableCell align="right">
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {(yearlyEstimate / 1000).toFixed(2)}
                          </Typography>
                        </TableCell>
                      )}
                      <TableCell align="right">
                        <Typography 
                          variant="subtitle1" 
                          sx={{ 
                            fontWeight: 700,
                            color: yearlyTotal - yearlyEstimate > 0 ? 'success.main' : 'error.main'
                          }}
                        >
                          {((yearlyTotal - yearlyEstimate) / 1000).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={`%${yearlyPerformance.toFixed(1)}`}
                          color={yearlyPerformance >= 100 ? 'success' : 'error'}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
