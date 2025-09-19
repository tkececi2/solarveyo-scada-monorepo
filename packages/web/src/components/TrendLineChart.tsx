import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTheme } from '@mui/material/styles';

interface ChartData {
  name: string;
  value: number;
}

interface TrendLineChartProps {
  data: ChartData[];
  height?: number;
}

export default function TrendLineChart({ data, height = 320 }: TrendLineChartProps) {
  const theme = useTheme();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
        <XAxis 
          dataKey="name" 
          stroke={theme.palette.text.secondary}
          fontSize={12}
        />
        <YAxis 
          stroke={theme.palette.text.secondary}
          fontSize={12}
          tickFormatter={(value) => `${(value/1000).toLocaleString('tr-TR', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 1 
          })}k`}
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: theme.shape.borderRadius,
            boxShadow: theme.shadows[3],
          }}
          formatter={(value: any) => [
            `${(value as number).toLocaleString('tr-TR', { 
              minimumFractionDigits: 1, 
              maximumFractionDigits: 1 
            })} kWh`,
            'Üretim'
          ]}
          labelFormatter={(label) => `Tarih: ${label}`}
        />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke={theme.palette.primary.main}
          strokeWidth={2}
          dot={{ 
            r: 4, 
            stroke: theme.palette.primary.main, 
            fill: theme.palette.primary.main,
            strokeWidth: 2
          }}
          activeDot={{ 
            r: 6, 
            stroke: theme.palette.primary.main,
            fill: theme.palette.primary.light 
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

