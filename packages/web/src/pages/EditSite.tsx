import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import { ArrowBack, Save, WbSunny, Factory, BatteryChargingFull, LocationOn, Edit, Storage, Add } from '@mui/icons-material';
import { collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFirestoreCollections, detectCollectionType, searchCollections } from '@/utils/firestore';
import { SystemType, Site } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export default function EditSite() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, isManager, isViewer } = useAuth();

  // 🔒 GÜVENLİK KONTROLÜ: Sadece manager/admin santral düzenleyebilir
  if (!isManager) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            🔒 Düzenleme Yetkisi Yok
          </Typography>
          <Typography>
            Santral düzenleme yetkisi sadece yöneticiler ve site managerlarda bulunmaktadır.
            Bu işlem için yetkiniz bulunmamaktadır.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
            Mevcut rolünüz: <strong>{user?.role || 'Bilinmiyor'}</strong>
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/sites')} 
            sx={{ mt: 2 }}
          >
            ⬅️ Santraller Sayfasına Dön
          </Button>
        </Alert>
      </Box>
    );
  }
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    capacityMWp: '',
    systemType: 'FUSION' as SystemType,
    sources: [] as Array<{ type: SystemType; collection: string }>
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [availableCollections, setAvailableCollections] = useState<string[]>([]);
  const [detectedTypes, setDetectedTypes] = useState<{ [key: string]: SystemType | null }>({});
  const [searchResults, setSearchResults] = useState<Record<number, string[]>>({});

  useEffect(() => {
    if (id) {
      loadSite();
      loadCollections();
    }
  }, [id]);

  const loadSite = async () => {
    try {
      if (!id) return;
      
      const siteDoc = await getDoc(doc(db, 'sites', id));
      if (siteDoc.exists()) {
        const siteData = { id: siteDoc.id, ...siteDoc.data() } as Site;
        setFormData({
          name: siteData.name,
          location: siteData.location || '',
          capacityMWp: siteData.capacityMWp?.toString() || '',
          systemType: siteData.systemType || 'FUSION',
          sources: siteData.sources || []
        });
      } else {
        setError('Santral bulunamadı');
      }
    } catch (error) {
      console.error('Error loading site:', error);
      setError('Santral yüklenirken hata oluştu');
    }
  };

  const loadCollections = async () => {
    try {
      const collections = await getFirestoreCollections();
      setAvailableCollections(collections);
      
      // Her koleksiyon için veri tipini tespit et
      const types: { [key: string]: SystemType | null } = {};
      for (const collectionName of collections) {
        const type = await detectCollectionType(collectionName);
        types[collectionName] = type;
      }
      setDetectedTypes(types);
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCollectionSearch = async (searchTerm: string, sourceIndex: number) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults(prev => ({ ...prev, [sourceIndex]: availableCollections }));
      return;
    }

    try {
      const results = await searchCollections(searchTerm);
      
      // Yeni bulunan koleksiyonların tiplerini tespit et
      const newTypes: { [key: string]: SystemType | null } = {};
      for (const collectionName of results) {
        if (!detectedTypes[collectionName]) {
          const type = await detectCollectionType(collectionName);
          newTypes[collectionName] = type;
        }
      }
      
      // Yeni tipleri mevcut tiplere ekle
      if (Object.keys(newTypes).length > 0) {
        setDetectedTypes(prev => ({ ...prev, ...newTypes }));
      }
      
      setSearchResults(prev => ({ ...prev, [sourceIndex]: results }));
    } catch (error) {
      console.error('Error searching collections:', error);
      setSearchResults(prev => ({ ...prev, [sourceIndex]: availableCollections }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!id) return;

      await updateDoc(doc(db, 'sites', id), {
        name: formData.name,
        location: formData.location,
        capacityMWp: Math.round(parseFloat(formData.capacityMWp) * 1000) / 1000,
        systemType: formData.systemType,
        sources: formData.sources,
        updatedAt: new Date(),
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/sites');
      }, 1500);
    } catch (error) {
      console.error('Error updating site:', error);
      setError('Santral güncellenirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const addCollection = () => {
    setFormData(prev => ({
      ...prev,
      sources: [...prev.sources, { type: 'FUSION', collection: '' }]
    }));
  };

  const removeCollection = (index: number) => {
    setFormData(prev => ({
      ...prev,
      sources: prev.sources.filter((_, i) => i !== index)
    }));
  };

  const updateCollection = (index: number, field: 'type' | 'collection', value: any) => {
    setFormData(prev => ({
      ...prev,
      sources: prev.sources.map((source, i) => 
        i === index ? { ...source, [field]: value } : source
      )
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/sites')}
            sx={{ mr: 2 }}
          >
            Geri
          </Button>
          <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <WbSunny sx={{ fontSize: 32, color: 'warning.main' }} />
            <Edit sx={{ 
              position: 'absolute', 
              top: -4, 
              right: -4, 
              fontSize: 16, 
              color: 'secondary.main',
              bgcolor: 'background.paper',
              borderRadius: '50%',
              p: 0.5
            }} />
          </Box>
          <Typography variant="h4" sx={{ ml: 2, fontWeight: 600 }}>
            Santral Düzenle
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Santral başarıyla güncellendi! Yönlendiriliyorsunuz...
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Santral Adı */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <WbSunny sx={{ color: 'warning.main', fontSize: 20 }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Santral Adı
                </Typography>
              </Box>
              <TextField
                fullWidth
                label="Santral Adı"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={saving}
              />
            </Grid>

            {/* Konum */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <LocationOn sx={{ color: 'info.main', fontSize: 20 }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Konum
                </Typography>
              </Box>
              <TextField
                fullWidth
                label="Konum"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
                disabled={saving}
              />
            </Grid>

            {/* Kapasite */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <BatteryChargingFull sx={{ color: 'success.main', fontSize: 20 }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Kapasite (MWp)
                </Typography>
              </Box>
              <TextField
                fullWidth
                label="Kapasite (MWp)"
                type="number"
                value={formData.capacityMWp}
                onChange={(e) => setFormData({ ...formData, capacityMWp: e.target.value })}
                required
                disabled={saving}
                inputProps={{ 
                  step: 0.001, 
                  min: 0,
                  max: 999.999
                }}
                placeholder="Örnek: 4.723, 2.315, 5.000"
                helperText="Virgülden sonra 3 basamak girilebilir (Örnek: 4.723)"
              />
            </Grid>

            {/* Sistem Tipi */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Factory sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Ana Sistem Tipi
                </Typography>
              </Box>
              <FormControl fullWidth disabled={saving}>
                <InputLabel>Sistem Tipi</InputLabel>
                <Select
                  value={formData.systemType}
                  onChange={(e) => setFormData({ ...formData, systemType: e.target.value as SystemType })}
                  label="Sistem Tipi"
                >
                  <MenuItem value="FUSION">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'success.main' }} />
                      FUSION (Huawei)
                    </Box>
                  </MenuItem>
                  <MenuItem value="SANGROW">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'warning.main' }} />
                      SANGROW
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Koleksiyon Seçimi */}
            <Grid item xs={12}>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Storage sx={{ color: 'info.main', fontSize: 24 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Veri Kaynakları
                  </Typography>
                  <Button
                    startIcon={<Add />}
                    onClick={addCollection}
                    variant="outlined"
                    size="small"
                    disabled={saving}
                  >
                    Koleksiyon Ekle
                  </Button>
                </Box>

                {formData.sources.map((source, index) => (
                  <Box 
                    key={index} 
                    sx={{ 
                      p: 2, 
                      mb: 2, 
                      border: '1px solid',
                      borderColor: 'grey.300',
                      borderRadius: 1,
                      bgcolor: 'grey.50'
                    }}
                  >
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth size="small" disabled={saving}>
                          <InputLabel>Sistem Tipi</InputLabel>
                          <Select
                            value={source.type}
                            onChange={(e) => updateCollection(index, 'type', e.target.value)}
                            label="Sistem Tipi"
                          >
                            <MenuItem value="FUSION">FUSION</MenuItem>
                            <MenuItem value="SANGROW">SANGROW</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Autocomplete
                          options={searchResults[index] || availableCollections}
                          value={source.collection}
                          onChange={(_, newValue) => updateCollection(index, 'collection', newValue || '')}
                          onInputChange={(_, newInputValue) => {
                            handleCollectionSearch(newInputValue, index);
                          }}
                          disabled={saving}
                          size="small"
                          freeSolo
                          filterOptions={(options) => options}
                          renderInput={(params) => (
                            <TextField 
                              {...params} 
                              label="Koleksiyon" 
                              placeholder="Koleksiyon adı yazın..."
                              helperText="Yazdığınız metinle eşleşen koleksiyonlar gösterilecek"
                            />
                          )}
                          renderOption={(props, option) => (
                            <Box component="li" {...props}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Storage sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Box>
                                  <Typography variant="body2">{option}</Typography>
                                  {detectedTypes[option] && (
                                    <Chip 
                                      label={detectedTypes[option]} 
                                      size="small" 
                                      color={detectedTypes[option] === 'FUSION' ? 'success' : 'warning'}
                                      sx={{ height: 16, fontSize: '0.6rem' }}
                                    />
                                  )}
                                </Box>
                              </Box>
                            </Box>
                          )}
                        />
                      </Grid>
                      
                      <Grid item xs={12} sm={2}>
                        <Button
                          onClick={() => removeCollection(index)}
                          color="error"
                          variant="outlined"
                          size="small"
                          disabled={saving}
                          fullWidth
                        >
                          Sil
                        </Button>
                      </Grid>
                    </Grid>
                    
                    {source.collection && detectedTypes[source.collection] && (
                      <Box sx={{ mt: 1 }}>
                        <Chip 
                          label={`Tespit edilen tip: ${detectedTypes[source.collection]}`}
                          size="small"
                          color={detectedTypes[source.collection] === source.type ? 'success' : 'warning'}
                          variant="outlined"
                        />
                      </Box>
                    )}
                  </Box>
                ))}

                {formData.sources.length === 0 && (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 3,
                    border: '2px dashed',
                    borderColor: 'grey.300',
                    borderRadius: 1,
                    bgcolor: 'grey.50'
                  }}>
                    <Storage sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Henüz veri kaynağı eklenmedi
                    </Typography>
                    <Button
                      startIcon={<Add />}
                      onClick={addCollection}
                      variant="outlined"
                      size="small"
                      disabled={saving}
                    >
                      İlk Koleksiyonu Ekle
                    </Button>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* Submit Button */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  onClick={() => navigate('/sites')}
                  disabled={saving}
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} /> : <Save />}
                  disabled={saving || formData.sources.length === 0}
                >
                  {saving ? 'Güncellenyor...' : 'Güncelle'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
}
