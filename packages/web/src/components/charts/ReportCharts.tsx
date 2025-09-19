'use client'

import { useEffect, useState } from 'react'
import { formatPower, formatEnergy } from '@/utils/format'

interface ChartData {
  date: string
  fullDate: string
  production: number
  power: number
  sites: number
}

interface PieData {
  name: string
  value: number
  fill: string
}

interface ProductionChartProps {
  data: ChartData[]
  chartType: 'line' | 'bar' | 'area'
  loading?: boolean
}

interface SiteDistributionChartProps {
  data: PieData[]
  loading?: boolean
}

// Fixed size chart component without ResponsiveContainer
function FixedSizeChart({ data, chartType }: { data: ChartData[], chartType: string }) {
  const [recharts, setRecharts] = useState<any>(null)

  useEffect(() => {
    const loadRecharts = async () => {
      try {
        const rechartsModule = await import('recharts')
        setRecharts(rechartsModule)
      } catch (error) {
        console.error('Failed to load recharts:', error)
      }
    }
    
    loadRecharts()
  }, [])

  if (!recharts) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const { AreaChart, LineChart, BarChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip } = recharts

  // Fixed dimensions to avoid ResponsiveContainer issues
  const chartWidth = 600
  const chartHeight = 250

  return (
    <div className="w-full overflow-x-auto">
      {chartType === 'area' && (
        <AreaChart width={chartWidth} height={chartHeight} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip 
            formatter={(value: any, name: any) => [
              name === 'production' ? `${formatEnergy(value as number)}` : `${formatPower(value as number)}`,
              name === 'production' ? 'Üretim' : 'Güç'
            ]}
          />
          <Area type="monotone" dataKey="production" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
        </AreaChart>
      )}
      {chartType === 'line' && (
        <LineChart width={chartWidth} height={chartHeight} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip 
            formatter={(value: any, name: any) => [
              name === 'production' ? `${formatEnergy(value as number)}` : `${formatPower(value as number)}`,
              name === 'production' ? 'Üretim' : 'Güç'
            ]}
          />
          <Line type="monotone" dataKey="production" stroke="#8884d8" strokeWidth={2} />
          <Line type="monotone" dataKey="power" stroke="#82ca9d" strokeWidth={2} />
        </LineChart>
      )}
      {chartType === 'bar' && (
        <BarChart width={chartWidth} height={chartHeight} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip 
            formatter={(value: any, name: any) => [
              name === 'production' ? `${formatEnergy(value as number)}` : `${formatPower(value as number)}`,
              name === 'production' ? 'Üretim' : 'Güç'
            ]}
          />
          <Bar dataKey="production" fill="#8884d8" />
        </BarChart>
      )}
    </div>
  )
}

// Fixed size pie chart
function FixedSizePieChart({ data }: { data: PieData[] }) {
  const [recharts, setRecharts] = useState<any>(null)

  useEffect(() => {
    const loadRecharts = async () => {
      try {
        const rechartsModule = await import('recharts')
        setRecharts(rechartsModule)
      } catch (error) {
        console.error('Failed to load recharts:', error)
      }
    }
    
    loadRecharts()
  }, [])

  if (!recharts) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const { PieChart, Pie, Cell, Tooltip } = recharts

  return (
    <div className="w-full flex justify-center">
      <PieChart width={400} height={250}>
        <Pie
          data={data.slice(0, 8)}
          cx={200}
          cy={125}
          outerRadius={80}
          dataKey="value"
          label={({name, percent}: any) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.slice(0, 8).map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip formatter={(value: any) => [`${formatEnergy(value as number)}`, 'Üretim']} />
      </PieChart>
    </div>
  )
}

export function ProductionChart({ data, chartType, loading = false }: ProductionChartProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (loading || !data || data.length === 0 || !isMounted) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="h-64 flex items-center justify-center">
      <FixedSizeChart data={data} chartType={chartType} />
    </div>
  )
}

export function SiteDistributionChart({ data, loading = false }: SiteDistributionChartProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (loading || !data || data.length === 0 || !isMounted) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="h-64 flex items-center justify-center">
      <FixedSizePieChart data={data} />
    </div>
  )
}