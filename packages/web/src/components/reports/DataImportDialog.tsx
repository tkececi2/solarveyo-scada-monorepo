import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  CloudUpload,
  Download,
  CheckCircle,
  Error,
  History,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';

interface DataImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: any[]) => Promise<void>;
  sites: Array<{ id: string; name: string }>;
}

export default function DataImportDialog({
  open,
  onClose,
  onImport,
  sites,
}: DataImportDialogProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const steps = ['Dosya Seç', 'Veriyi Kontrol Et', 'İçe Aktar'];

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        setParsedData(jsonData);
        setActiveStep(1);
      };
      reader.readAsArrayBuffer(uploadedFile);
    } catch (error) {
      console.error('Dosya okuma hatası:', error);
      setImportResult({
        success: false,
        message: 'Dosya okunamadı. Lütfen geçerli bir Excel dosyası seçin.',
      });
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setActiveStep(2);
    
    try {
      await onImport(parsedData);
      setImportResult({
        success: true,
        message: `${parsedData.length} kayıt başarıyla içe aktarıldı.`,
      });
    } catch (error) {
      setImportResult({
        success: false,
        message: 'İçe aktarma sırasında hata oluştu.',
        details: error,
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setFile(null);
    setParsedData([]);
    setImportResult(null);
    onClose();
  };

  const generateSampleExcel = () => {
    const sampleData = [
      { Tarih: '2024-01-01', ...sites.reduce((acc, site) => ({ ...acc, [site.name]: 0 }), {}) },
      { Tarih: '2024-01-02', ...sites.reduce((acc, site) => ({ ...acc, [site.name]: 0 }), {}) },
    ];
    
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Üretim Verileri');
    XLSX.writeFile(wb, 'ornek_uretim_verileri.xlsx');
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <History />
        Geçmiş Veri İçe Aktarma
      </DialogTitle>
      
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <Box>
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'primary.main',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                bgcolor: 'primary.50',
                mb: 3,
              }}
            >
              <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Excel Dosyasını Seçin
              </Typography>
              <input
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                id="excel-upload"
                type="file"
                onChange={handleFileUpload}
              />
              <label htmlFor="excel-upload">
                <Button variant="contained" component="span" startIcon={<CloudUpload />}>
                  Dosya Seç
                </Button>
              </label>
            </Box>

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Excel Formatı:</strong><br />
                • İlk sütun: Tarih (YYYY-MM-DD)<br />
                • Diğer sütunlar: Santral isimleri<br />
                • Hücreler: Günlük üretim değerleri (kWh)
              </Typography>
            </Alert>

            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={generateSampleExcel}
              fullWidth
            >
              Örnek Excel İndir
            </Button>
          </Box>
        )}

        {activeStep === 1 && parsedData.length > 0 && (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              {parsedData.length} kayıt başarıyla okundu.
            </Alert>

            <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {Object.keys(parsedData[0] || {}).map((key) => (
                      <TableCell key={key}>{key}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedData.slice(0, 5).map((row, index) => (
                    <TableRow key={index}>
                      {Object.values(row).map((value: any, idx) => (
                        <TableCell key={idx}>{value}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {parsedData.length > 5 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                ... ve {parsedData.length - 5} kayıt daha
              </Typography>
            )}
          </Box>
        )}

        {activeStep === 2 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            {importing ? (
              <>
                <LinearProgress sx={{ mb: 2 }} />
                <Typography>Veriler içe aktarılıyor...</Typography>
              </>
            ) : importResult ? (
              <Alert
                severity={importResult.success ? 'success' : 'error'}
                icon={importResult.success ? <CheckCircle /> : <Error />}
              >
                {importResult.message}
              </Alert>
            ) : null}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          {importResult ? 'Kapat' : 'İptal'}
        </Button>
        {activeStep === 1 && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing || parsedData.length === 0}
          >
            İçe Aktar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
