import { createTheme } from '@mui/material/styles';
import { trTR } from '@mui/material/locale';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0', contrastText: '#fff' },
    secondary: { main: '#dc004e', light: '#ff5983', dark: '#9a0036', contrastText: '#fff' },
    success: { main: '#2e7d32', light: '#4caf50', dark: '#1b5e20' },
    warning: { main: '#ed6c02', light: '#ff9800', dark: '#e65100' },
    error: { main: '#d32f2f', light: '#ef5350', dark: '#c62828' },
    info: { main: '#0288d1', light: '#03a9f4', dark: '#01579b' },
    background: { default: '#fafafa', paper: '#fff' },
    text: { primary: 'rgba(0,0,0,0.87)', secondary: 'rgba(0,0,0,0.6)' }
  },
  typography: {
    fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
    h1: { fontSize: '2.125rem' }, 
    h2: { fontSize: '1.875rem' }, 
    h3: { fontSize: '1.5rem' },
    h4: { fontSize: '1.25rem' }, 
    h5: { fontSize: '1.125rem' }, 
    h6: { fontSize: '1rem', fontWeight: 500 },
    body1: { fontSize: '1rem', lineHeight: 1.5 }, 
    body2: { fontSize: '0.875rem', lineHeight: 1.43 },
    button: { fontSize: '0.875rem', fontWeight: 500, textTransform: 'none' }
  },
  shape: { borderRadius: 8 },
  spacing: 8,
  components: {
    MuiButton: { 
      styleOverrides: { 
        root: { 
          borderRadius: 8, 
          padding: '8px 16px', 
          textTransform: 'none', 
          fontWeight: 500 
        }, 
        contained: { 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)', 
          '&:hover': { boxShadow: '0 4px 8px rgba(0,0,0,0.15)' } 
        } 
      } 
    },
    MuiCard: { 
      styleOverrides: { 
        root: { 
          borderRadius: 12, 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', 
          '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.15)' } 
        } 
      } 
    },
    MuiPaper: { 
      styleOverrides: { 
        root: { borderRadius: 8 } 
      } 
    },
    MuiTextField: { 
      styleOverrides: { 
        root: { 
          '& .MuiOutlinedInput-root': { borderRadius: 8 } 
        } 
      } 
    },
    MuiChip: { 
      styleOverrides: { 
        root: { borderRadius: 16 } 
      } 
    },
    MuiAppBar: { 
      styleOverrides: { 
        root: { boxShadow: '0 2px 4px rgba(0,0,0,0.1)' } 
      } 
    },
    MuiTableContainer: { 
      styleOverrides: { 
        root: { 
          borderRadius: 8, 
          border: '1px solid rgba(0,0,0,0.12)' 
        } 
      } 
    },
    MuiTableHead: { 
      styleOverrides: { 
        root: { backgroundColor: '#f5f5f5' } 
      } 
    }
  }
}, trTR);

export default theme;

