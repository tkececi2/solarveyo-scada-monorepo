import { Card, CardContent, Typography, Box } from '@mui/material';
import { SvgIconComponent } from '@mui/icons-material';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: SvgIconComponent;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

export default function StatCard({ title, value, icon: Icon, color = 'primary' }: StatCardProps) {
  const colorMap = {
    primary: '#1976d2',
    secondary: '#dc004e',
    success: '#2e7d32',
    warning: '#ed6c02',
    error: '#d32f2f',
    info: '#0288d1',
  };

  return (
    <Card 
      sx={{ 
        color: 'common.white', 
        background: `linear-gradient(135deg, ${colorMap[color]} 0%, ${colorMap[color]}CC 100%)`,
        transition: 'all 0.3s ease-in-out',
        '&:hover': { 
          transform: 'translateY(-4px)', 
          boxShadow: 6 
        }
      }}
    >
      <CardContent>
        <Box display="flex" alignItems="center" mb={1}>
          <Icon sx={{ mr: 1, fontSize: 24 }} />
          <Typography variant="overline" sx={{ fontWeight: 500 }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

