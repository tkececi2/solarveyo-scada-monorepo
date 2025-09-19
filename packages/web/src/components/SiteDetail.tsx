'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Site, InverterData } from '@/types'
import { subscribeToCollection } from '@/utils/firestore'
import { formatPower, formatEnergy } from '@/utils/format'
import { Building2, Zap, TrendingUp, AlertTriangle, Thermometer, Activity, Lock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import InverterViewManager from './InverterViewManager'

export default function SiteDetail({ siteId }: { siteId: string }) {
  const { canAccessSite } = useAuth()
  const [site, setSite] = useState<Site | null>(null)
  const [inverterData, setInverterData] = useState<InverterData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSite()
  }, [siteId])

  useEffect(() => {
    if (!site) return

    const unsubscribeFunctions: (() => void)[] = []

    // Her veri kaynağı için subscription oluştur
    site.sources.forEach(source => {
      const unsubscribe = subscribeToCollection(
        source.collection,
        source.type,
        (data) => {
          setInverterData(prev => {
            // Aynı koleksiyondan gelen eski verileri kaldır, yenilerini ekle
            const filtered = prev.filter(item => 
              !data.some(newItem => newItem.id === item.id)
            )
            return [...filtered, ...data]
          })
        }
      )
      unsubscribeFunctions.push(unsubscribe)
    })

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
    }
  }, [site])

  const fetchSite = async () => {
    try {
      const siteDoc = await getDoc(doc(db, 'sites', siteId))
      if (siteDoc.exists()) {
        const data = siteDoc.data()
        const siteData = {
          id: siteDoc.id,
          ...data,
          createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' 
            ? data.createdAt.toDate() 
            : new Date()
        } as Site
        setSite(siteData)
      } else {
        setError('Santral bulunamadı.')
      }
    } catch (error) {
      console.error('Error fetching site:', error)
      setError('Santral bilgileri yüklenirken bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error || !site) {
    return (
      <div className="text-center py-12">
        <Building2 className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Hata</h3>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
      </div>
    )
  }

  // Saha erişim kontrolü
  if (!canAccessSite(siteId)) {
    return (
      <div className="text-center py-12">
        <Lock className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Erişim Reddedildi</h3>
        <p className="mt-1 text-sm text-gray-500">
          Bu sahaya erişim yetkiniz bulunmamaktadır.
        </p>
      </div>
    )
  }

  // İstatistikleri hesapla
  const totalActivePower = inverterData.reduce((sum, item) => sum + item.activePower, 0)
  const totalDailyYield = inverterData.reduce((sum, item) => sum + item.dailyYield, 0)
  const totalYield = inverterData.reduce((sum, item) => sum + item.totalYield, 0)
  const faultCount = inverterData.filter(item => {
    const status = item.status?.toString().toLowerCase() || ''
    return status.includes('fault') || 
           status.includes('error') ||
           status.includes('alarm') ||
           status.includes('warning')
  }).length

  const sangrowData = inverterData.filter(item => item.systemType === 'SANGROW')
  const fusionData = inverterData.filter(item => item.systemType === 'FUSION')

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div>
        <div className="flex items-center space-x-3">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
            site.systemType === 'SANGROW' ? 'bg-blue-100' : 'bg-green-100'
          }`}>
            <Building2 className={`h-4 w-4 ${
              site.systemType === 'SANGROW' ? 'text-blue-600' : 'text-green-600'
            }`} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{site.name}</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {site.location} • {site.capacityMWp} MWp • {site.systemType}
        </p>
      </div>

      {/* İstatistik kartları */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Anlık Güç"
          value={formatPower(totalActivePower)}
          icon={Zap}
          color="bg-green-500"
        />
        <StatCard
          title="Günlük Üretim"
          value={formatEnergy(totalDailyYield)}
          icon={TrendingUp}
          color="bg-blue-500"
        />
        <StatCard
          title="Toplam Üretim"
          value={formatEnergy(totalYield, 'MWh')}
          icon={Activity}
          color="bg-purple-500"
        />
        <StatCard
          title="Çalışmayan Sayısı"
          value={faultCount.toString()}
          icon={AlertTriangle}
          color={faultCount > 0 ? "bg-red-500" : "bg-green-500"}
        />
      </div>

      {/* Veri görünümü */}
      <div className="space-y-6">
        {sangrowData.length > 0 && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">SANGROW İnverterler</h2>
            <InverterViewManager data={sangrowData} />
          </div>
        )}

        {fusionData.length > 0 && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">FUSION Sistemler</h2>
            <InverterViewManager data={fusionData} />
          </div>
        )}

        {inverterData.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Activity className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Veri bekleniyor</h3>
            <p className="mt-1 text-sm text-gray-500">
              Koleksiyonlardan veri geldiğinde burada görünecek.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Veri kaynakları: {site.sources.map(s => s.collection).join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }: {
  title: string
  value: string
  icon: any
  color: string
}) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`h-8 w-8 rounded-md ${color} flex items-center justify-center`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {value}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
