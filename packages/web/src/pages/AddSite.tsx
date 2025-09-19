import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import { ArrowBack, Save, WbSunny, Factory, BatteryChargingFull, LocationOn, Add, Storage } from '@mui/icons-material';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFirestoreCollections, detectCollectionType, searchCollections } from '@/utils/firestore';
import { SystemType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export default function AddSite() {
  const navigate = useNavigate();
  const { user, isManager, isViewer } = useAuth();

  // 🔒 GÜVENLİK KONTROLÜ: Sadece manager/admin santral ekleyebilir
  if (!isManager) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            🔒 Yetkisiz İşlem
          </Typography>
          <Typography>
            Yeni santral ekleme yetkisi sadece yöneticiler ve site managerlarda bulunmaktadır.
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [availableCollections, setAvailableCollections] = useState<string[]>([]);
  const [detectedTypes, setDetectedTypes] = useState<{ [key: string]: SystemType | null }>({});
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<Record<number, string[]>>({});

  useEffect(() => {
    loadCollections();
  }, []);

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
      await addDoc(collection(db, 'sites'), {
        name: formData.name,
        location: formData.location,
        capacityMWp: Math.round(parseFloat(formData.capacityMWp) * 1000) / 1000,
        systemType: formData.systemType,
        sources: formData.sources,
        createdAt: new Date(),
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/sites');
      }, 2000);
    } catch (error) {
      console.error('Error adding site:', error);
      setError('Santral eklenirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
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

  const updateCollection = (index: number, field: 'type' | 'collection', value: string) => {
    setFormData(prev => ({
      ...prev,
      sources: prev.sources.map((source, i) => 
        i === index ? { ...source, [field]: value } : source
      )
    }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography>Koleksiyonlar yükleniyor...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/sites')}
          variant="outlined"
        >
          Geri
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box 
            sx={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              bgcolor: 'primary.100',
              position: 'relative'
            }}
          >
            <WbSunny sx={{ color: 'primary.600', fontSize: 28 }} />
            <Add 
              sx={{ 
                position: 'absolute',
                bottom: -2,
                right: -2,
                color: 'success.main',
                fontSize: 16,
                bgcolor: 'white',
                borderRadius: '50%',
                p: 0.2
              }} 
            />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Yeni Santral Ekle
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 3, maxWidth: 600 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Santral başarıyla eklendi! Yönlendiriliyorsunuz...
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <WbSunny sx={{ color: 'primary.main', fontSize: 24 }} />
                <TextField
                  fullWidth
                  label="Santral Adı"
                  value={formData.name}
                  onChange={handleChange('name')}
                  required
                  disabled={saving}
                  placeholder="Örn: Çankırı GES, MRA 1, Voyag 2"
                />
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <LocationOn sx={{ color: 'text.secondary', fontSize: 24 }} />
                <TextField
                  fullWidth
                  label="Konum"
                  value={formData.location}
                  onChange={handleChange('location')}
                  disabled={saving}
                  placeholder="Örn: Çankırı, Isparta"
                />
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <BatteryChargingFull sx={{ color: 'warning.main', fontSize: 24 }} />
                <TextField
                  fullWidth
                  label="Kapasite (MWp)"
                  type="number"
                  value={formData.capacityMWp}
                  onChange={handleChange('capacityMWp')}
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
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Factory sx={{ color: 'info.main', fontSize: 24 }} />
                <FormControl fullWidth required disabled={saving}>
                  <InputLabel>Sistem Tipi</InputLabel>
                  <Select
                    value={formData.systemType}
                    onChange={(e) => setFormData(prev => ({ ...prev, systemType: e.target.value as SystemType }))}
                    label="Sistem Tipi"
                  >
                    <MenuItem value="FUSION">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'green.500' }} />
                        FUSION
                      </Box>
                    </MenuItem>
                    <MenuItem value="SANGROW">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'orange.500' }} />
                        SANGROW
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Box>
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
                          filterOptions={(options) => options} // Kendi filtrelememizi kullan
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
                    p: 3, 
                    textAlign: 'center', 
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
                      variant="contained"
                      size="small"
                    >
                      İlk Koleksiyonu Ekle
                    </Button>
                  </Box>
                )}
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/sites')}
                  disabled={saving}
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<Save />}
                  disabled={saving || !formData.name || !formData.capacityMWp || !formData.systemType || formData.sources.length === 0}
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
}

