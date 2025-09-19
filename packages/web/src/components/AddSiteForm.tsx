import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { getFirestoreCollections, detectCollectionType, testCollection } from '@/utils/firestore'
import { SystemType } from '@/types'
import { Building2, MapPin, Zap, Database, Plus, X } from 'lucide-react'
import SimpleCollectionPicker from './SimpleCollectionPicker'

export default function AddSiteForm() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [availableCollections, setAvailableCollections] = useState<string[]>([])
  const [detectedTypes, setDetectedTypes] = useState<{ [key: string]: SystemType | null }>({})

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    capacityMWp: '',
    systemType: 'SANGROW' as SystemType,
    sources: [{ type: 'SANGROW' as SystemType, collection: '' }],
    monthlyEstimates: Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      estimatedMWh: ''
    }))
  })

  useEffect(() => {
    loadCollections()
  }, [])

  const loadCollections = async () => {
    try {
      const collections = await getFirestoreCollections()
      setAvailableCollections(collections)
      
      // Her koleksiyon için veri tipini tespit et
      const types: { [key: string]: SystemType | null } = {}
      for (const collectionName of collections) {
        const type = await detectCollectionType(collectionName)
        types[collectionName] = type
      }
      setDetectedTypes(types)
    } catch (error) {
      console.error('Error loading collections:', error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleEstimateChange = (month: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      monthlyEstimates: prev.monthlyEstimates.map(est => 
        est.month === month ? { ...est, estimatedMWh: value } : est
      )
    }))
  }

  const autoGenerateEstimates = () => {
    const capacity = parseFloat(formData.capacityMWp)
    if (!capacity || capacity <= 0) {
      alert('Önce santral kapasitesini girin.')
      return
    }

    // Aylık güneş radyasyonu katsayıları (Türkiye ortalaması)
    const monthlyFactors = [
      0.6,  // Ocak
      0.7,  // Şubat  
      0.85, // Mart
      1.0,  // Nisan
      1.15, // Mayıs
      1.2,  // Haziran
      1.25, // Temmuz
      1.2,  // Ağustos
      1.0,  // Eylül
      0.85, // Ekim
      0.65, // Kasım
      0.55  // Aralık
    ]

    setFormData(prev => ({
      ...prev,
      monthlyEstimates: prev.monthlyEstimates.map((est, index) => {
        const monthFactor = monthlyFactors[index]
        const daysInMonth = new Date(2024, index + 1, 0).getDate()
        const estimatedMWh = (capacity * 4.5 * daysInMonth * monthFactor / 1000).toFixed(2)
        
        return {
          ...est,
          estimatedMWh
        }
      })
    }))
  }

  const handleSourceChange = async (index: number, field: 'type' | 'collection', value: string) => {
    setFormData(prev => ({
      ...prev,
      sources: prev.sources.map((source, i) => 
        i === index ? { ...source, [field]: value } : source
      )
    }))
    
    // Koleksiyon adı girilirse otomatik test et
    if (field === 'collection' && value.trim()) {
      try {
        const result = await testCollection(value.trim())
        if (result.exists && result.type) {
          setDetectedTypes(prev => ({
            ...prev,
            [value.trim()]: result.type
          }))
          
          // Otomatik tip güncelleme
          setFormData(prev => ({
            ...prev,
            sources: prev.sources.map((source, i) => 
              i === index ? { ...source, type: result.type! } : source
            )
          }))
        } else if (!result.exists) {
          setDetectedTypes(prev => ({
            ...prev,
            [value.trim()]: null
          }))
        }
      } catch (error) {
        console.error('Error testing collection:', error)
      }
    }
  }

  const addSource = () => {
    setFormData(prev => ({
      ...prev,
      sources: [...prev.sources, { type: 'SANGROW', collection: '' }]
    }))
  }

  const removeSource = (index: number) => {
    if (formData.sources.length > 1) {
      setFormData(prev => ({
        ...prev,
        sources: prev.sources.filter((_, i) => i !== index)
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validation
      if (!formData.name.trim() || !formData.capacityMWp || formData.sources.some(s => !s.collection.trim())) {
        alert('Lütfen tüm gerekli alanları doldurun.')
        return
      }

      const siteData = {
        name: formData.name.trim(),
        location: formData.location.trim() || '',
        capacityMWp: parseFloat(formData.capacityMWp),
        systemType: formData.systemType,
        sources: formData.sources.filter(s => s.collection.trim()),
        createdAt: serverTimestamp(),
        createdBy: user?.uid || ''
      }

      // Santral dokümanını ekle
      const siteDoc = await addDoc(collection(db, 'sites'), siteData)
      
      // Aylık tahminleri kaydet (sadece dolu olanları)
      const { ProductionEstimatesService } = await import('@/services/productionEstimatesService')
      const currentYear = new Date().getFullYear()
      
      for (const estimate of formData.monthlyEstimates) {
        if (estimate.estimatedMWh && parseFloat(estimate.estimatedMWh) > 0) {
          try {
            await ProductionEstimatesService.saveMonthlyEstimate(
              siteDoc.id,
              formData.name.trim(),
              estimate.month,
              parseFloat(estimate.estimatedMWh),
              user?.uid || ''
            )
          } catch (error) {
            console.warn(`Warning: Could not save estimate for month ${estimate.month}:`, error)
          }
        }
      }
      
      alert('Santral ve tahminler başarıyla eklendi!')
      navigate('/')
    } catch (error) {
      console.error('Error adding site:', error)
      alert('Santral eklenirken bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="md:grid md:grid-cols-3 md:gap-6">
        <div className="md:col-span-1">
          <div className="px-4 sm:px-0">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Yeni Santral Ekle
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Sisteme yeni bir güneş enerjisi santrali ekleyin. Bu santral için Firestore koleksiyonlarını bağlayarak real-time izleme başlatabilirsiniz.
            </p>
          </div>
        </div>

        <div className="mt-5 md:mt-0 md:col-span-2">
          <form onSubmit={handleSubmit}>
            <div className="shadow sm:rounded-md sm:overflow-hidden">
              <div className="px-4 py-5 bg-white space-y-6 sm:p-6">
                
                {/* Temel Bilgiler */}
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Santral Adı *
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                        <Building2 className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Örn: VOYAG ÇANKIRI"
                      />
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                      Lokasyon
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                        <MapPin className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="location"
                        id="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Örn: Çankırı, Türkiye"
                      />
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="capacityMWp" className="block text-sm font-medium text-gray-700">
                      Kapasite (MWp) *
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                        <Zap className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        name="capacityMWp"
                        id="capacityMWp"
                        required
                        step="0.1"
                        min="0"
                        value={formData.capacityMWp}
                        onChange={handleInputChange}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="7.7"
                      />
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="systemType" className="block text-sm font-medium text-gray-700">
                      Sistem Tipi *
                    </label>
                    <select
                      name="systemType"
                      id="systemType"
                      required
                      value={formData.systemType}
                      onChange={handleInputChange}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="SANGROW">SANGROW</option>
                      <option value="FUSION">FUSION</option>
                    </select>
                  </div>
                </div>

                {/* Aylık Tahminler */}
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium text-gray-900">Aylık Üretim Tahminleri (MWh)</h4>
                    <button
                      type="button"
                      onClick={autoGenerateEstimates}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200"
                    >
                      <Zap className="h-4 w-4 mr-1" />
                      Otomatik Hesapla
                    </button>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {formData.monthlyEstimates.map((estimate) => (
                      <div key={estimate.month} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">
                          {new Date(2024, estimate.month - 1, 1).toLocaleDateString('tr-TR', { month: 'long' })}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={estimate.estimatedMWh}
                          onChange={(e) => handleEstimateChange(estimate.month, e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                    ))}
                  </div>
                  
                  <p className="mt-2 text-sm text-gray-500">
                    💡 <strong>İpucu:</strong> Santral kapasitesini girdikten sonra "Otomatik Hesapla" butonuna tıklayarak Türkiye iklim koşullarına göre tahmini değerler oluşturabilirsiniz.
                  </p>
                </div>

                {/* Veri Kaynakları */}
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium text-gray-900">Veri Kaynakları</h4>
                    <button
                      type="button"
                      onClick={addSource}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Kaynak Ekle
                    </button>
                  </div>
                  
                  <div className="mt-4 space-y-4">
                    {formData.sources.map((source, index) => (
                      <div key={index} className="flex items-end space-x-4 p-4 border border-gray-200 rounded-lg">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700">
                            Sistem Tipi
                          </label>
                          <select
                            value={source.type}
                            onChange={(e) => handleSourceChange(index, 'type', e.target.value)}
                            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="SANGROW">SANGROW</option>
                            <option value="FUSION">FUSION</option>
                          </select>
                        </div>

                        <div className="flex-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Firestore Koleksiyonu *
                          </label>
                          
                          {/* Seçili koleksiyon gösterimi */}
                          {source.collection ? (
                            <div className="p-3 border border-green-300 rounded-md bg-green-50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <Database className="h-5 w-5 text-green-600 mr-2" />
                                  <span className="font-medium text-green-900">{source.collection}</span>
                                  {detectedTypes[source.collection] && (
                                    <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                                      detectedTypes[source.collection] === 'SANGROW' 
                                        ? 'bg-blue-100 text-blue-800' 
                                        : 'bg-green-100 text-green-800'
                                    }`}>
                                      {detectedTypes[source.collection]}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSourceChange(index, 'collection', '')}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <p className="mt-1 text-sm text-green-700">
                                ✓ Koleksiyon seçildi - Değiştirmek için X'e tıklayın
                              </p>
                            </div>
                          ) : (
                            <div className="border border-gray-300 rounded-md p-4">
                              <SimpleCollectionPicker
                                onSelectCollection={async (collectionName, type) => {
                                  await handleSourceChange(index, 'collection', collectionName)
                                  if (type) {
                                    setDetectedTypes(prev => ({
                                      ...prev,
                                      [collectionName]: type
                                    }))
                                  }
                                }}
                                selectedCollection={source.collection}
                              />
                            </div>
                          )}
                        </div>

                        {formData.sources.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSource(index)}
                            className="flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="mr-3 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Ekleniyor...' : 'Santral Ekle'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
