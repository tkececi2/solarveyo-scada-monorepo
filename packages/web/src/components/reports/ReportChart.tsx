import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  ButtonGroup,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  FormControlLabel,
  Switch,
  LinearProgress,
  useTheme,
  useMediaQuery,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  ShowChart,
  BarChart,
  Timeline,
  TrendingUp,
  CalendarMonth,
  CalendarToday,
  MoreVert,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

import { ProductionEstimatesService } from '@/services/productionEstimatesService';


interface ChartDataPoint {
  date: string;
  production: number;
  estimate?: number;
  label: string;
}

interface ReportChartProps {
  data: ChartDataPoint[];
  sites: Array<{ id: string; name: string }>;
  selectedSiteIds: string[];
  selectedYear: number;
  title?: string;
  height?: number;
}

type ChartType = 'area' | 'bar' | 'line' | 'composed';
type ViewType = 'daily' | 'monthly' | 'yearly';

export default function ReportChart({ 
  data, 
  sites,
  selectedSiteIds,
  selectedYear,
  title = 'Üretim Analizi',
  height = 400 
}: ReportChartProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [chartType, setChartType] = useState<ChartType>('area');
  const [viewType, setViewType] = useState<ViewType>('monthly');
  const [showEstimates, setShowEstimates] = useState(true);
  const [aggregatedData, setAggregatedData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  
  // Cache: month (1-12) -> Map<siteId, estimatedKWh>
  const estimatesCacheRef = useRef<Map<number, Map<string, number>>>(new Map());

  const getMonthEstimatesMap = async (month: number): Promise<Map<string, number>> => {
    const cache = estimatesCacheRef.current;
    if (!cache.has(month)) {
      const estimates = await ProductionEstimatesService.getMonthlyEstimatesForAllSites(month);
      const monthMap = new Map<string, number>();
      estimates.forEach(e => monthMap.set(e.siteId, e.estimatedProductionKWh || 0));
      cache.set(month, monthMap);
    }
    // non-null because we just set it above if absent
    return cache.get(month)!;
  };

  useEffect(() => {
    aggregateData();
  }, [data, viewType, showEstimates, selectedSiteIds, selectedYear]);

  const aggregateData = async () => {
    setLoading(true);
    
    if (viewType === 'daily') {
      // Günlük görünümde sadece seçilen yılın verilerini göster
      const filteredData = data.filter(point => {
        const date = new Date(point.date);
        return date.getFullYear() === selectedYear;
      });
      setAggregatedData(filteredData);
      setLoading(false);
      return;
    }

    const aggregated: { [key: string]: { production: number; estimate: number; count: number } } = {};
    
    // Üretim verilerini topla
    data.forEach(point => {
      const date = new Date(point.date);
      const year = date.getFullYear();
      
      // Yıllık görünümde tüm yılları, aylık görünümde sadece seçilen yılı göster
      if (viewType === 'yearly' || year === selectedYear) {
        let key: string;
        
        if (viewType === 'monthly') {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
          key = `${date.getFullYear()}`;
        }
        
        if (!aggregated[key]) {
          aggregated[key] = { production: 0, estimate: 0, count: 0 };
        }
        
        aggregated[key].production += point.production;
        aggregated[key].count += 1;
      }
    });

    // Tahminleri ekle (eğer gösterilecekse) - KAYITLI TAHMİNLERDEN
    if (showEstimates && selectedSiteIds.length > 0) {
      if (viewType === 'monthly') {
        // Seçilen yılın 12 ayı için parallel olarak tahminleri oku (cache'li)
        const months = Array.from({ length: 12 }, (_, i) => i + 1);
        // Yalnızca seçili siteIds için sorgu yapalım (in<=10 limiti için batch'li)
        const monthMaps = await Promise.all(months.map(async (m) => {
          const list = await ProductionEstimatesService.getMonthlyEstimatesForSiteIds(m, selectedSiteIds);
          const map = new Map<string, number>();
          list.forEach(e => map.set(e.siteId, e.estimatedProductionKWh || 0));
          return map;
        }));
        months.forEach((month, idx) => {
          const key = `${selectedYear}-${String(month).padStart(2, '0')}`;
          if (!aggregated[key]) {
            aggregated[key] = { production: 0, estimate: 0, count: 0 };
          }
          const map = monthMaps[idx];
          const total = selectedSiteIds.reduce((sum, siteId) => sum + (map.get(siteId) || 0), 0);
          aggregated[key].estimate = total;
        });
      } else if (viewType === 'yearly') {
        // Yıllık görünüm: 12 ayın toplam tahmini (cache'li) – her yıl için aynı değer (tahminler yıl bağımsız)
        const months = Array.from({ length: 12 }, (_, i) => i + 1);
        const monthMaps = await Promise.all(months.map(async (m) => {
          const list = await ProductionEstimatesService.getMonthlyEstimatesForSiteIds(m, selectedSiteIds);
          const map = new Map<string, number>();
          list.forEach(e => map.set(e.siteId, e.estimatedProductionKWh || 0));
          return map;
        }));
        const yearlyTotal = monthMaps.reduce((yearSum, map) => {
          const monthlySum = selectedSiteIds.reduce((sum, siteId) => sum + (map.get(siteId) || 0), 0);
          return yearSum + monthlySum;
        }, 0);
        for (const key of Object.keys(aggregated)) {
          aggregated[key].estimate = yearlyTotal;
        }
      }
    }

    // Format data
    const formatted = Object.entries(aggregated)
      .map(([key, value]) => {
        let label: string;
        if (viewType === 'monthly') {
          const [year, month] = key.split('-');
          label = new Date(Number(year), Number(month) - 1).toLocaleDateString('tr-TR', { 
            month: 'short', 
            year: 'numeric' 
          });
        } else {
          label = key;
        }
        
        return {
          date: key,
          production: value.production,
          estimate: showEstimates ? value.estimate : undefined,
          label,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    
    setAggregatedData(formatted);
    setLoading(false);
  };

  const formatYAxis = (value: number) => `${(value / 1000).toFixed(0)}k`;
  const formatTooltip = (value: number, name: string) => {
    const formatted = `${(value / 1000).toFixed(1)} MWh`;
    if (name === 'production') return [formatted, 'Gerçekleşen'];
    if (name === 'estimate') return [formatted, 'Tahmin'];
    return [formatted, name];
  };

  const renderChart = () => {
    const commonProps = {
      data: aggregatedData,
      margin: isMobile 
        ? { top: 5, right: 5, left: -20, bottom: 40 }
        : { top: 10, right: 30, left: 0, bottom: 0 },
    };

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorProduction" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4caf50" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#4caf50" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorEstimate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2196f3" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#2196f3" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: isMobile ? 10 : 12 }}
              angle={isMobile ? -45 : 0}
              textAnchor={isMobile ? "end" : "middle"}
              height={isMobile ? 60 : 30}
            />
            <YAxis tickFormatter={formatYAxis} tick={{ fontSize: isMobile ? 10 : 12 }} />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            <Area
              type="monotone"
              dataKey="production"
              stroke="#4caf50"
              fillOpacity={1}
              fill="url(#colorProduction)"
              strokeWidth={2}
              name="Gerçekleşen"
            />
            {showEstimates && (
              <Area
                type="monotone"
                dataKey="estimate"
                stroke="#2196f3"
                fillOpacity={1}
                fill="url(#colorEstimate)"
                strokeWidth={2}
                name="Tahmin"
              />
            )}
          </AreaChart>
        );

      case 'bar':
        return (
          <RechartsBarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: isMobile ? 10 : 12 }}
              angle={isMobile ? -45 : 0}
              textAnchor={isMobile ? "end" : "middle"}
              height={isMobile ? 60 : 30}
            />
            <YAxis tickFormatter={formatYAxis} tick={{ fontSize: isMobile ? 10 : 12 }} />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            <Bar dataKey="production" fill="#4caf50" radius={[4, 4, 0, 0]} name="Gerçekleşen" />
            {showEstimates && (
              <Bar dataKey="estimate" fill="#2196f3" radius={[4, 4, 0, 0]} name="Tahmin" />
            )}
          </RechartsBarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: isMobile ? 10 : 12 }}
              angle={isMobile ? -45 : 0}
              textAnchor={isMobile ? "end" : "middle"}
              height={isMobile ? 60 : 30}
            />
            <YAxis tickFormatter={formatYAxis} tick={{ fontSize: isMobile ? 10 : 12 }} />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            <Line
              type="monotone"
              dataKey="production"
              stroke="#4caf50"
              strokeWidth={3}
              dot={{ fill: '#4caf50', strokeWidth: 2, r: 4 }}
              name="Gerçekleşen"
            />
            {showEstimates && (
              <Line
                type="monotone"
                dataKey="estimate"
                stroke="#2196f3"
                strokeWidth={3}
                dot={{ fill: '#2196f3', strokeWidth: 2, r: 4 }}
                name="Tahmin"
                strokeDasharray="5 5"
              />
            )}
          </LineChart>
        );

      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: isMobile ? 10 : 12 }}
              angle={isMobile ? -45 : 0}
              textAnchor={isMobile ? "end" : "middle"}
              height={isMobile ? 60 : 30}
            />
            <YAxis tickFormatter={formatYAxis} tick={{ fontSize: isMobile ? 10 : 12 }} />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            <Bar dataKey="production" fill="#4caf50" radius={[4, 4, 0, 0]} name="Gerçekleşen" />
            {showEstimates && (
              <Line
                type="monotone"
                dataKey="estimate"
                stroke="#ff6b35"
                strokeWidth={3}
                dot={{ fill: '#ff6b35', strokeWidth: 2, r: 4 }}
                name="Tahmin"
              />
            )}
          </ComposedChart>
        );
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: isMobile ? 2 : 3 }}>
        {/* Header */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'flex-start' : 'center', 
          mb: 2,
          gap: isMobile ? 2 : 0
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp color="primary" />
            <Typography variant={isMobile ? "subtitle1" : "h6"} sx={{ fontWeight: 600 }}>
              {title} - {viewType === 'yearly' ? 'Yıllık' : `${selectedYear}`}
            </Typography>
          </Box>
          
          {/* Mobile Menu Button */}
          {isMobile ? (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showEstimates}
                    onChange={(e) => setShowEstimates(e.target.checked)}
                    color="primary"
                    size="small"
                  />
                }
                label={<Typography variant="body2">Tahmin</Typography>}
              />
              <IconButton onClick={(e) => setMenuAnchorEl(e.currentTarget)}>
                <MoreVert />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: isTablet ? 1 : 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showEstimates}
                    onChange={(e) => setShowEstimates(e.target.checked)}
                    color="primary"
                  />
                }
                label="Tahminleri Göster"
              />
              
              <ToggleButtonGroup
                value={viewType}
                exclusive
                onChange={(_, value) => value && setViewType(value)}
                size="small"
              >
                <ToggleButton value="daily">
                  <CalendarToday sx={{ mr: isTablet ? 0 : 0.5, fontSize: 18 }} />
                  {!isTablet && 'Günlük'}
                </ToggleButton>
                <ToggleButton value="monthly">
                  <CalendarMonth sx={{ mr: isTablet ? 0 : 0.5, fontSize: 18 }} />
                  {!isTablet && 'Aylık'}
                </ToggleButton>
                <ToggleButton value="yearly">
                  <CalendarMonth sx={{ mr: isTablet ? 0 : 0.5, fontSize: 18 }} />
                  {!isTablet && 'Yıllık'}
                </ToggleButton>
              </ToggleButtonGroup>
              
              <ButtonGroup size="small" variant="outlined">
                <Button
                  onClick={() => setChartType('area')}
                  variant={chartType === 'area' ? 'contained' : 'outlined'}
                >
                  <Timeline sx={{ fontSize: 20 }} />
                </Button>
                <Button
                  onClick={() => setChartType('bar')}
                  variant={chartType === 'bar' ? 'contained' : 'outlined'}
                >
                  <BarChart sx={{ fontSize: 20 }} />
                </Button>
                <Button
                  onClick={() => setChartType('line')}
                  variant={chartType === 'line' ? 'contained' : 'outlined'}
                >
                  <ShowChart sx={{ fontSize: 20 }} />
                </Button>
                <Button
                  onClick={() => setChartType('composed')}
                  variant={chartType === 'composed' ? 'contained' : 'outlined'}
                  title="Karma Grafik"
                >
                  <BarChart sx={{ fontSize: 20 }} />+
                </Button>
              </ButtonGroup>
            </Box>
          )}
        </Box>
        
        {/* Mobile Menu */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={() => setMenuAnchorEl(null)}
        >
          <MenuItem sx={{ fontWeight: viewType === 'daily' ? 600 : 400 }} onClick={() => { setViewType('daily'); setMenuAnchorEl(null); }}>
            <CalendarToday sx={{ mr: 1, fontSize: 18 }} /> Günlük
          </MenuItem>
          <MenuItem sx={{ fontWeight: viewType === 'monthly' ? 600 : 400 }} onClick={() => { setViewType('monthly'); setMenuAnchorEl(null); }}>
            <CalendarMonth sx={{ mr: 1, fontSize: 18 }} /> Aylık
          </MenuItem>
          <MenuItem sx={{ fontWeight: viewType === 'yearly' ? 600 : 400 }} onClick={() => { setViewType('yearly'); setMenuAnchorEl(null); }}>
            <CalendarMonth sx={{ mr: 1, fontSize: 18 }} /> Yıllık
          </MenuItem>
          <MenuItem divider />
          <MenuItem sx={{ fontWeight: chartType === 'area' ? 600 : 400 }} onClick={() => { setChartType('area'); setMenuAnchorEl(null); }}>
            <Timeline sx={{ mr: 1, fontSize: 18 }} /> Alan Grafik
          </MenuItem>
          <MenuItem sx={{ fontWeight: chartType === 'bar' ? 600 : 400 }} onClick={() => { setChartType('bar'); setMenuAnchorEl(null); }}>
            <BarChart sx={{ mr: 1, fontSize: 18 }} /> Çubuk Grafik
          </MenuItem>
          <MenuItem sx={{ fontWeight: chartType === 'line' ? 600 : 400 }} onClick={() => { setChartType('line'); setMenuAnchorEl(null); }}>
            <ShowChart sx={{ mr: 1, fontSize: 18 }} /> Çizgi Grafik
          </MenuItem>
          <MenuItem sx={{ fontWeight: chartType === 'composed' ? 600 : 400 }} onClick={() => { setChartType('composed'); setMenuAnchorEl(null); }}>
            <BarChart sx={{ mr: 1, fontSize: 18 }} /> Karma Grafik
          </MenuItem>
        </Menu>

        {loading ? (
          <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <LinearProgress sx={{ width: 200, mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Veriler hazırlanıyor...
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ 
            width: '100%', 
            overflowX: isMobile ? 'auto' : 'hidden',
            overflowY: 'hidden',
            '& .recharts-wrapper': {
              cursor: 'move'
            }
          }}>
            <ResponsiveContainer width="100%" height={isMobile ? height * 0.8 : height}>
              {renderChart()}
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}