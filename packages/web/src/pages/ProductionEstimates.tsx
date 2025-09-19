import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, MenuItem, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Card, CardContent, 
  Stack, Chip, FormControl, InputLabel, Select, Dialog, DialogTitle, DialogContent, 
  DialogActions, LinearProgress, Divider
} from '@mui/material';
import { Upload, Download, GetApp } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { Site } from '@/types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ProductionEstimatesService, SiteEstimate, MonthlyPerformance } from '@/services/productionEstimatesService';

export default function ProductionEstimates() {
  const { user, isManager, isViewer } = useAuth();
  
  // 🔒 GÜVENLİK KONTROLÜ: Sadece manager/admin tahminleri yönetebilir
  if (!isManager) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            🔒 Sadece Okuma Yetkisi
          </Typography>
          <Typography>
            Üretim tahminleri sayfası sadece yöneticiler tarafından yapılandırılabilir.
            İzleyici rolünde bu verileri görüntüleyebilir ancak değiştiremezsiniz.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
            Mevcut rolünüz: <strong>{user?.role || 'Bilinmiyor'}</strong>
          </Typography>
        </Alert>
      </Box>
    );
  }
  
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estimate form states
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedMonths, setSelectedMonths] = useState<{ [month: number]: string }>({});
  const [savingEstimate, setSavingEstimate] = useState(false);

  // Display estimates and performance
  const [siteEstimates, setSiteEstimates] = useState<SiteEstimate[]>([]);
  const [monthlyPerformances, setMonthlyPerformances] = useState<MonthlyPerformance[]>([]);

  // Excel Import States
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedEstimates, setParsedEstimates] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (selectedSiteId) {
      fetchEstimatesAndPerformance();
    }
  }, [selectedSiteId]);

  const fetchSites = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'sites'));
      const sitesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Site));
      setSites(sitesData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching sites:', err);
      setError('Santraller yüklenirken hata oluştu.');
      setLoading(false);
    }
  };

  const fetchEstimatesAndPerformance = async () => {
    if (!selectedSiteId) return;
    setLoading(true);
    setError(null);
    try {
      console.log(`🔍 Fetching estimates for siteId: "${selectedSiteId}"`);
      const estimates = await ProductionEstimatesService.getEstimatesForSite(selectedSiteId);
      console.log(`📊 Found ${estimates.length} estimates:`, estimates);
      setSiteEstimates(estimates);

      // Mevcut tahminleri form'a yükle (yılsız)
      const monthlyData: { [month: number]: string } = {};
      estimates.forEach(est => {
        monthlyData[est.month] = est.estimatedProductionKWh.toString();
      });
      setSelectedMonths(monthlyData);

      // Performans hesapla (sadece geçmiş aylar için - mevcut yıl)
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const performances: MonthlyPerformance[] = [];
      
      for (let month = 1; month <= 12; month++) {
        const monthDate = new Date(currentYear, month - 1, 1);
        if (monthDate < currentDate) { // Sadece geçmiş aylar
          const site = sites.find(s => s.id === selectedSiteId);
          if (site) {
            try {
              const performance = await ProductionEstimatesService.calculateMonthlyPerformance(
                selectedSiteId,
                site.name,
                currentYear,
                month
              );
              if (performance.estimatedKWh > 0) {
                performances.push(performance);
              }
            } catch (error) {
              console.warn(`Could not calculate performance for ${month}/${currentYear}:`, error);
            }
          }
        }
      }
      setMonthlyPerformances(performances);

    } catch (err) {
      console.error('Error fetching estimates or performance:', err);
      setError('Tahminler veya performans verileri yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleMonthlyEstimateChange = (month: number, value: string) => {
    setSelectedMonths(prev => ({
      ...prev,
      [month]: value
    }));
  };

  const handleSaveEstimates = async () => {
    if (!user || !selectedSiteId) {
      setError('Lütfen santral seçin.');
      return;
    }

    setSavingEstimate(true);
    setError(null);
    
    try {
      const site = sites.find(s => s.id === selectedSiteId);
      if (!site) throw new Error('Seçili santral bulunamadı.');

      let savedCount = 0;
      for (const [monthStr, estimateStr] of Object.entries(selectedMonths)) {
        const month = parseInt(monthStr);
        const estimate = parseFloat(estimateStr);
        
        if (estimate > 0) {
          await ProductionEstimatesService.saveMonthlyEstimate(
            selectedSiteId,
            site.name,
            month,
            estimate,
            user.uid
          );
          savedCount++;
        }
      }

      alert(`${savedCount} aylık tahmin başarıyla kaydedildi!`);
      fetchEstimatesAndPerformance(); // Refresh data
      
    } catch (err) {
      console.error('Error saving estimates:', err);
      setError(`Tahminler kaydedilirken hata oluştu: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
    } finally {
      setSavingEstimate(false);
    }
  };

  const handleDeleteMonth = async (month: number) => {
    if (!selectedSiteId) return;
    if (!confirm(`${new Date(0, month-1).toLocaleString('tr-TR', { month: 'long' })} tahminini silmek istiyor musunuz?`)) return;
    try {
      await ProductionEstimatesService.deleteMonthlyEstimate(selectedSiteId, month);
      setSiteEstimates(prev => prev.filter(e => e.month !== month));
      setSelectedMonths(prev => { const n = { ...prev }; delete n[month]; return n; });
    } catch (e) {
      alert('Silme sırasında hata oluştu');
    }
  };

  const handleDeleteAll = async () => {
    if (!selectedSiteId) return;
    if (!confirm('Bu santralin tüm aylık tahminleri silinecek. Devam edilsin mi?')) return;
    try {
      const count = await ProductionEstimatesService.deleteAllEstimatesForSite(selectedSiteId);
      setSiteEstimates([]);
      setSelectedMonths({});
      alert(`${count} kayıt silindi`);
    } catch (e) {
      alert('Toplu silme sırasında hata oluştu');
    }
  };

  const handleAutoGenerateEstimates = () => {
    const site = sites.find(s => s.id === selectedSiteId);
    if (!site || !site.capacityMWp) {
      alert('Otomatik tahmin için santral kapasitesi bulunamadı.');
      return;
    }

    const autoEstimates: { [month: number]: string } = {};
    for (let month = 1; month <= 12; month++) {
      const estimate = ProductionEstimatesService.calculateMonthlyEstimateFromCapacity(site.capacityMWp, month);
      autoEstimates[month] = estimate.toFixed(2);
    }
    
    setSelectedMonths(autoEstimates);
  };

  // Excel Import Functions
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportLoading(true);
    setParsedEstimates([]);
    setImportResult(null);

    try {
      const { BulkEstimatesImportService } = await import('@/services/bulkEstimatesImportService');
      const estimatesData = await BulkEstimatesImportService.parseEstimatesExcelFile(file);
      
      setParsedEstimates(estimatesData);
      console.log(`✅ Parsed ${estimatesData.length} estimate rows`);
      
    } catch (error) {
      console.error('Excel parse error:', error);
      setImportResult({
        success: false,
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        errors: [error instanceof Error ? error.message : 'Dosya işlenemedi'],
        duplicateCount: 0
      });
    } finally {
      setImportLoading(false);
    }
  };

  const startImport = async () => {
    if (parsedEstimates.length === 0 || !user) return;

    setImportLoading(true);
    try {
      const { BulkEstimatesImportService } = await import('@/services/bulkEstimatesImportService');
      const result = await BulkEstimatesImportService.importBulkEstimates(
        parsedEstimates,
        user.uid,
        (processed, total) => setImportProgress({ processed, total })
      );
      
      setImportResult(result);
      
      if (result.success) {
        alert(`✅ ${result.successCount} santralın tahminleri başarıyla kaydedildi!`);
        // Refresh current data if needed
        if (selectedSiteId) {
          fetchEstimatesAndPerformance();
        }
      } else {
        console.error('Import errors:', result.errors);
      }
      
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        totalRows: parsedEstimates.length,
        successCount: 0,
        errorCount: parsedEstimates.length,
        errors: [error instanceof Error ? error.message : 'Import failed'],
        duplicateCount: 0
      });
    } finally {
      setImportLoading(false);
      setImportProgress(null);
    }
  };

  const generateSampleExcel = async () => {
    try {
      const { BulkEstimatesImportService } = await import('@/services/bulkEstimatesImportService');
      BulkEstimatesImportService.generateEstimatesSampleExcel(sites);
    } catch (error) {
      console.error('Error generating sample Excel:', error);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setParsedEstimates([]);
    setImportResult(null);
    setImportProgress(null);
    setShowImportDialog(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isManager) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Bu sayfaya erişim için yönetici yetkisi gereklidir.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Tahminler</Typography>
          <Typography variant="body2" color="text.secondary">Aylık hedefleri girin, gerçekleşenle kıyaslayın.</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={handleAutoGenerateEstimates}>🤖 Otomatik Hesapla</Button>
          <Button variant="contained" startIcon={<Upload />} onClick={() => setShowImportDialog(true)} sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}>📊 Toplu Excel İmport</Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Santral Seçimi */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Santral Seçimi
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={8}>
            <FormControl fullWidth>
              <InputLabel>Santral Seçin</InputLabel>
              <Select
                value={selectedSiteId}
                label="Santral Seçin"
                onChange={(e) => setSelectedSiteId(e.target.value)}
                disabled={loading}
              >
                {sites.map((site) => (
                  <MenuItem key={site.id} value={site.id}>
                    {site.name} ({site.capacityMWp} MWp)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              variant="outlined"
              onClick={handleAutoGenerateEstimates}
              disabled={!selectedSiteId || loading}
              fullWidth
            >
              🤖 Otomatik Hesapla
            </Button>
          </Grid>
        </Grid>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          💡 Bu tahminler santralın genel aylık performansını temsil eder ve her yıl için geçerlidir.
        </Typography>
      </Paper>

      {/* Özet ve Mini Grafik */}
      {selectedSiteId && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Özet</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Card sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">Yıllık Tahmin</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {Object.values(selectedMonths).reduce((s, v) => s + (parseFloat(v)||0), 0).toLocaleString('tr-TR')} kWh
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={8}>
              <Card sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Aylık Hedefler</Typography>
                <Grid container spacing={1}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <Grid item xs={3} sm={2} md={1} key={m}>
                      <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(2024, m-1, 1).toLocaleDateString('tr-TR', { month: 'short' })}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {(parseFloat(selectedMonths[m]||'0')/1000).toFixed(1)} MWh
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Aylık Tahminler Formu */}
      {selectedSiteId && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Aylık Tahminler (Genel - Tüm Yıllar İçin)
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" color="error" onClick={handleDeleteAll}>Tümünü Sil</Button>
              <Button
                variant="contained"
                onClick={handleSaveEstimates}
                disabled={savingEstimate || loading}
                startIcon={savingEstimate ? <CircularProgress size={20} /> : null}
              >
                {savingEstimate ? 'Kaydediliyor...' : '💾 Tahminleri Kaydet'}
              </Button>
            </Stack>
          </Box>
          
          <Grid container spacing={2}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <Grid item xs={6} sm={4} md={3} key={month}>
                <TextField
                  fullWidth
                  label={new Date(2024, month - 1, 1).toLocaleDateString('tr-TR', { month: 'long' })}
                  type="number"
                  inputProps={{ step: "1", min: "0" }}
                  value={selectedMonths[month] || ''}
                  onChange={(e) => handleMonthlyEstimateChange(month, e.target.value)}
                  placeholder="0 kWh"
                  size="small"
                />
                {siteEstimates.find(e => e.month === month) && (
                  <Button color="error" size="small" onClick={() => handleDeleteMonth(month)} sx={{ mt: 0.5 }}>Sil</Button>
                )}
              </Grid>
            ))}
          </Grid>
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            💡 <strong>İpucu:</strong> "Otomatik Hesapla" butonuna tıklayarak Türkiye iklim koşullarına göre tahmini değerler oluşturabilirsiniz. Değerler <strong>kWh</strong> cinsinden girilmelidir.
          </Typography>
        </Paper>
      )}

      {/* Kaydedilen Tahminler */}
      {siteEstimates.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            📋 Kaydedilen Tahminler ({sites.find(s => s.id === selectedSiteId)?.name})
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ay</TableCell>
                  <TableCell align="right">Tahmin (kWh)</TableCell>
                  <TableCell>Oluşturan</TableCell>
                  <TableCell>Güncelleme</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {siteEstimates
                  .sort((a, b) => a.month - b.month)
                  .map((estimate, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {new Date(0, estimate.month - 1).toLocaleDateString('tr-TR', { month: 'long' })}
                    </TableCell>
                    <TableCell align="right">{estimate.estimatedProductionKWh.toLocaleString('tr-TR')}</TableCell>
                    <TableCell>{estimate.createdBy}</TableCell>
                    <TableCell>{estimate.updatedAt.toDate().toLocaleDateString('tr-TR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Aylık Performans */}
      {monthlyPerformances.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            📈 Aylık Performans ({sites.find(s => s.id === selectedSiteId)?.name})
          </Typography>
          <Grid container spacing={2}>
            {monthlyPerformances.map((performance, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card 
                  variant="outlined" 
                  sx={{ 
                    borderColor: performance.status === 'below_target' ? 'error.main' : 
                                performance.status === 'above_target' ? 'success.main' : 'info.main',
                    borderWidth: 2
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                      {new Date(0, performance.month - 1).toLocaleString('tr-TR', { month: 'long' })} {performance.year}
                    </Typography>
                    
                    <Box sx={{ mt: 1, mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Tahmin: <strong>{performance.estimatedKWh.toLocaleString('tr-TR')} kWh</strong>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Gerçekleşen: <strong>{performance.actualKWh.toLocaleString('tr-TR')} kWh</strong>
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          color: performance.status === 'below_target' ? 'error.main' : 
                                performance.status === 'above_target' ? 'success.main' : 'info.main',
                          fontWeight: 'bold'
                        }}
                      >
                        %{performance.performancePercentage.toFixed(1)}
                      </Typography>
                      <Chip
                        label={
                          performance.status === 'below_target' ? 'Hedefin Altında' :
                          performance.status === 'above_target' ? 'Hedefin Üstünde' : 'Hedefte'
                        }
                        color={
                          performance.status === 'below_target' ? 'error' :
                          performance.status === 'above_target' ? 'success' : 'info'
                        }
                        size="small"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Excel Import Dialog */}
      <Dialog 
        open={showImportDialog} 
        onClose={resetImport}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          📊 Toplu Tahmin İmport (Excel)
        </DialogTitle>
        <DialogContent>
          {/* Step 1: Download Template */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <GetApp color="primary" />
              1. Örnek Şablon İndir
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Excel Formatı:</strong><br/>
                📋 <strong>Sütunlar:</strong> Santral Adi | Ocak | Subat | Mart | ... | Aralik<br/>
                📊 <strong>Değerler:</strong> kWh cinsinden aylık tahminler (genel - tüm yıllar için geçerli)<br/>
                ⚠️ <strong>Not:</strong> Türkçe karakterler (ı,ş,ğ,ü,ö,ç) kullanmayın<br/><br/>
                <strong>Örnek:</strong><br/>
                <code>
                  Voyag 1 | 125500 | 140200 | 165800 | ...
                </code>
              </Typography>
            </Alert>
            
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={generateSampleExcel}
              disabled={sites.length === 0}
            >
              📥 Örnek Excel İndir
            </Button>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Step 2: Upload File */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Upload color="success" />
              2. Excel Dosyası Yükle
            </Typography>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            
            <Button
              variant="contained"
              startIcon={<Upload />}
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              sx={{ mr: 2 }}
            >
              📁 Dosya Seç
            </Button>
            
            {importFile && (
              <Typography variant="body2" sx={{ mt: 1, color: 'success.main' }}>
                ✅ Seçilen dosya: {importFile.name}
              </Typography>
            )}
          </Box>

          {/* Step 3: Preview & Import */}
          {parsedEstimates.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                3. Önizleme ve İmport
              </Typography>
              
              <Alert severity="success" sx={{ mb: 2 }}>
                ✅ {parsedEstimates.length} santral için tahminler parse edildi
              </Alert>
              
              <Box sx={{ maxHeight: 200, overflowY: 'auto', mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Santral</TableCell>
                      <TableCell>Ocak</TableCell>
                      <TableCell>Şubat</TableCell>
                      <TableCell>Mart</TableCell>
                      <TableCell>...</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedEstimates.slice(0, 5).map((estimate, index) => (
                      <TableRow key={index}>
                        <TableCell>{estimate.siteName}</TableCell>
                        <TableCell>{estimate.january?.toLocaleString('tr-TR') || '-'}</TableCell>
                        <TableCell>{estimate.february?.toLocaleString('tr-TR') || '-'}</TableCell>
                        <TableCell>{estimate.march?.toLocaleString('tr-TR') || '-'}</TableCell>
                        <TableCell>...</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              
              <Button
                variant="contained"
                onClick={startImport}
                disabled={importLoading}
                startIcon={importLoading ? <CircularProgress size={20} /> : <Upload />}
                sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
              >
                {importLoading ? 'İmport Ediliyor...' : '🚀 İmport Et'}
              </Button>
            </Box>
          )}

          {/* Import Progress */}
          {importProgress && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                İşleniyor: {importProgress.processed} / {importProgress.total}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={(importProgress.processed / importProgress.total) * 100}
              />
            </Box>
          )}

          {/* Import Result */}
          {importResult && (
            <Alert 
              severity={importResult.success ? "success" : "error"} 
              sx={{ mb: 2 }}
            >
              <Typography variant="body2">
                <strong>İmport Sonucu:</strong><br/>
                ✅ Başarılı: {importResult.successCount}<br/>
                ❌ Hatalı: {importResult.errorCount}<br/>
                ⚠️ Duplicate: {importResult.duplicateCount}<br/>
                {importResult.errors.length > 0 && (
                  <>
                    <br/><strong>Hatalar:</strong><br/>
                    {importResult.errors.slice(0, 3).map((error: string, index: number) => (
                      <span key={index}>• {error}<br/></span>
                    ))}
                    {importResult.errors.length > 3 && <span>... ve {importResult.errors.length - 3} hata daha</span>}
                  </>
                )}
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={resetImport}>
            Kapat
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}