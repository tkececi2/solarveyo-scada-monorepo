import { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Grid,
  FormControlLabel,
  Checkbox,
  Link,
  Divider,
  Stack,
  Chip,
} from '@mui/material';
import { Visibility, VisibilityOff, Login, WbSunny, TrendingUp, Bolt } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import SolarVeyoLogo from './SolarVeyoLogo';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (error: any) {
      setError('Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#f7f9fc',
        backgroundImage: `linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,.9)),
                          radial-gradient(800px 400px at 10% -10%, rgba(33,150,243,.08), transparent 60%),
                          radial-gradient(900px 450px at 90% 110%, rgba(156,39,176,.08), transparent 60%)`,
        backgroundRepeat: 'no-repeat, no-repeat, no-repeat',
        backgroundSize: 'cover, cover, cover',
        backgroundPosition: 'center, center, center',
      }}
    >
      <Grid container sx={{ minHeight: '100vh' }}>
        {/* Branding Panel */}
        <Grid item xs={false} md={6} sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', p: 8 }}>
          <Box
            sx={{
              maxWidth: 560,
              color: 'text.primary',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <SolarVeyoLogo />
              <Typography variant="h5" sx={{ ml: 2, fontWeight: 700 }}>
                SolarVeyo SCADA
              </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              Kurumsal İzleme ve Performans Analitiği
            </Typography>
            <Typography variant="body1" sx={{ mt: 2, opacity: 0.8 }}>
              Gerçek zamanlı üretim takibi, arıza teşhisi ve raporlama ile tüm
              GES portföyünüz tek ekranda. Güvenli, ölçeklenebilir ve hızlı.
            </Typography>
            <Divider sx={{ my: 3 }} />
            <Stack direction="row" spacing={2}>
              <Chip label="Gerçek Zamanlı" variant="outlined" />
              <Chip label="Rol Bazlı Erişim" variant="outlined" />
              <Chip label="Raporlama" variant="outlined" />
            </Stack>

            {/* Vurgulu istatistik önizlemeleri */}
            <Grid container spacing={2} sx={{ mt: 3 }}>
              <Grid item xs={12} sm={4}>
                <PreviewStat icon={WbSunny} title="Günlük Üretim" value="238,1 MWh" color="#1976d2" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <PreviewStat icon={Bolt} title="Anlık Güç" value="38,4 MW" color="#2e7d32" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <PreviewStat icon={TrendingUp} title="Aktif Santral" value="22" color="#6d4c41" />
              </Grid>
            </Grid>
          </Box>
        </Grid>

        {/* Login Panel */}
        <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
          <Paper
            elevation={20}
            sx={{
              p: 4,
              width: '100%',
              maxWidth: 440,
              borderRadius: 3,
              background: '#ffffff',
            }}
          >
            <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
              <SolarVeyoLogo />
              <Typography variant="h5" sx={{ mt: 2, fontWeight: 700, textAlign: 'center' }}>
                Kurumsal Giriş
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                Hesabınızla oturum açın ve yetkili olduğunuz sahaları görüntüleyin
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Kurumsal E-posta"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                sx={{ mb: 2 }}
                autoComplete="email"
              />

              <TextField
                fullWidth
                label="Şifre"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                sx={{ mb: 1 }}
                autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        disabled={loading}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <FormControlLabel
                  control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
                  label={<Typography variant="body2">Beni hatırla</Typography>}
                />
                <Link href="#" underline="hover" variant="body2" onClick={(e)=>e.preventDefault()}>
                  Şifremi unuttum
                </Link>
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading || !email || !password}
                startIcon={loading ? <CircularProgress size={20} /> : <Login />}
                sx={{ py: 1.5, fontSize: '1rem', fontWeight: 700 }}
              >
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </Button>
            </form>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Yardım mı lazım? <Link href="mailto:support@solarveyo.com">support@solarveyo.com</Link>
              </Typography>
              <Typography variant="caption" color="text.secondary">v1.0.0</Typography>
            </Box>

            <Box sx={{ mt: 1.5, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                © 2025 SolarVeyo • Güvenli SCADA İzleme
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

// Küçük istatistik kartı (yalnızca görsel amaçlı)
function PreviewStat({ icon: Icon, title, value, color }: { icon: any; title: string; value: string; color: string }) {
  return (
    <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ width: 36, height: 36, mr: 1.5, borderRadius: '50%', bgcolor: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon sx={{ color, fontSize: 20 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">{title}</Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{value}</Typography>
        </Box>
      </Box>
    </Paper>
  )
}