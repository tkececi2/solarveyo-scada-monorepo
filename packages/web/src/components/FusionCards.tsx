import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Warning,
  Power,
  TrendingUp,
  Thermostat,
  ExpandMore,
  ExpandLess,
  PowerOff,
  Bolt,
  ElectricBolt,
  Memory,
  Visibility,
  VisibilityOff,
  ErrorOutline,
} from '@mui/icons-material';
import { InverterData } from '@/types';
import { subscribeToPVStringStates, setPVStringState } from '@/utils/firestore';
import { formatPower, formatEnergy, formatTemperature, formatCurrent, formatVoltage } from '@/utils/format';
import { useAuth } from '@/contexts/AuthContext';

interface FusionCardsProps {
  data: InverterData[];
}

export default function FusionCards({ data }: FusionCardsProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [pvStates, setPvStates] = useState<Map<string, Map<string, boolean>>>(new Map());
  const [showInactiveStrings, setShowInactiveStrings] = useState<boolean>(false);
  const { user } = useAuth();

  // PV string state tracking
  useEffect(() => {
    const unsubscribeFunctions: (() => void)[] = [];

    data.forEach(inverter => {
      if (inverter.id) {
        const unsubscribe = subscribeToPVStringStates(
          inverter.id,
          (states) => {
            setPvStates(prev => {
              const next = new Map(prev);
              next.set(inverter.id!, states);
              return next;
            });
          }
        );
        unsubscribeFunctions.push(unsubscribe);
      }
    });

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [data]);

  const getStatusIcon = (status: string | number | undefined) => {
    const statusLower = (status?.toString().toLowerCase()) || '';
    if (statusLower.includes('normal') || statusLower.includes('run') || statusLower.includes('ok')) {
      return <CheckCircle sx={{ color: 'success.main' }} />;
    } else if (statusLower.includes('fault') || statusLower.includes('error')) {
      return <Cancel sx={{ color: 'error.main' }} />;
    } else if (statusLower.includes('alarm') || statusLower.includes('warn')) {
      return <Warning sx={{ color: 'warning.main' }} />;
    }
    return <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: 'grey.400' }} />;
  };

  const getStatusColor = (status: string | number | undefined): 'success' | 'error' | 'warning' | 'default' => {
    const statusLower = (status?.toString().toLowerCase()) || '';
    if (statusLower.includes('normal') || statusLower.includes('run') || statusLower.includes('ok')) {
      return 'success';
    } else if (statusLower.includes('fault') || statusLower.includes('error')) {
      return 'error';
    } else if (statusLower.includes('alarm') || statusLower.includes('warn')) {
      return 'warning';
    }
    return 'default';
  };

  const toggleCard = (inverterId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(inverterId)) {
        next.delete(inverterId);
      } else {
        next.add(inverterId);
      }
      return next;
    });
  };

  const handlePVStringToggle = async (inverterId: string, stringKey: string, currentState: boolean) => {
    if (!user?.uid) return;

    try {
      await setPVStringState(inverterId, stringKey, !currentState, user.uid);
    } catch (error) {
      console.error('Error updating PV string state:', error);
    }
  };

  // PV string'leri hiyerarşik sırala (PV1, PV2, PV3...)
  const sortPVStrings = (entries: [string, any][]) => {
    return entries.sort((a, b) => {
      const [keyA] = a;
      const [keyB] = b;
      
      // PV numarasını çıkar (PV1 → 1, PV25 → 25)
      const getNumFromPV = (key: string): number => {
        const match = key.match(/PV(\d+)/i);
        return match ? parseInt(match[1], 10) : 9999;
      };
      
      return getNumFromPV(keyA) - getNumFromPV(keyB);
    });
  };

  // İnverter kartlarını sayısal sıraya göre sırala
  const sortedData = [...data].sort((a, b) => {
    const getInverterNumber = (name: string): number => {
      const match = name.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 9999;
    };
    
    const numA = getInverterNumber(a.name);
    const numB = getInverterNumber(b.name);
    
    return numA - numB;
  });

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
        Inverter Detay Kartları ({sortedData.length} adet)
      </Typography>
      
      <Grid container spacing={3}>
        {sortedData.map((inverter) => {
          const isExpanded = expandedCards.has(inverter.id || '');
          const pvStringStates = pvStates.get(inverter.id || '') || new Map();
          
          return (
            <Grid item xs={12} md={6} lg={4} key={inverter.id}>
              <Card>
                <CardContent>
                  {/* Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Memory color="primary" />
                      <Typography variant="h6" component="h3">
                        {inverter.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getStatusIcon(inverter.status)}
                      <IconButton
                        onClick={() => toggleCard(inverter.id || '')}
                        size="small"
                      >
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Status */}
                  <Chip
                    label={inverter.status || 'Unknown'}
                    color={getStatusColor(inverter.status)}
                    size="small"
                    sx={{ mb: 2 }}
                  />

                  {/* Main Stats */}
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Power sx={{ fontSize: 16, mr: 1, color: 'primary.main' }} />
                        <Typography variant="body2" color="text.secondary">
                          AC Güç
                        </Typography>
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {formatPower(inverter.activePower || 0)}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Thermostat sx={{ fontSize: 16, mr: 1, color: 'warning.main' }} />
                        <Typography variant="body2" color="text.secondary">
                          Sıcaklık
                        </Typography>
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'warning.main' }}>
                        {inverter.temperature || inverter.internalTemperature 
                          ? `${(inverter.temperature || inverter.internalTemperature)?.toFixed(1)}°C` 
                          : '-'}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <TrendingUp sx={{ fontSize: 16, mr: 1, color: 'success.main' }} />
                        <Typography variant="body2" color="text.secondary">
                          Günlük Üretim
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main' }}>
                        {formatEnergy(inverter.dailyYield || 0)}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Bolt sx={{ fontSize: 16, mr: 1, color: 'info.main' }} />
                        <Typography variant="body2" color="text.secondary">
                          DC Güç
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: 'info.main' }}>
                        {formatPower(inverter.dcTotalPower || inverter.dcPower || 0)}
                      </Typography>
                    </Grid>
                  </Grid>

                  {/* Toplam Üretim - Ayrı Satır */}
                  <Box sx={{ mb: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Toplam Üretim
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formatEnergy(inverter.totalYield || 0)}
                    </Typography>
                  </Box>

                  {/* PV String Özet - Kart Kapalıyken Görünür */}
                  {(inverter.pvInputs || inverter.mpptData) && (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
                      {(() => {
                        let totalVisibleStrings = 0;
                        let activeStrings = 0;
                        let faultyStrings = 0;
                        
                        const stringStates = pvStates.get(inverter.id!) || new Map();
                        
                        const processStringData = (entries: Array<[string, any]>) => {
                          entries.forEach(([key, pvData]) => {
                            const current = pvData?.current !== undefined ? pvData.current : (pvData?.I !== undefined ? pvData.I : undefined);
                            const voltage = pvData?.voltage !== undefined ? pvData.voltage : (pvData?.V !== undefined ? pvData.V : undefined);
                            
                            if (current !== undefined || voltage !== undefined) {
                              const isManuallyActive = stringStates.get(key) !== false;
                              
                              if (isManuallyActive) {
                                totalVisibleStrings++;
                                const actualCurrent = current || 0;
                                
                                // SADECE AKIM DEĞERİNE BAK - 0 ise pasif/hatalı say
                                if (actualCurrent > 0) {
                                  activeStrings++;
                                } else {
                                  faultyStrings++;
                                }
                              }
                            }
                          });
                        };
                        
                        if (inverter.pvInputs) {
                          processStringData(Object.entries(inverter.pvInputs));
                        } else if (inverter.mpptData) {
                          processStringData(inverter.mpptData);
                        }
                        
                        const hasErrors = faultyStrings > 0;
                        
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ElectricBolt 
                                sx={{ 
                                  fontSize: 16, 
                                  color: hasErrors ? 'warning.main' : 'success.main' 
                                }} 
                              />
                              <Typography variant="body2" sx={{ fontWeight: 600, color: hasErrors ? 'warning.main' : 'inherit' }}>
                                PV Stringler: {activeStrings}/{totalVisibleStrings} aktif
                              </Typography>
                            </Box>
                            {hasErrors && (
                              <Chip 
                                label={`${faultyStrings} pasif`}
                                size="small"
                                color="warning"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                              />
                            )}
                          </Box>
                        );
                      })()}
                    </Box>
                  )}

                  {/* Expandable PV Strings */}
                  <Collapse in={isExpanded}>
                    <Box sx={{ mt: 2 }}>
                      {/* Additional Stats */}
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                        Detaylı Bilgiler
                      </Typography>
                      
                      <Grid container spacing={1} sx={{ mb: 2 }}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Şebeke Frekansı
                          </Typography>
                          <Typography variant="body2">
                            {inverter.gridFrequency ? `${inverter.gridFrequency.toFixed(2)} Hz` : '-'}
                          </Typography>
                        </Grid>
                        
                        {/* AC Akım Bilgileri */}
                        {inverter.phaseData?.currents && (
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                              AC Akım (R/S/T)
                            </Typography>
                            <Typography variant="body2">
                              {formatCurrent(inverter.phaseData.currents.A || 0)} / {formatCurrent(inverter.phaseData.currents.B || 0)} / {formatCurrent(inverter.phaseData.currents.C || 0)}
                            </Typography>
                          </Grid>
                        )}
                        
                        {/* AC Voltaj Bilgileri */}
                        {inverter.phaseData?.voltages && (
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                              AC Voltaj (R/S/T)
                            </Typography>
                            <Typography variant="body2">
                              {formatVoltage(inverter.phaseData.voltages.A || 0)} / {formatVoltage(inverter.phaseData.voltages.B || 0)} / {formatVoltage(inverter.phaseData.voltages.C || 0)}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>

                      {/* PV String Kartları - Debug ve Kontrol */}
                      {(inverter.pvInputs || inverter.mpptData || (inverter as any).mpptData) && (
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            {(() => {
                              let totalVisibleStrings = 0; // Kartada görünen stringler
                              let activeStrings = 0; // Normal çalışan (yeşil)
                              let faultyStrings = 0; // Hatalı (kırmızı)
                              
                              const stringStates = pvStates.get(inverter.id!) || new Map();
                              
                              const processStringData = (entries: Array<[string, any]>) => {
                                entries.forEach(([key, pvData]) => {
                                  // Veri tanımlı mı kontrol et
                                  const current = pvData?.current !== undefined ? pvData.current : (pvData?.I !== undefined ? pvData.I : undefined);
                                  const voltage = pvData?.voltage !== undefined ? pvData.voltage : (pvData?.V !== undefined ? pvData.V : undefined);
                                  
                                  if (current !== undefined || voltage !== undefined) {
                                    // Manuel durum kontrolü - sadece aktif olanları say
                                    const isManuallyActive = stringStates.get(key) !== false;
                                    
                                    if (isManuallyActive) {
                                      totalVisibleStrings++; // Kartada görünen (aktif) stringler
                                      
                                      // Elektriksel durum kontrolü
                                      const actualCurrent = current || 0;
                                      const actualVoltage = voltage || 0;
                                      
                                      if (actualCurrent > 0.5 && actualVoltage > 50) {
                                        activeStrings++; // Normal çalışan (yeşil)
                                      } else {
                                        faultyStrings++; // Hatalı (kırmızı)
                                      }
                                    }
                                  }
                                });
                              };
                              
                              if (inverter.pvInputs) {
                                processStringData(Object.entries(inverter.pvInputs));
                              } else if (inverter.mpptData) {
                                processStringData(inverter.mpptData);
                              }
                              
                              const hasErrors = faultyStrings > 0;
                              const statusText = `${activeStrings}/${totalVisibleStrings} aktif`;
                              
                              return (
                                <Typography variant="subtitle2" sx={{ 
                                  fontWeight: 600, 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 1,
                                  color: hasErrors ? 'error.main' : 'inherit'
                                }}>
                                  <ElectricBolt color={hasErrors ? 'error' : 'primary'} />
                                  PV String Detayları ({statusText})
                                </Typography>
                              );
                            })()}
                            
                            {(() => {
                              const manuallyInactiveStrings = (() => {
                                let count = 0;
                                const stringStates = pvStates.get(inverter.id!) || new Map();
                                if (inverter.pvInputs) {
                                  count = Object.entries(inverter.pvInputs).filter(([key, pvData]) => {
                                    // Sadece veri tanımlı olanlarda manuel pasif kontrol et
                                    const current = pvData?.current || pvData?.I;
                                    const voltage = pvData?.voltage || pvData?.V;
                                    const hasData = current !== undefined || voltage !== undefined;
                                    return hasData && stringStates.get(key) === false; // Veri var VE manuel pasif
                                  }).length;
                                } else if (inverter.mpptData) {
                                  count = inverter.mpptData.filter(([key, pvData]) => {
                                    // Sadece veri tanımlı olanlarda manuel pasif kontrol et
                                    const current = pvData?.current || pvData?.I;
                                    const voltage = pvData?.voltage || pvData?.V;
                                    const hasData = current !== undefined || voltage !== undefined;
                                    return hasData && stringStates.get(key) === false; // Veri var VE manuel pasif
                                  }).length;
                                }
                                return count;
                              })();
                              return manuallyInactiveStrings > 0 ? (
                                <Tooltip title={`${manuallyInactiveStrings} adet string manuel olarak pasife alınmış!`}>
                                  <ErrorOutline color="warning" sx={{ ml: 1, fontSize: 16 }} />
                                </Tooltip>
                              ) : null;
                            })()}
                            
                            <Tooltip title={showInactiveStrings ? 'Pasif stringleri gizle' : 'Pasif stringleri göster'}>
                              <IconButton 
                                size="small" 
                                onClick={() => setShowInactiveStrings(!showInactiveStrings)}
                                color={showInactiveStrings ? 'primary' : 'default'}
                              >
                                {showInactiveStrings ? <Visibility /> : <VisibilityOff />}
                              </IconButton>
                            </Tooltip>
                          </Box>
                          {/* Kompakt PV String Grid - Multi-Column Layout */}
                          <Box>
                            {(() => {
                              // Tüm PV verileri toplanıyor
                              const allPVData: Array<[string, any]> = [];
                              
                              if (inverter.pvInputs) {
                                Object.entries(inverter.pvInputs).forEach(([key, pvData]) => {
                                  const current = pvData?.current !== undefined ? pvData.current : (pvData?.I !== undefined ? pvData.I : undefined);
                                  const voltage = pvData?.voltage !== undefined ? pvData.voltage : (pvData?.V !== undefined ? pvData.V : undefined);
                                  const hasData = current !== undefined || voltage !== undefined;
                                  
                                  if (!hasData) return;
                                  if (!showInactiveStrings) {
                                    const stringStates = pvStates.get(inverter.id!) || new Map();
                                    const isManuallyActive = stringStates.get(key) !== false;
                                    if (!isManuallyActive) return;
                                  }
                                  
                                  allPVData.push([key, pvData]);
                                });
                              } else if (inverter.mpptData) {
                                inverter.mpptData.forEach(([key, pvData]) => {
                                  const current = pvData?.current !== undefined ? pvData.current : (pvData?.I !== undefined ? pvData.I : undefined);
                                  const voltage = pvData?.voltage !== undefined ? pvData.voltage : (pvData?.V !== undefined ? pvData.V : undefined);
                                  const hasData = current !== undefined || voltage !== undefined;
                                  
                                  if (!hasData) return;
                                  if (!showInactiveStrings) {
                                    const stringStates = pvStates.get(inverter.id!) || new Map();
                                    const isManuallyActive = stringStates.get(key) !== false;
                                    if (!isManuallyActive) return;
                                  }
                                  
                                  allPVData.push([key, pvData]);
                                });
                              }
                              
                              // Sıralama
                              const sortedPVData = sortPVStrings(allPVData);
                              
                              // 3 sütunlu grid için böl
                              const columnCount = 3;
                              const itemsPerColumn = Math.ceil(sortedPVData.length / columnCount);
                              const columns: Array<Array<[string, any]>> = [];
                              
                              for (let i = 0; i < columnCount; i++) {
                                const startIndex = i * itemsPerColumn;
                                const endIndex = Math.min(startIndex + itemsPerColumn, sortedPVData.length);
                                columns.push(sortedPVData.slice(startIndex, endIndex));
                              }
                              
                              return (
                                <Grid container spacing={1} sx={{ mt: 1 }}>
                                  {columns.map((columnData, columnIndex) => 
                                    columnData.length > 0 ? (
                                      <Grid item xs={12} md={4} key={columnIndex}>
                                        <Paper variant="outlined" sx={{ p: 1 }}>
                                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                            {columnData.map(([key, pvData]: [string, any]) => {
                                              const stringStates = pvStates.get(inverter.id!) || new Map();
                                              const isActive = stringStates.get(key) !== false;
                                              const current = pvData?.current !== undefined ? pvData.current : (pvData?.I !== undefined ? pvData.I : 0);
                                              const voltage = pvData?.voltage !== undefined ? pvData.voltage : (pvData?.V !== undefined ? pvData.V : 0);
                                              
                                              // Durum belirleme: Yeşil=Normal, Kırmızı=Hata
                                              const isNormal = isActive && current > 0.5 && voltage > 50;
                                              const isError = isActive && (current <= 0.5 || voltage <= 50);
                                              
                                              return (
                                                <Box 
                                                  key={key}
                                                  sx={{ 
                                                    p: 0.4,
                                                    mb: 0.2,
                                                    borderRadius: 0.5,
                                                    bgcolor: !isActive ? 'grey.100' : 
                                                            isNormal ? 'success.50' : 
                                                            isError ? 'error.50' : 'inherit',
                                                    '&:hover': { 
                                                      bgcolor: !isActive ? 'grey.200' : 
                                                              isNormal ? 'success.100' : 
                                                              'error.100'
                                                    },
                                                    cursor: user?.uid ? 'pointer' : 'default',
                                                    transition: 'background-color 0.1s ease',
                                                    opacity: isActive ? 1 : 0.6
                                                  }}
                                                  onClick={() => user?.uid && handlePVStringToggle(inverter.id || '', key, isActive)}
                                                >
                                                  {/* String bilgileri - tek satır */}
                                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                                    <Box 
                                                      sx={{ 
                                                        width: 6, 
                                                        height: 6, 
                                                        borderRadius: '50%', 
                                                        bgcolor: !isActive ? 'grey.400' : 
                                                                 isNormal ? 'success.main' : 
                                                                 'error.main'
                                                      }} 
                                                    />
                                                    <Typography variant="body2" sx={{ 
                                                      fontWeight: 600, 
                                                      fontSize: '0.7rem', 
                                                      minWidth: 28 
                                                    }}>
                                                      {key}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ 
                                                      fontSize: '0.65rem', 
                                                      color: isNormal ? 'success.dark' : isError ? 'error.dark' : 'text.secondary',
                                                      fontWeight: 500,
                                                      minWidth: 24
                                                    }}>
                                                      {current.toFixed(1)}A
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ 
                                                      fontSize: '0.65rem', 
                                                      color: isNormal ? 'primary.main' : isError ? 'error.dark' : 'text.secondary',
                                                      fontWeight: 500
                                                    }}>
                                                      {voltage.toFixed(0)}V
                                                    </Typography>
                                                  </Box>
                                                </Box>
                                              );
                                            })}
                                          </Box>
                                        </Paper>
                                      </Grid>
                                    ) : null
                                  )}
                                </Grid>
                              );
                            })()}
                          </Box>
                          
                          {/* Debug bilgisi - Yalnızca development modda göster */}
                          {process.env.NODE_ENV === 'development' && false && (
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                              <Typography variant="body2" color="warning.dark" sx={{ fontWeight: 'bold' }}>
                                🔍 DEBUG: {inverter.name || inverter.id} - Veri Analizi
                              </Typography>
                              <Typography variant="caption" color="warning.dark" sx={{ display: 'block', mt: 1 }}>
                                <strong>Sistem tipi:</strong> {inverter.systemType || 'Bilinmiyor'}
                              </Typography>
                              <Typography variant="caption" color="warning.dark" sx={{ display: 'block' }}>
                                <strong>pvInputs:</strong> {inverter.pvInputs ? `Var (${Object.keys(inverter.pvInputs || {}).length} adet)` : 'YOK'} | 
                                <strong>mpptData:</strong> {inverter.mpptData ? `Var (${inverter.mpptData?.length} adet)` : 'YOK'}
                              </Typography>
                              <Typography variant="caption" color="warning.dark" sx={{ display: 'block' }}>
                                <strong>PV/String Keys:</strong> {Object.keys(inverter).filter(k => 
                                  k.toLowerCase().includes('string') || 
                                  k.toLowerCase().includes('pv') || 
                                  k.toLowerCase().includes('mppt')
                                ).join(', ') || 'Bulunamadı'}
                              </Typography>
                              <Typography variant="caption" color="warning.dark" sx={{ display: 'block' }}>
                                <strong>Tüm Data Keys (ilk 15):</strong> {Object.keys(inverter).slice(0, 15).join(', ')}
                              </Typography>
                              {/* Raw inverter object preview */}
                              <details style={{ marginTop: 8 }}>
                                <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#d84315' }}>
                                  📋 Raw Inverter Data (Genişlet)
                                </summary>
                                <pre style={{ 
                                  fontSize: '0.6rem', 
                                  backgroundColor: '#fff3e0', 
                                  padding: 8, 
                                  borderRadius: 4, 
                                  marginTop: 4,
                                  maxHeight: 200,
                                  overflow: 'auto',
                                  border: '1px solid #ffcc02'
                                }}>
                                  {JSON.stringify(inverter, null, 2)}
                                </pre>
                              </details>
                            </Box>
                          )}
                        </Box>
                      )}


                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

