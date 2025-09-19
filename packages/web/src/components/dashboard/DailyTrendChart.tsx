import { TrendingUp } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { formatEnergy, formatNumberTR } from '@/utils/format'

interface DailyTrendChartProps {
  dailySeries: Array<{ date: string; production: number }>;
}

export default function DailyTrendChart({ dailySeries }: DailyTrendChartProps) {
  return (
    <div className="bg-white shadow-sm hover:shadow-md transition-shadow duration-200 rounded-lg border border-gray-100 p-6">
      <div className="flex items-center mb-4">
        <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
        <h3 className="text-lg font-bold text-gray-900">📈 Günlük Üretim Trendi (Son 7 Gün)</h3>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dailySeries} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v)=>`${formatNumberTR(Number(v), 0)}`} />
            <Tooltip 
              formatter={(v)=>`${formatEnergy(v as number)}`} 
              labelFormatter={(l)=>`Tarih: ${l}`}
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="production" 
              stroke="#2563eb" 
              strokeWidth={3} 
              dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
