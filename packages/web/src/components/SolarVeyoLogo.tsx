import React from 'react';
import { Box, Typography, keyframes } from '@mui/material';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export default function SolarVeyoLogo() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {/* Minimal kurumsal işaret */}
      <Box component="svg" viewBox="0 0 24 24" sx={{ width: 28, height: 28, color: 'primary.main' }}>
        {/* Sun core */}
        <circle cx="12" cy="12" r="4.2" fill="currentColor" opacity="0.9" />
        <circle cx="12" cy="12" r="6.2" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.6" />
        {/* Rays (rotating) */}
        <Box
          component="g"
          sx={{ animation: `${spin} 16s linear infinite`, transformOrigin: '12px 12px' }}
        >
          <path
            d="M12 1.8v3.2M12 19v3.2M1.8 12h3.2M19 12h3.2M4.6 4.6l2.0 2.0M17.4 17.4l2.0 2.0M19.4 4.6l-2.0 2.0M4.6 19.4l2.0-2.0"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />
        </Box>
      </Box>

      {/* Sade kelime işareti */}
      <Box sx={{ lineHeight: 1 }}>
        <Typography sx={{ fontWeight: 800, letterSpacing: 0.3, fontSize: '1.1rem' }}>
          <Box component="span" sx={{ color: 'text.primary' }}>Solar</Box>
          <Box component="span" sx={{ color: 'primary.main' }}>Veyo</Box>
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>SCADA Monitoring</Typography>
      </Box>
    </Box>
  )
}
