'use client'

import { useState, useEffect } from 'react'
import { getFirestoreCollections, detectCollectionType } from '@/utils/firestore'
import { SystemType } from '@/types'
import { Database, RefreshCw, Settings as SettingsIcon } from 'lucide-react'

export default function Settings() {
  const [collections, setCollections] = useState<string[]>([])
  const [detectedTypes, setDetectedTypes] = useState<{ [key: string]: SystemType | null }>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadCollections()
  }, [])

  const loadCollections = async () => {
    setLoading(true)
    try {
      const collections = await getFirestoreCollections()
      setCollections(collections)
      
      const types: { [key: string]: SystemType | null } = {}
      for (const collectionName of collections) {
        const type = await detectCollectionType(collectionName)
        types[collectionName] = type
      }
      setDetectedTypes(types)
    } catch (error) {
      console.error('Error loading collections:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ayarlar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sistem konfigürasyonu ve Firestore koleksiyonları
        </p>
      </div>

      {/* Koleksiyon durumu */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Firestore Koleksiyonları
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Sistemde mevcut koleksiyonlar ve algılanan veri tipleri
              </p>
            </div>
            <button
              onClick={loadCollections}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Yenile
            </button>
          </div>

          <div className="mt-6">
            {collections.length === 0 ? (
              <div className="text-center py-6">
                <Database className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Koleksiyon bulunamadı
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Firestore'da erişilebilir koleksiyon bulunmuyor.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {collections.map((collection) => (
                  <div
                    key={collection}
                    className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <Database className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="focus:outline-none">
                          <span className="absolute inset-0" aria-hidden="true" />
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {collection}
                          </p>
                          <p className="text-sm text-gray-500">
                            {detectedTypes[collection] ? (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                detectedTypes[collection] === 'SANGROW' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {detectedTypes[collection]}
                              </span>
                            ) : (
                              <span className="text-gray-400">Bilinmeyen tip</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sistem bilgileri */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Sistem Bilgileri
          </h3>
          <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <dt className="text-sm font-medium text-gray-500">Sistem Adı</dt>
              <dd className="mt-1 text-sm text-gray-900">SCADA Yönetim Sistemi</dd>
            </div>
            <div className="sm:col-span-3">
              <dt className="text-sm font-medium text-gray-500">Sürüm</dt>
              <dd className="mt-1 text-sm text-gray-900">1.0.0</dd>
            </div>
            <div className="sm:col-span-3">
              <dt className="text-sm font-medium text-gray-500">Desteklenen Sistemler</dt>
              <dd className="mt-1 text-sm text-gray-900">SANGROW, FUSION</dd>
            </div>
            <div className="sm:col-span-3">
              <dt className="text-sm font-medium text-gray-500">Veritabanı</dt>
              <dd className="mt-1 text-sm text-gray-900">Firebase Firestore</dd>
            </div>
          </div>
        </div>
      </div>

      {/* Özellikler */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Özellikler
          </h3>
          <div className="mt-6">
            <ul className="divide-y divide-gray-200">
              <li className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <SettingsIcon className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-900">Real-time veri izleme</span>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Aktif
                  </span>
                </div>
              </li>
              <li className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <SettingsIcon className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-900">Otomatik veri normalizasyonu</span>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Aktif
                  </span>
                </div>
              </li>
              <li className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <SettingsIcon className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-900">Dinamik koleksiyon tespiti</span>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Aktif
                  </span>
                </div>
              </li>
              <li className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <SettingsIcon className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-900">Admin role kontrolü</span>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Aktif
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
