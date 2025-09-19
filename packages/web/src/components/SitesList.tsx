import { useState, useEffect } from 'react'
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Site, InverterData } from '@/types'
import { Building2, MapPin, Zap, Database, Trash2, Eye, Calendar, AlertTriangle, Power, PowerOff, Activity, Edit2, Save, X, Sun, Lightbulb, Factory, Battery } from 'lucide-react'
import { subscribeToCollection, detectCollectionType, subscribeToPVStringStates, parseAndCompareSiteNames } from '@/utils/firestore'
import { formatPower, formatEnergy } from '@/utils/format'
import { useAuth } from '@/contexts/AuthContext'
import { Link } from 'react-router-dom'

interface SiteData {
  site: Site
  inverters: InverterData[]
  stats: {
    totalInverters: number
    activeInverters: number
    faultInverters: number
    totalPVs: number
    activePVs: number
    inactivePVs: number
    totalPower: number
    dailyYield: number
  }
}

export default function SitesList() {
  const { user, canAccessSite, getAccessibleSites, isAdmin, isManager } = useAuth()
  const [sites, setSites] = useState<Site[]>([])
  const [siteData, setSiteData] = useState<Map<string, SiteData>>(new Map())
  const [pvStates, setPvStates] = useState<Map<string, Map<string, boolean>>>(new Map()) // inverterId -> stringKey -> isActive
  const [loading, setLoading] = useState(true)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [editForm, setEditForm] = useState({ name: '', capacityMWp: 0, location: '' })

  useEffect(() => {
    fetchSites()
  }, [])

  // User değiştiğinde yeniden fetch et
  useEffect(() => {
    if (user) {
      fetchSites()
    }
  }, [user, getAccessibleSites])

  useEffect(() => {
    // Her site için veri dinlemeyi başlat
    const unsubscribeFunctions: (() => void)[] = []
    
    sites.forEach(site => {
      site.sources.forEach(source => {
        const unsubscribe = subscribeToCollection(
          source.collection,
          source.type,
          (inverters) => {
            // PV states ile birlikte stats hesapla
            const siteStates = pvStates.get(site.id) || new Map()
            const stats = calculateSiteStats(inverters, siteStates)
            setSiteData(prev => {
              const newMap = new Map(prev)
              newMap.set(site.id, {
                site,
                inverters,
                stats
              })
              return newMap
            })
            
            // Her inverter için PV states dinle
            inverters.forEach(inverter => {
              const pvUnsubscribe = subscribeToPVStringStates(inverter.id, (states) => {
                setPvStates(prev => {
                  const newMap = new Map(prev)
                  if (!newMap.has(site.id)) {
                    newMap.set(site.id, new Map())
                  }
                  const siteStates = newMap.get(site.id)!
                  states.forEach((isActive, stringKey) => {
                    siteStates.set(`${inverter.id}_${stringKey}`, isActive)
                  })
                  return newMap
                })
              })
              unsubscribeFunctions.push(pvUnsubscribe)
            })
          }
        )
        unsubscribeFunctions.push(unsubscribe)
      })
    })

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
    }
  }, [sites])

  // PV states değiştiğinde stats'i yeniden hesapla
  useEffect(() => {
    siteData.forEach((data, siteId) => {
      const siteStates = pvStates.get(siteId) || new Map()
      const newStats = calculateSiteStats(data.inverters, siteStates)
      
      if (JSON.stringify(newStats) !== JSON.stringify(data.stats)) {
        setSiteData(prev => {
          const newMap = new Map(prev)
          newMap.set(siteId, {
            ...data,
            stats: newStats
          })
          return newMap
        })
      }
    })
  }, [pvStates])

  const fetchSites = async () => {
    try {
      const sitesSnapshot = await getDocs(collection(db, 'sites'))
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

      // Viewer kullanıcılar için saha filtreleme
      const accessibleSites = getAccessibleSites()
      if (accessibleSites.length > 0) {
        sitesData = sitesData.filter(site => accessibleSites.includes(site.id))
      }

      setSites(sitesData)
    } catch (error) {
      console.error('Error fetching sites:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateSiteStats = (inverters: InverterData[], siteStates: Map<string, boolean> = new Map()) => {
    const totalInverters = inverters.length
    const activeInverters = inverters.filter(inv => 
      inv.status.toLowerCase().includes('normal') || 
      inv.status.toLowerCase().includes('run') ||
      inv.activePower > 0
    ).length
    const faultInverters = inverters.filter(inv => 
      inv.status.toLowerCase().includes('fault') || 
      inv.status.toLowerCase().includes('error') ||
      inv.status.toLowerCase().includes('alarm') ||
      inv.status.toLowerCase().includes('warning')
    ).length

    let totalPVs = 0
    let activePVs = 0
    let inactivePVs = 0

    // Helper function: PV aktif mi kontrol et
    const isPVActive = (inverterId: string, stringKey: string): boolean => {
      const key = `${inverterId}_${stringKey}`
      return siteStates.get(key) !== false // undefined = aktif, false = pasif
    }

    inverters.forEach(inv => {
      if (inv.mpptData) {
        const pvs = inv.mpptData.filter(([key]) => key.startsWith('PV'))
        
        // Sadece aktif PV'leri say (pasif olanları hariç tut)
        const activePvs = pvs.filter(([key]) => isPVActive(inv.id, key))
        
        totalPVs += activePvs.length
        // SADECE AKIM DEĞERİNE BAK
        activePVs += activePvs.filter(([_, value]) => {
          const current = value?.current !== undefined ? value.current : (value?.I !== undefined ? value.I : 0)
          return current > 0
        }).length
        inactivePVs += activePvs.filter(([_, value]) => {
          const current = value?.current !== undefined ? value.current : (value?.I !== undefined ? value.I : 0)
          return current === 0
        }).length
      }
    })

    const totalPower = inverters.reduce((sum, inv) => sum + inv.activePower, 0)
    const dailyYield = inverters.reduce((sum, inv) => sum + inv.dailyYield, 0)

    return {
      totalInverters,
      activeInverters,
      faultInverters,
      totalPVs,
      activePVs,
      inactivePVs,
      totalPower,
      dailyYield
    }
  }

  const handleDeleteSite = async (siteId: string, siteName: string) => {
    if (confirm(`"${siteName}" santralını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
      try {
        await deleteDoc(doc(db, 'sites', siteId))
        setSites(sites.filter(site => site.id !== siteId))
        alert('Santral başarıyla silindi.')
      } catch (error) {
        console.error('Error deleting site:', error)
        alert('Santral silinirken bir hata oluştu.')
      }
    }
  }

  const handleEditSite = (site: Site) => {
    setEditingSite(site)
    setEditForm({
      name: site.name,
      capacityMWp: site.capacityMWp,
      location: site.location || ''
    })
  }

  const handleSaveEdit = async () => {
    if (!editingSite) return

    try {
      await updateDoc(doc(db, 'sites', editingSite.id), {
        name: editForm.name,
        capacityMWp: editForm.capacityMWp,
        location: editForm.location || null
      })

      // Local state güncelle
      setSites(sites.map(site => 
        site.id === editingSite.id 
          ? { ...site, name: editForm.name, capacityMWp: editForm.capacityMWp, location: editForm.location || undefined }
          : site
      ))

      setEditingSite(null)
      alert('Santral başarıyla güncellendi.')
    } catch (error) {
      console.error('Error updating site:', error)
      alert('Santral güncellenirken bir hata oluştu.')
    }
  }

  const handleCancelEdit = () => {
    setEditingSite(null)
    setEditForm({ name: '', capacityMWp: 0, location: '' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Santrallar
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Sisteme kayıtlı {sites.length} santral
          </p>
        </div>
        {isManager && (
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Link
              to="/add-site"
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Santral Ekle
            </Link>
          </div>
        )}
      </div>

      {sites.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Santral bulunamadı</h3>
          <p className="mt-1 text-sm text-gray-500">
            Henüz sisteme santral eklenmemiş. İlk santralınızı eklemek için "Santral Ekle" butonunu kullanın.
          </p>
          {isManager && (
            <div className="mt-6">
              <Link
                to="/add-site"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Building2 className="mr-2 h-4 w-4" />
                İlk Santralı Ekle
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sites
            .sort((a, b) => parseAndCompareSiteNames(a.name, b.name))
            .map((site) => {
            const data = siteData.get(site.id)
            return (
              <div key={site.id} className="bg-white overflow-hidden shadow-lg rounded-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center relative ${
                        site.systemType === 'SANGROW' ? 'bg-orange-100' : 'bg-green-100'
                      }`}>
                        {/* Ana güneş ikonu */}
                        <Sun className={`h-7 w-7 ${
                          site.systemType === 'SANGROW' ? 'text-orange-600' : 'text-green-600'
                        }`} />
                        {/* Küçük elektrik simgesi */}
                        <Zap className={`h-3 w-3 absolute -bottom-0.5 -right-0.5 ${
                          site.systemType === 'SANGROW' ? 'text-orange-500 bg-orange-100' : 'text-green-500 bg-green-100'
                        } rounded-full p-0.5`} />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {site.name}
                        </h3>
                        <div className="flex items-center text-sm text-gray-500 space-x-3">
                          <span className="flex items-center">
                            <Factory className="h-3 w-3 mr-1" />
                            {site.systemType}
                          </span>
                          <span className="flex items-center">
                            <Battery className="h-3 w-3 mr-1" />
                            {site.capacityMWp} MWp
                          </span>
                          {site.location && (
                            <span className="flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {site.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Status indicator */}
                    <div className="flex items-center">
                      {data && data.stats.faultInverters > 0 ? (
                        <div className="flex items-center text-red-600">
                          <AlertTriangle className="h-5 w-5 mr-1" />
                          <span className="text-xs font-medium">Çalışmıyor</span>
                        </div>
                      ) : data && data.stats.totalPower > 0 ? (
                        <div className="flex items-center text-green-600">
                          <Power className="h-5 w-5 mr-1" />
                          <span className="text-xs font-medium">Aktif</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-gray-500">
                          <PowerOff className="h-5 w-5 mr-1" />
                          <span className="text-xs font-medium">Beklemede</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Real-time stats */}
                {data ? (
                  <div className="p-6">
                    {/* Power and Production */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-green-600 font-medium">Anlık Güç</p>
                            <p className="text-lg font-bold text-green-900">
                              {formatPower(data.stats.totalPower)}
                            </p>
                          </div>
                          <Power className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-blue-600 font-medium">Günlük Üretim</p>
                            <p className="text-lg font-bold text-blue-900">
                              {formatEnergy(data.stats.dailyYield)}
                            </p>
                          </div>
                          <Sun className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                    </div>

                    {/* Equipment Status */}
                    <div className="space-y-3">
                      {/* Inverters */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <Building2 className="h-5 w-5 text-gray-600 mr-2" />
                          <span className="text-sm font-medium text-gray-900">İnverterler</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            {data.stats.activeInverters} Aktif
                          </span>
                          {data.stats.faultInverters > 0 && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                              {data.stats.faultInverters} Çalışmıyor
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            / {data.stats.totalInverters}
                          </span>
                        </div>
                      </div>

                      {/* PV Strings */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <Power className="h-5 w-5 text-gray-600 mr-2" />
                          <span className="text-sm font-medium text-gray-900">PV Stringler</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            {data.stats.activePVs} Çalışan
                          </span>
                          {data.stats.inactivePVs > 0 && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                              {data.stats.inactivePVs} Uyku
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            / {data.stats.totalPVs}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Location */}
                    {site.location && (
                      <div className="mt-4 flex items-center text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-2" />
                        {site.location}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="animate-pulse space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="h-16 bg-gray-200 rounded-lg"></div>
                        <div className="h-16 bg-gray-200 rounded-lg"></div>
                      </div>
                      <div className="h-12 bg-gray-200 rounded-lg"></div>
                      <div className="h-12 bg-gray-200 rounded-lg"></div>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between">
                  <div className="flex space-x-2">
                    {canAccessSite(site.id) && (
                      <Link
                        to={`/sites/${site.id}`}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Detaylar
                      </Link>
                    )}
                    
                    {isManager && (
                      <button
                        onClick={() => handleEditSite(site)}
                        className="inline-flex items-center px-3 py-2 border border-blue-300 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Düzenle
                      </button>
                    )}
                  </div>
                  
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteSite(site.id, site.name)}
                      className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Sil
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Santral Düzenle</h3>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Santral Adı
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Santral adını girin"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kapasite (MWp)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editForm.capacityMWp}
                  onChange={(e) => setEditForm({ ...editForm, capacityMWp: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Kapasite (MWp)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Konum (İsteğe bağlı)
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Konum bilgisi"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                İptal
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editForm.name.trim()}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4 mr-2 inline" />
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
