import {
  Box,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
} from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';

export default function Settings() {
  const { user, isAdmin, isViewer } = useAuth();

  // 🔒 GÜVENLİK KONTROLÜ: Sadece admin sistem ayarlarını değiştirebilir
  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            🔒 Erişim Reddedildi
          </Typography>
          <Typography>
            Sistem ayarları sadece yöneticiler (admin) tarafından yapılandırılabilir.
            Bu sayfa için yetkiniz bulunmamaktadır.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
            Mevcut rolünüz: <strong>{user?.role || 'Bilinmiyor'}</strong>
          </Typography>
        </Alert>
      </Box>
    );
  }
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        Ayarlar
      </Typography>

      <Paper sx={{ p: 3, maxWidth: 600 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Genel Ayarlar
        </Typography>

        <Box sx={{ '& > div': { mb: 2 } }}>
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Otomatik veri kaydetme"
          />
          
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="E-posta bildirimleri"
          />
          
          <FormControlLabel
            control={<Switch />}
            label="Karanlık tema"
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" sx={{ mb: 2 }}>
          Sistem Bilgileri
        </Typography>

        <Alert severity="info">
          Sistem Versiyonu: v1.0.0<br />
          Son Güncelleme: {new Date().toLocaleDateString('tr-TR')}<br />
          Kullanıcı ID: 5018151
        </Alert>
      </Paper>
    </Box>
  );
}

