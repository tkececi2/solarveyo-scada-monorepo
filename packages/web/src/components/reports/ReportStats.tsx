import React from 'react';
import { Box, Card, Typography, Stack, LinearProgress, useTheme, useMediaQuery, Grid } from '@mui/material';
import {
  BatteryChargingFull,
  TrendingUp,
  CalendarMonth,
  Speed,
  WbSunny,
  Nature,
  Analytics,
} from '@mui/icons-material';

interface ReportStatsProps {
  totalProduction: number; // kWh
  averageDailyProduction: number; // kWh
  bestDay: { date: string; production: number } | null;
  activeDays: number;
  totalDays: number;
  co2Saved: number; // kg
  yearlyPerformance?: number; // percentage
}

export default function ReportStats({
  totalProduction,
  averageDailyProduction,
  bestDay,
  activeDays,
  totalDays,
  co2Saved,
  yearlyPerformance,
}: ReportStatsProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const stats = [
    {
      icon: <BatteryChargingFull sx={{ fontSize: 24 }} />,
      label: 'Toplam Üretim',
      value: `${(totalProduction / 1000).toFixed(1)} MWh`,
      color: 'primary.main',
    },
    {
      icon: <Speed sx={{ fontSize: 24 }} />,
      label: 'Günlük Ortalama',
      value: `${(averageDailyProduction / 1000).toFixed(1)} MWh`,
      color: 'info.main',
    },
    {
      icon: <TrendingUp sx={{ fontSize: 24 }} />,
      label: 'En İyi Gün',
      value: bestDay ? `${(bestDay.production / 1000).toFixed(1)} MWh` : '-',
      subtitle: bestDay ? new Date(bestDay.date).toLocaleDateString('tr-TR') : '',
      color: 'success.main',
    },
    {
      icon: <CalendarMonth sx={{ fontSize: 24 }} />,
      label: 'Aktif Gün',
      value: `${activeDays} / ${totalDays}`,
      color: 'warning.main',
    },
    {
      icon: <Nature sx={{ fontSize: 24 }} />,
      label: 'CO₂ Tasarrufu',
      value: `${(co2Saved / 1000).toFixed(1)} ton`,
      color: 'success.main',
    },
  ];

  // Yıllık gerçekleşme özel kart olarak gösterilecek

  return (
    <Stack spacing={isMobile ? 2 : 3}>
      {isMobile ? (
        <Grid container spacing={1.5}>
          {stats.map((stat, index) => (
            <Grid item xs={6} key={index}>
              <Card
                sx={{
                  p: 1.5,
                  height: '100%',
                  background: 'linear-gradient(135deg, #fff 0%, #f5f5f5 100%)',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3,
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Box sx={{ color: stat.color, mr: 0.5 }}>{React.cloneElement(stat.icon, { sx: { fontSize: 18 } })}</Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {stat.label}
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                  {stat.value}
                </Typography>
                {stat.subtitle && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    {stat.subtitle}
                  </Typography>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 1 }}>
          {stats.map((stat, index) => (
            <Card
              key={index}
              sx={{
                p: isTablet ? 1.5 : 2,
                minWidth: isTablet ? 150 : 180,
                flex: 1,
                background: 'linear-gradient(135deg, #fff 0%, #f5f5f5 100%)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                },
                transition: 'all 0.3s ease',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box sx={{ color: stat.color, mr: 1 }}>{stat.icon}</Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: isTablet ? '0.8rem' : '0.875rem' }}>
                  {stat.label}
                </Typography>
              </Box>
              <Typography variant={isTablet ? "h6" : "h5"} sx={{ fontWeight: 700 }}>
                {stat.value}
              </Typography>
              {stat.subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {stat.subtitle}
                </Typography>
              )}
            </Card>
          ))}
        </Stack>
      )}

      {/* Yıllık Gerçekleşme Özel Kartı */}
      {yearlyPerformance !== undefined && (
        <Card
          sx={{
            p: isMobile ? 2 : 3,
            background: 'linear-gradient(135deg, #fff 0%, #f9f9f9 100%)',
            borderRadius: 2,
            boxShadow: 2,
            '&:hover': {
              boxShadow: 4,
            },
            transition: 'all 0.3s ease',
          }}
        >
          <Box sx={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center', 
            justifyContent: 'space-between', 
            mb: 2,
            gap: isMobile ? 1 : 0
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Analytics 
                sx={{ 
                  fontSize: isMobile ? 24 : 32, 
                  mr: isMobile ? 1 : 2,
                  color: yearlyPerformance >= 100 ? 'success.main' : 
                         yearlyPerformance >= 90 ? 'warning.main' : 'error.main'
                }} 
              />
              <Box>
                <Typography variant={isMobile ? "subtitle1" : "h6"} sx={{ fontWeight: 600 }}>
                  Yıllık Gerçekleşme Oranı
                </Typography>
                <Typography variant={isMobile ? "caption" : "body2"} color="text.secondary">
                  Tahmine göre üretim performansı
                </Typography>
              </Box>
            </Box>
            <Typography 
              variant={isMobile ? "h4" : "h3"} 
              sx={{ 
                fontWeight: 700,
                color: yearlyPerformance >= 100 ? 'success.main' : 
                       yearlyPerformance >= 90 ? 'warning.main' : 'error.main',
                alignSelf: isMobile ? 'flex-end' : 'auto'
              }}
            >
              %{yearlyPerformance.toFixed(1)}
            </Typography>
          </Box>

          {/* Progress Bar */}
          <Box sx={{ position: 'relative' }}>
            <LinearProgress 
              variant="determinate" 
              value={Math.min(yearlyPerformance, 100)} 
              sx={{
                height: 20,
                borderRadius: 10,
                backgroundColor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 10,
                  background: yearlyPerformance >= 100 ? 
                    'linear-gradient(90deg, #4caf50 0%, #81c784 100%)' : 
                    yearlyPerformance >= 90 ? 
                    'linear-gradient(90deg, #ff9800 0%, #ffb74d 100%)' : 
                    'linear-gradient(90deg, #f44336 0%, #e57373 100%)',
                },
              }}
            />
            {yearlyPerformance > 100 && (
              <Typography 
                variant="caption" 
                sx={{ 
                  position: 'absolute',
                  right: 0,
                  top: -20,
                  color: 'success.main',
                  fontWeight: 600
                }}
              >
                +%{(yearlyPerformance - 100).toFixed(1)} fazla
              </Typography>
            )}
          </Box>

          {/* Alt Bilgi */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {yearlyPerformance >= 100 ? 
                '🎉 Hedefin üzerinde performans!' : 
                yearlyPerformance >= 90 ? 
                '👍 İyi performans gösteriliyor' : 
                '⚠️ Hedefin altında performans'}
            </Typography>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">
                Hedef: %100
              </Typography>
            </Box>
          </Box>
        </Card>
      )}
    </Stack>
  );
}
