import React from 'react';
import {
  Box,
  Typography,
  Paper,
} from '@mui/material';
import { InverterData } from '@/types';
import FusionCards from './FusionCards';

interface InverterViewManagerProps {
  data: InverterData[];
  title?: string;
}

export default function InverterViewManager({ data, title }: InverterViewManagerProps) {

  return (
    <Box>
      {/* Görünüm seçici kaldırıldı - sadece kart görünümü */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }} />

      {/* Content Based on View Mode */}
      <FusionCards data={data} />
    </Box>
  );
}
