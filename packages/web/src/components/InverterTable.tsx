import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box,
  Typography,
  IconButton,
  Collapse,
  Switch,
  Grid,
} from '@mui/material';
import { CheckCircle, Cancel, Warning, ExpandMore, ExpandLess, ElectricBolt } from '@mui/icons-material';
import { InverterData } from '@/types';
import { formatPower, formatEnergy, formatFrequency, formatCurrent, formatVoltage } from '@/utils/format';
import { subscribeToPVStringStates, setPVStringState, isNightOrIdle } from '@/utils/firestore';
import { useAuth } from '@/contexts/AuthContext';

interface InverterTableProps {
  data: InverterData[];
}

const InverterTable = React.memo(({ data }: InverterTableProps) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [pvStates, setPvStates] = useState<Map<string, Map<string, boolean>>>(new Map());
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

  const toggleRow = (inverterId: string) => {
    setExpandedRows(prev => {
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
  const getStatusIcon = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('normal') || statusLower.includes('run') || statusLower.includes('ok')) {
      return <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />;
    } else if (statusLower.includes('fault') || statusLower.includes('error')) {
      return <Cancel sx={{ color: 'error.main', fontSize: 20 }} />;
    } else if (statusLower.includes('alarm') || statusLower.includes('warn')) {
      return <Warning sx={{ color: 'warning.main', fontSize: 20 }} />;
    }
    return <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: 'grey.400' }} />;
  };

  const getStatusColor = (status: string): 'success' | 'error' | 'warning' | 'default' => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('normal') || statusLower.includes('run') || statusLower.includes('ok')) {
      return 'success';
    } else if (statusLower.includes('fault') || statusLower.includes('error')) {
      return 'error';
    } else if (statusLower.includes('alarm') || statusLower.includes('warn')) {
      return 'warning';
    }
    return 'default';
  };

  if (!data || data.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Henüz inverter verisi yok
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Inverter</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>Durum</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>AC Güç</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Günlük Üretim</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Toplam Üretim</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>DC Güç</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Verimlilik</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Sıcaklık</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Şebeke Frekansı</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>PV Stringler</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600, width: 40 }}>Detay</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((inverter, index) => {
            // PV string sayılarını hesapla (manuel pasif olanları sayma)
            const calculatePVStringStats = () => {
              let total = 0;
              let active = 0;
              let inactive = 0;

              const stringStates = pvStates.get(inverter.id!) || new Map();
              const process = (entries: Array<[string, any]>) => {
                entries.forEach(([key, pvData]) => {
                  const current = pvData?.current !== undefined ? pvData.current : (pvData?.I !== undefined ? pvData.I : undefined);
                  const voltage = pvData?.voltage !== undefined ? pvData.voltage : (pvData?.V !== undefined ? pvData.V : undefined);

                  if (current !== undefined || voltage !== undefined) {
                    const isManuallyActive = stringStates.get(key) !== false;
                    if (!isManuallyActive) return; // manuel pasifse sayma

                    total++;
                    // SADECE AKIM DEĞERİNE BAK - 0 ise pasif say
                    const actualCurrent = current || 0;
                    if (actualCurrent > 0) {
                      active++;
                    } else {
                      inactive++;
                    }
                  }
                });
              };

              if (inverter.pvInputs) {
                process(Object.entries(inverter.pvInputs));
              } else if (inverter.mpptData) {
                process(inverter.mpptData);
              }

              return { total, active, inactive };
            };
            
            const pvStats = calculatePVStringStats();
            const isExpanded = expandedRows.has(inverter.id || '');
            const hasPVData = inverter.pvInputs || inverter.mpptData;
            const night = isNightOrIdle(inverter);
            
            return (
              <React.Fragment key={inverter.id || index}>
                <TableRow 
                  hover
                  sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}
                >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getStatusIcon(inverter.status || '')}
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {inverter.name || inverter.id || `INV-${index + 1}`}
                    </Typography>
                  </Box>
                </TableCell>
                
                <TableCell align="center">
                  <Chip
                    label={inverter.status || 'Unknown'}
                    color={getStatusColor(inverter.status || '')}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {formatPower(inverter.activePower || 0)}
                  </Typography>
                </TableCell>
                
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatEnergy(inverter.dailyYield || 0)}
                  </Typography>
                </TableCell>
                
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatEnergy(inverter.totalYield || 0)}
                  </Typography>
                </TableCell>
                
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatPower((inverter as any).dcTotalPower || (inverter as any).dcPower || 0)}
                  </Typography>
                </TableCell>
                
                <TableCell align="right">
                  <Typography variant="body2">
                    {inverter.efficiency ? `${inverter.efficiency.toFixed(1)}%` : '-'}
                  </Typography>
                </TableCell>
                
                <TableCell align="right">
                  <Typography variant="body2">
                    {inverter.temperature || (inverter as any).internalTemperature 
                      ? `${(inverter.temperature || (inverter as any).internalTemperature).toFixed(1)}°C` 
                      : '-'}
                  </Typography>
                </TableCell>
                
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatFrequency((inverter as any).gridFrequency || 0)}
                  </Typography>
                </TableCell>
                
                <TableCell align="right">
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {pvStats.active}/{pvStats.total}
                    </Typography>
                    {!night && pvStats.inactive > 0 && (
                      <Typography variant="caption" color="warning.main">
                        {pvStats.inactive} pasif
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                
                <TableCell align="center">
                  {hasPVData && (
                    <IconButton
                      size="small"
                      onClick={() => toggleRow(inverter.id || '')}
                    >
                      {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
              
              {/* PV String Detay Satırı */}
              {hasPVData && (
                <TableRow>
                  <TableCell 
                    style={{ paddingBottom: 0, paddingTop: 0 }} 
                    colSpan={11}
                  >
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box sx={{ margin: 1 }}>
                        <Typography variant="h6" gutterBottom component="div" sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1,
                          fontSize: '0.9rem',
                          fontWeight: 600 
                        }}>
                          <ElectricBolt color="primary" />
                          PV String Detayları
                        </Typography>
                        
                        {/* Kompakt PV String Grid */}
                        <Box sx={{ mt: 1 }}>
                          {(() => {
                            // PV verileri toplanıyor
                            const allPVData: Array<[string, any]> = [];
                            const stringStates = pvStates.get(inverter.id!) || new Map();
                            
                            if (inverter.pvInputs) {
                              Object.entries(inverter.pvInputs).forEach(([key, pvData]) => {
                                const current = pvData?.current !== undefined ? pvData.current : (pvData?.I !== undefined ? pvData.I : undefined);
                                const voltage = pvData?.voltage !== undefined ? pvData.voltage : (pvData?.V !== undefined ? pvData.V : undefined);
                                const hasData = current !== undefined || voltage !== undefined;
                                
                                if (hasData) {
                                  const isManuallyActive = stringStates.get(key) !== false;
                                  if (isManuallyActive) {
                                    allPVData.push([key, pvData]);
                                  }
                                }
                              });
                            } else if (inverter.mpptData) {
                              inverter.mpptData.forEach(([key, pvData]) => {
                                const current = pvData?.current !== undefined ? pvData.current : (pvData?.I !== undefined ? pvData.I : undefined);
                                const voltage = pvData?.voltage !== undefined ? pvData.voltage : (pvData?.V !== undefined ? pvData.V : undefined);
                                const hasData = current !== undefined || voltage !== undefined;
                                
                                if (hasData) {
                                  const isManuallyActive = stringStates.get(key) !== false;
                                  if (isManuallyActive) {
                                    allPVData.push([key, pvData]);
                                  }
                                }
                              });
                            }
                            
                            const sortedPVData = sortPVStrings(allPVData);
                            
                            // 6 sütunlu grid için böl (liste görünümünde daha fazla sütun)
                            const columnCount = 6;
                            const itemsPerColumn = Math.ceil(sortedPVData.length / columnCount);
                            const columns: Array<Array<[string, any]>> = [];
                            
                            for (let i = 0; i < columnCount; i++) {
                              const startIndex = i * itemsPerColumn;
                              const endIndex = Math.min(startIndex + itemsPerColumn, sortedPVData.length);
                              columns.push(sortedPVData.slice(startIndex, endIndex));
                            }
                            
                            return (
                              <Grid container spacing={0.5}>
                                {columns.map((columnData, columnIndex) => 
                                  columnData.length > 0 ? (
                                    <Grid item xs={2} key={columnIndex}>
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.1 }}>
                                        {columnData.map(([key, pvData]: [string, any]) => {
                                          const stringStates = pvStates.get(inverter.id!) || new Map();
                                          const isActive = stringStates.get(key) !== false;
                                          const current = pvData?.current !== undefined ? pvData.current : (pvData?.I !== undefined ? pvData.I : 0);
                                          const voltage = pvData?.voltage !== undefined ? pvData.voltage : (pvData?.V !== undefined ? pvData.V : 0);
                                          
                                          // Durum belirleme: Yeşil=Normal, Kırmızı=Hata
                                          const isNormal = !night && isActive && current > 0.5 && voltage > 50;
                                          const isError = !night && isActive && (current <= 0.5 || voltage <= 50);
                                          
                                          return (
                                            <Box 
                                              key={key}
                                              sx={{ 
                                                p: 0.3,
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
                                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}>
                                                <Box 
                                                  sx={{ 
                                                    width: 4, 
                                                    height: 4, 
                                                    borderRadius: '50%', 
                                                    bgcolor: !isActive ? 'grey.400' : 
                                                             isNormal ? 'success.main' : 
                                                             'error.main'
                                                  }} 
                                                />
                                                <Typography variant="body2" sx={{ 
                                                  fontWeight: 600, 
                                                  fontSize: '0.6rem',
                                                  minWidth: 20
                                                }}>
                                                  {key}
                                                </Typography>
                                                <Typography variant="body2" sx={{ 
                                                  fontSize: '0.55rem', 
                                                  color: isNormal ? 'success.dark' : isError ? 'error.dark' : 'text.secondary',
                                                  fontWeight: 500,
                                                  minWidth: 18
                                                }}>
                                                  {current.toFixed(1)}A
                                                </Typography>
                                                <Typography variant="body2" sx={{ 
                                                  fontSize: '0.55rem', 
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
                                    </Grid>
                                  ) : null
                                )}
                              </Grid>
                            );
                          })()}
                        </Box>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
});

InverterTable.displayName = 'InverterTable';

export default InverterTable;