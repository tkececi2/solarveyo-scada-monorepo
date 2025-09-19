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

interface SimpleChartProps {
  data: ChartData[]
  chartType: 'line' | 'bar' | 'area'
  loading?: boolean
}

interface SimplePieChartProps {
  data: PieData[]
  loading?: boolean
}

// CSS-based responsive wrapper
function ResponsiveWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div 
      className="w-full h-64"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '600px',
          height: '250px',
          transform: 'scale(1)',
          transformOrigin: 'center center'
        }}
      >
        {children}
      </div>
    </div>
  )
}

// Simple chart without problematic ResponsiveContainer
function SimpleChart({ data, chartType }: { data: ChartData[], chartType: string }) {
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

  const chartProps = {
    width: 600,
    height: 250,
    data: data,
    margin: { top: 20, right: 30, left: 20, bottom: 5 }
  }

  const commonElements = (
    <>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis 
        dataKey="date" 
        fontSize={12}
        tick={{ fontSize: 10 }}
      />
      <YAxis 
        fontSize={12}
        tick={{ fontSize: 10 }}
      />
      <Tooltip 
        contentStyle={{
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
        formatter={(value: any, name: any) => [
          name === 'production' ? `${formatEnergy(value as number)}` : `${formatPower(value as number)}`,
          name === 'production' ? 'Üretim' : 'Güç'
        ]}
      />
    </>
  )

  return (
    <ResponsiveWrapper>
      {chartType === 'area' && (
        <AreaChart {...chartProps}>
          {commonElements}
          <Area 
            type="monotone" 
            dataKey="production" 
            stackId="1" 
            stroke="#8884d8" 
            fill="#8884d8" 
            fillOpacity={0.6} 
          />
        </AreaChart>
      )}
      {chartType === 'line' && (
        <LineChart {...chartProps}>
          {commonElements}
          <Line type="monotone" dataKey="production" stroke="#8884d8" strokeWidth={2} />
          <Line type="monotone" dataKey="power" stroke="#82ca9d" strokeWidth={2} />
        </LineChart>
      )}
      {chartType === 'bar' && (
        <BarChart {...chartProps}>
          {commonElements}
          <Bar dataKey="production" fill="#8884d8" />
        </BarChart>
      )}
    </ResponsiveWrapper>
  )
}

// Simple pie chart
function SimplePieChart({ data }: { data: PieData[] }) {
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

  const { PieChart, Pie, Cell, Tooltip, Legend } = recharts

  return (
    <ResponsiveWrapper>
      <PieChart width={600} height={250}>
        <Pie
          data={data.slice(0, 8)}
          cx={300}
          cy={125}
          outerRadius={60}
          dataKey="value"
          label={({name, percent}: any) => `${name.substring(0, 10)} ${(percent * 100).toFixed(0)}%`}
        >
          {data.slice(0, 8).map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: any) => [`${formatEnergy(value as number)}`, 'Üretim']}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
      </PieChart>
    </ResponsiveWrapper>
  )
}

export function SimpleProductionChart({ data, chartType, loading = false }: SimpleChartProps) {
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

  return <SimpleChart data={data} chartType={chartType} />
}

export function SimpleSiteDistributionChart({ data, loading = false }: SimplePieChartProps) {
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

  return <SimplePieChart data={data} />
}

