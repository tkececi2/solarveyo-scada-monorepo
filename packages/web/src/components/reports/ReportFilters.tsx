import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  useTheme,
  useMediaQuery,
  Collapse,
} from '@mui/material';
import {
  FilterList,
  Clear,
  Download,
  Today,
  DateRange,
  CheckBox,
  ClearAll,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { Site } from '@/types';

interface ReportFiltersProps {
  sites: Site[];
  selectedSiteIds: string[];
  onSiteSelectionChange: (siteIds: string[]) => void;
  dateRange: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
  selectedYear: number;
  onYearChange: (year: number) => void;
  onExport: () => void;
  loading?: boolean;
}

export default function ReportFilters({
  sites,
  selectedSiteIds,
  onSiteSelectionChange,
  dateRange,
  onDateRangeChange,
  selectedYear,
  onYearChange,
  onExport,
  loading = false,
}: ReportFiltersProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [quickDateFilter, setQuickDateFilter] = useState<string>('this-month');
  const [showAllSites, setShowAllSites] = useState(false);
  const [expandedSection, setExpandedSection] = useState(true);

  // Hızlı tarih filtreleri
  const handleQuickDateChange = (value: string) => {
    setQuickDateFilter(value);
    const now = new Date();
    let start: Date, end: Date;

    switch (value) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        start = new Date(yesterday.setHours(0, 0, 0, 0));
        end = new Date(yesterday.setHours(23, 59, 59, 999));
        break;
      case 'last-7-days':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        end = new Date();
        break;
      case 'this-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date();
        break;
      case 'last-month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last-3-months':
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        end = new Date();
        break;
      case 'last-year':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      case 'this-year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date();
        break;
      default:
        return;
    }

    onDateRangeChange({ start, end });
  };

  // Santral seçimi
  const handleSiteToggle = (siteId: string) => {
    const newSelection = selectedSiteIds.includes(siteId)
      ? selectedSiteIds.filter(id => id !== siteId)
      : [...selectedSiteIds, siteId];
    onSiteSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    onSiteSelectionChange(sites.map(s => s.id!));
  };

  const handleClearAll = () => {
    onSiteSelectionChange([]);
  };

  // Görünecek santral sayısı
  const visibleSitesCount = showAllSites ? sites.length : Math.min(sites.length, isMobile ? 5 : 10);

  return (
    <Card sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
      {/* Üst Başlık ve Aksiyon Butonları */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 2,
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 2, sm: 0 },
        }}
      >
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            cursor: isMobile ? 'pointer' : 'default',
            width: { xs: '100%', sm: 'auto' },
          }}
          onClick={() => isMobile && setExpandedSection(!expandedSection)}
        >
          <FilterList color="primary" />
          <Typography variant="h6">Filtreler</Typography>
          {isMobile && (
            <IconButton size="small" sx={{ ml: 'auto' }}>
              {expandedSection ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </Box>
        
        <Button
          variant="contained"
          startIcon={<Download />}
          onClick={onExport}
          disabled={loading || selectedSiteIds.length === 0}
          size={isMobile ? "small" : "medium"}
          fullWidth={isMobile}
        >
          Excel İndir
        </Button>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Collapse in={!isMobile || expandedSection}>
        {/* Filtre Satırı */}
        <Stack 
          direction={{ xs: 'column', md: 'row' }} 
          spacing={{ xs: 2, md: 3 }}
          alignItems={{ xs: 'stretch', md: 'flex-start' }}
        >
          {/* Yıl Seçimi */}
          <Box sx={{ minWidth: { xs: '100%', md: 120 } }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Yıl Seçimi
            </Typography>
            <FormControl fullWidth size="small">
              <Select
                value={selectedYear}
                onChange={(e) => onYearChange(Number(e.target.value))}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {!isMobile && <Divider orientation="vertical" flexItem />}

          {/* Santral Seçimi */}
          <Box sx={{ flex: 1, width: '100%' }}>
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between', 
                alignItems: { xs: 'flex-start', sm: 'center' }, 
                mb: 1,
                gap: { xs: 1, sm: 0 },
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Santraller ({selectedSiteIds.length}/{sites.length} seçili)
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button 
                  size="small" 
                  onClick={handleSelectAll}
                  startIcon={!isMobile && <CheckBox />}
                  variant="text"
                >
                  {isMobile ? 'Tümü' : 'Tümünü Seç'}
                </Button>
                <Button 
                  size="small" 
                  onClick={handleClearAll} 
                  color="error"
                  startIcon={!isMobile && <ClearAll />}
                  variant="text"
                  disabled={selectedSiteIds.length === 0}
                >
                  Temizle
                </Button>
              </Stack>
            </Box>
            
            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: { xs: 0.5, sm: 1 },
            }}>
              {sites.slice(0, visibleSitesCount).map((site) => (
                <Chip
                  key={site.id}
                  label={site.name}
                  size={isMobile ? "small" : "medium"}
                  color={selectedSiteIds.includes(site.id!) ? "primary" : "default"}
                  variant={selectedSiteIds.includes(site.id!) ? "filled" : "outlined"}
                  onClick={() => handleSiteToggle(site.id!)}
                  sx={{ 
                    cursor: 'pointer',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: 1,
                    },
                    transition: 'all 0.2s ease',
                  }}
                />
              ))}
              
              {sites.length > visibleSitesCount && (
                <Chip
                  label={showAllSites ? "Daha Az" : `+${sites.length - visibleSitesCount} daha`}
                  size={isMobile ? "small" : "medium"}
                  color="secondary"
                  variant="outlined"
                  onClick={() => setShowAllSites(!showAllSites)}
                  sx={{ 
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  }}
                />
              )}
            </Box>
          </Box>
        </Stack>
      </Collapse>
    </Card>
  );
}