import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  People as PeopleIcon,
  Security as SecurityIcon,
  Email as EmailIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getTeamMembers, 
  addTeamMember, 
  deleteTeamMember, 
  updateSiteAssignments 
} from '@/services/teamService';
import { User, Site } from '@/types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function Team() {
  const { user, isAdmin, isManager, isViewer } = useAuth();
  
  // 🔒 GÜVENLİK KONTROLÜ: Sadece admin ekip yönetimi yapabilir
  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            🔒 Yetkisiz Erişim
          </Typography>
          <Typography>
            Ekip yönetimi sayfası sadece sistem yöneticileri (admin) tarafından kullanılabilir.
            Bu sayfa için yetkiniz bulunmamaktadır.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
            Mevcut rolünüz: <strong>{user?.role || 'Bilinmiyor'}</strong>
          </Typography>
        </Alert>
      </Box>
    );
  }
  
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Form states
  const [newMember, setNewMember] = useState({
    email: '',
    displayName: '',
    role: 'viewer' as 'manager' | 'viewer'
  });

  // Site assignment states
  const [selectedSites, setSelectedSites] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [membersData, sitesData] = await Promise.all([
        getTeamMembers(),
        loadSites()
      ]);
      setTeamMembers(membersData);
      setSites(sitesData);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      showSnackbar('Veri yüklenirken hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async (): Promise<Site[]> => {
    try {
      const sitesRef = collection(db, 'sites');
      const snapshot = await getDocs(sitesRef);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Site[];
    } catch (error) {
      console.error('Sites loading error:', error);
      return [];
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleAddMember = async () => {
    try {
      if (!newMember.email || !newMember.displayName) {
        showSnackbar('Email ve isim alanları zorunludur', 'error');
        return;
      }

      await addTeamMember({
        ...newMember,
        createdBy: user?.uid || ''
      });

      showSnackbar('Ekip üyesi başarıyla eklendi', 'success');
      setAddDialogOpen(false);
      setNewMember({ email: '', displayName: '', role: 'viewer' });
      loadData();
    } catch (error: any) {
      showSnackbar(error.message || 'Ekip üyesi eklenirken hata oluştu', 'error');
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Bu ekip üyesini silmek istediğinizden emin misiniz?')) return;

    try {
      await deleteTeamMember(memberId);
      showSnackbar('Ekip üyesi silindi', 'success');
      loadData();
    } catch (error) {
      showSnackbar('Silme işlemi başarısız', 'error');
    }
  };

  const handleOpenAssignDialog = (member: User) => {
    setSelectedMember(member);
    setSelectedSites(member.assignedSites || []);
    setAssignDialogOpen(true);
  };

  const handleUpdateAssignments = async () => {
    if (!selectedMember) return;

    try {
      await updateSiteAssignments(selectedMember.uid, selectedSites);
      showSnackbar('Saha atamaları güncellendi', 'success');
      setAssignDialogOpen(false);
      loadData();
    } catch (error) {
      showSnackbar('Güncelleme başarısız', 'error');
    }
  };

  const getRoleChip = (role: string) => {
    const roleConfig = {
      admin: { label: 'Admin', color: 'error' as const, icon: <SecurityIcon /> },
      manager: { label: 'Yönetici', color: 'warning' as const, icon: <SecurityIcon /> },
      viewer: { label: 'İzleyici', color: 'info' as const, icon: <AssignmentIcon /> }
    };
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.viewer;
    return (
      <Chip 
        icon={config.icon} 
        label={config.label} 
        color={config.color} 
        size="small" 
      />
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}>
            <PeopleIcon sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
            Ekip Yönetimi
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Sistem yöneticisi: {user?.displayName || user?.email}
          </Typography>
        </Box>
        
        {user?.role === 'admin' && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Yeni Ekip Üyesi Ekle
          </Button>
        )}
      </Box>

      {/* Team Members Table */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Ekip Üyeleri</Typography>
          
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>İsim</strong></TableCell>
                  <TableCell><strong>Email</strong></TableCell>
                  <TableCell><strong>Rol</strong></TableCell>
                  <TableCell><strong>Atanan Sahalar</strong></TableCell>
                  <TableCell><strong>Oluşturma Tarihi</strong></TableCell>
                  <TableCell><strong>İşlemler</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {teamMembers.map((member) => (
                  <TableRow key={member.uid}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {member.displayName || 'İsimsiz'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{member.email}</Typography>
                    </TableCell>
                    <TableCell>
                      {getRoleChip(member.role)}
                    </TableCell>
                    <TableCell>
                      {member.role === 'admin' ? (
                        <Chip label="Tüm Sahalar" size="small" color="success" />
                      ) : member.role === 'manager' ? (
                        <Chip label="Tüm Sahalar" size="small" color="warning" />
                      ) : (
                        <Typography variant="body2">
                          {member.assignedSites?.length || 0} saha
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {member.createdAt?.toLocaleDateString('tr-TR') || 'Bilinmiyor'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {member.role === 'viewer' && user?.role === 'admin' && (
                          <Tooltip title="Saha Ataması">
                            <IconButton 
                              size="small" 
                              onClick={() => handleOpenAssignDialog(member)}
                              color="primary"
                            >
                              <AssignmentIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {user?.role === 'admin' && member.uid !== user.uid && (
                          <Tooltip title="Sil">
                            <IconButton 
                              size="small" 
                              onClick={() => handleDeleteMember(member.uid)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Yeni Ekip Üyesi Ekle</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Email"
              type="email"
              value={newMember.email}
              onChange={(e) => setNewMember(prev => ({ ...prev, email: e.target.value }))}
              fullWidth
              required
            />
            
            <TextField
              label="İsim Soyisim"
              value={newMember.displayName}
              onChange={(e) => setNewMember(prev => ({ ...prev, displayName: e.target.value }))}
              fullWidth
              required
            />
            
            <FormControl fullWidth>
              <InputLabel>Rol</InputLabel>
              <Select
                value={newMember.role}
                onChange={(e) => setNewMember(prev => ({ ...prev, role: e.target.value as 'manager' | 'viewer' }))}
                label="Rol"
              >
                <MenuItem value="manager">Yönetici</MenuItem>
                <MenuItem value="viewer">İzleyici</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>İptal</Button>
          <Button onClick={handleAddMember} variant="contained">Ekle</Button>
        </DialogActions>
      </Dialog>

      {/* Site Assignment Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Saha Ataması - {selectedMember?.displayName}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Bu izleyicinin erişebileceği sahaları seçin:
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sites.map((site) => (
              <FormControlLabel
                key={site.id}
                control={
                  <Checkbox
                    checked={selectedSites.includes(site.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSites(prev => [...prev, site.id]);
                      } else {
                        setSelectedSites(prev => prev.filter(id => id !== site.id));
                      }
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {site.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {site.location} - {site.capacityMWp} MWp
                    </Typography>
                  </Box>
                }
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>İptal</Button>
          <Button onClick={handleUpdateAssignments} variant="contained">Güncelle</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Box>
  );
}