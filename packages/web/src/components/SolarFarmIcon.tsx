import React from 'react';
import { Box } from '@mui/material';

type Props = {
  system?: 'SANGROW' | 'FUSION';
  size?: number; // base height in px (width scales)
};

/**
 * Compact animated solar farm icon (sun + panels) for site cards.
 * Visual-only; relies on CSS classes defined in index.css.
 */
export default function SolarFarmIcon({ system = 'FUSION', size = 32 }: Props) {
  const sunColor = system === 'SANGROW' ? '#FB8C00' : '#43A047';
  const panelColor = system === 'SANGROW' ? '#FFB74D' : '#66BB6A';

  const width = Math.round((size / 32) * 48); // proportionally wider

  return (
    <Box
      className="sfarm"
      sx={{ width, height: size, position: 'relative' }}
      aria-hidden
    >
      {/* Sun */}
      <svg className="sfarm-sun" width={width} height={size} viewBox={`0 0 ${width} ${size}`}>
        <g transform={`translate(${width / 2}, 6)`}>
          <circle r="5" fill={sunColor} />
          <g className="sfarm-rays" stroke={sunColor} strokeWidth="1">
            {Array.from({ length: 8 }).map((_, i) => (
              <line
                key={i}
                x1="0"
                y1="8"
                x2="0"
                y2="12"
                transform={`rotate(${(360 / 8) * i})`}
                strokeLinecap="round"
              />
            ))}
          </g>
        </g>
      </svg>

      {/* Panels */}
      <div className="sfarm-panels">
        <div className="sfarm-panel" style={{ backgroundColor: panelColor }} />
        <div className="sfarm-panel" style={{ backgroundColor: panelColor }} />
        <div className="sfarm-panel" style={{ backgroundColor: panelColor }} />
      </div>
    </Box>
  );
}


