'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { collection, getDocs, query, where, documentId, orderBy, limit as fbLimit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Site, InverterData } from '@/types'
import { Building2, Zap, TrendingUp, AlertTriangle } from 'lucide-react'
import { subscribeToCollection } from '@/utils/firestore'
import { formatPower, formatEnergy, formatNumberTR } from '@/utils/format'
import { saveDailyProductionData } from '@/services/dailyProductionService'
import { useAuth } from '@/contexts/AuthContext'
import { getSolarTimeDescription } from '@/utils/solarTime'
// useAutoSaveTimer kaldırıldı - doğrudan Dashboard'da yapıyoruz

// Refactored components
import DashboardHeader from './dashboard/DashboardHeader'
import SaveStatusIndicators from './dashboard/SaveStatusIndicators'
import StatisticsCards from './dashboard/StatisticsCards'
import DailyTrendChart from './dashboard/DailyTrendChart'
import SiteCards from './dashboard/SiteCards'
import DashboardLists from './dashboard/DashboardLists'
import DataManagementStatus from './dashboard/DataManagementStatus'
import SystemHealthStatus from './dashboard/SystemHealthStatus'
// ManualSchedulerTrigger import removed - component deleted

export default function Dashboard() {
  const { user, getAccessibleSites } = useAuth()
  
  // Dashboard component loaded
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [allData, setAllData] = useState<Map<string, InverterData[]>>(new Map())
  const [summary, setSummary] = useState({
    totalPower: 0,
    dailyProduction: 0,
    totalProduction: 0, // kWh
    faultCount: 0,
  })
  const [history, setHistory] = useState<Array<{ t: string; power: number }>>([])
  const [dailySeries, setDailySeries] = useState<Array<{ date: string; production: number }>>([])
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  
  // Otomatik kayıt için state'ler
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null)
  const [autoSaveCount, setAutoSaveCount] = useState(0)
  
  // Otomatik kayıt fonksiyonu
  const performAutoSave = useCallback(async () => {
    const now = new Date()
    console.log(`🔄 [${now.toLocaleTimeString('tr-TR')}] Otomatik kayıt başlıyor...`)
    
    try {
      await saveDailyProductionData(undefined, false) // Otomatik kayıt
      setLastAutoSave(now)
      setAutoSaveCount(prev => prev + 1)
      console.log(`✅ Otomatik kayıt başarılı! #${autoSaveCount + 1}`)
    } catch (error) {
      console.error('❌ Otomatik kayıt hatası:', error)
    }
  }, [autoSaveCount])
  
  // Otomatik kayıt timer'ı
  useEffect(() => {
    console.log('⏰ Otomatik kayıt sistemi başlatılıyor...')
    
    // İlk kayıt - 3 saniye sonra
    const initialTimer = setTimeout(() => {
      console.log('🚀 İlk otomatik kayıt tetikleniyor...')
      performAutoSave()
    }, 3000)
    
    // Sonraki kayıtlar - her 5 dakikada bir
    const interval = setInterval(() => {
      console.log('⏰ 5 dakikalık otomatik kayıt tetikleniyor...')
      performAutoSave()
    }, 5 * 60 * 1000) // 5 dakika
    
    return () => {
      console.log('🛑 Otomatik kayıt sistemi durduruluyor...')
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [performAutoSave])

  useEffect(() => {
    fetchSites()
  }, [])

  // User değiştiğinde yeniden fetch et ve data temizle
  useEffect(() => {
    if (user) {
      // Data ve history'yi temizle
      setAllData(new Map())
      setHistory([])
      setSummary({
        totalPower: 0,
        dailyProduction: 0,
        totalProduction: 0,
        faultCount: 0,
      })
      // Saha listesini temizle ve yeniden yükle
      setSites([])
      fetchSites()
    }
  }, [user])

  const fetchSites = async () => {
    try {
      // Viewer için sadece atanan sahaları sorgula
      const accessibleSites = getAccessibleSites()
      let sitesSnapshot
      if (accessibleSites.length > 0) {
        const qSites = query(collection(db, 'sites'), where(documentId(), 'in', accessibleSites))
        sitesSnapshot = await getDocs(qSites)
      } else {
        sitesSnapshot = await getDocs(collection(db, 'sites'))
      }

      let sitesData = sitesSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' 
            ? data.createdAt.toDate() 
            : new Date()
        }
      }) as Site[]

      // Sites loaded successfully

      setSites(sitesData)
      fetchDailySeries()
    } catch (error) {
      console.error('Error fetching sites:', error)
    } finally {
      setLoading(false)
    }
  }

  // Son 7 günün günlük üretim toplamlarını getir
  const fetchDailySeries = async () => {
    try {
      const q = query(collection(db, 'daily_production'), orderBy('date', 'desc'), fbLimit(7))
      const snap = await getDocs(q)
      const arr: Array<{ date: string; production: number }> = []
      snap.forEach(doc => {
        const data: any = doc.data()
        const kwh = data?.summary?.totalProduction || 0
        arr.push({ date: data.date, production: kwh })
      })
      setDailySeries(arr.reverse())
    } catch (e) {
      console.error('Error fetching daily series:', e)
    }
  }

  // Subscribe to all site data sources for realtime summary
  useEffect(() => {
    if (sites.length === 0) return
    
    console.log('🔄 Dashboard - Starting real-time data listening for sites:', sites.map(s => s.id))

    const unsubscribeFns: Array<() => void> = []

    sites.forEach(site => {
      site.sources.forEach(source => {
        const unsubscribe = subscribeToCollection(
          source.collection,
          source.type,
          (inverters: InverterData[]) => {
            setAllData(prev => {
              const next = new Map(prev)
              next.set(`${site.id}:${source.collection}`, inverters)
              return next
            })
          }
        )
        unsubscribeFns.push(unsubscribe)
      })
    })

    return () => {
      unsubscribeFns.forEach(fn => fn())
    }
  }, [sites])

  // Recompute summary whenever data changes - İyileştirilmiş arıza tespiti
  useEffect(() => {
    const allInverters: InverterData[] = Array.from(allData.values()).flat()
    const currentTime = new Date()
    const solarInfo = getSolarTimeDescription(currentTime)

    const totalPower = allInverters.reduce((sum, inv) => sum + (inv.activePower || 0), 0)
    const dailyProduction = allInverters.reduce((sum, inv) => sum + (inv.dailyYield || 0), 0)
    const totalProduction = allInverters.reduce((sum, inv) => sum + (inv.totalYield || 0), 0) // kWh

    // Akıllı arıza tespiti - sadece güneş saatlerinde
    let faultCount = 0
    if (solarInfo.phase !== 'night') {
      faultCount = allInverters.filter(inv => {
        const s = (inv.status || '').toString().toLowerCase()
        const hasFault = s.includes('fault') || s.includes('error') || s.includes('alarm')
        const isOffline = s.includes('offline') && solarInfo.phase !== 'night'
        const hasLowPower = (inv.activePower || 0) < (solarInfo.expectedPowerRatio * 0.5)
        
        // Gündüz saatinde düşük performans = potansiyel sorun
        return hasFault || isOffline || (solarInfo.phase === 'peak' && hasLowPower)
      }).length
    }

    setSummary({ totalPower, dailyProduction, totalProduction, faultCount })
  }, [allData])

  // Basit oturum içi güç geçmişi grafiği için örnek data tut
  useEffect(() => {
    const id = setInterval(() => {
      setHistory(prev => {
        const next = [...prev, { t: new Date().toLocaleTimeString('tr-TR', { hour12: false }), power: summary.totalPower }]
        return next.slice(-60)
      })
    }, 30000)
    return () => clearInterval(id)
  }, [summary.totalPower])

  // Otomatik kayıt durumunu takip et
  useEffect(() => {
    // Başlangıçta next auto save zamanını hesapla
    const calculateNextAutoSave = () => {
      const now = new Date()
      const minutes = now.getMinutes()
      const nextMinute = Math.ceil(minutes / 10) * 10
      const nextSave = new Date(now)
      
      if (nextMinute >= 60) {
        nextSave.setHours(nextSave.getHours() + 1)
        nextSave.setMinutes(0)
      } else {
        nextSave.setMinutes(nextMinute)
      }
      nextSave.setSeconds(0)
      
      return nextSave.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    }

    // setNextAutoSave fonksiyonu tanımlı değil, bu kısmı kaldırıyoruz
    // Auto-save mantığı zaten başka yerde var

    // Her dakika kontrol et
    const interval = setInterval(() => {
      const now = new Date()
      const minutes = now.getMinutes()
      
      // Eğer tam 10'un katı dakikadaysak, son auto save zamanını güncelle
      if (minutes % 10 === 0 && now.getSeconds() === 0) {
        setLastAutoSave(now)
      }
    }, 60000) // Her dakika kontrol et

    return () => clearInterval(interval)
  }, [])

  // Manuel günlük veri kaydetme - useCallback for performance
  const handleSaveDailyData = useCallback(async () => {
    setIsSaving(true)
    try {
      // Akıllı tarih seçimi ile manuel kayıt
      await saveDailyProductionData(undefined, true) // Manuel kayıt - tarih seçimi içinde
      const now = new Date().toLocaleString('tr-TR')
      setLastSaved(now)
      alert('✅ Günlük üretim verileri başarıyla kaydedildi!\n\n📅 Kaydedilen tarih doğru seçildi.')
    } catch (error) {
      console.error('Error saving daily data:', error)
      alert('❌ Veri kaydetme sırasında hata oluştu!\n\nDetay: ' + (error as Error).message)
    } finally {
      setIsSaving(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  // Memoized calculations for better performance
  const totalCapacity = useMemo(() => 
    sites.reduce((sum, site) => sum + site.capacityMWp, 0),
    [sites]
  )

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <DashboardHeader
        isSaving={isSaving}
        onSaveDailyData={handleSaveDailyData}
      />

      {/* Auto-save Status - Removed due to missing imports */}

      {/* System Health Overview */}
      <SystemHealthStatus
        totalSites={sites.length}
        totalInverters={Array.from(allData.values()).flat().length}
        faultCount={summary.faultCount}
        totalPower={summary.totalPower}
        expectedPower={totalCapacity * 1000 * getSolarTimeDescription().expectedPowerRatio}
      />

      {/* Comprehensive Data Management Status */}
      <DataManagementStatus
        lastSaved={lastSaved}
        lastAutoSave={lastAutoSave ? lastAutoSave.toLocaleTimeString('tr-TR') : null}
        nextAutoSave={null}
      />

      {/* Statistics Cards */}
      <StatisticsCards 
        totalSites={sites.length}
        totalCapacity={totalCapacity}
        summary={summary}
      />

      {/* Daily Trend Chart */}
      <DailyTrendChart dailySeries={dailySeries} />

      {/* Dashboard Lists */}
      <DashboardLists sites={sites} allData={allData} />

      {/* Site Cards */}
      <SiteCards sites={sites} allData={allData} />
    </div>
  )
}

// Helper components moved to separate files for better maintainability
