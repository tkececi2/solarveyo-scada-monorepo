'use client'

import { useState } from 'react'
import { collection, getDocs, query, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { testCollection } from '@/utils/firestore'
import { SystemType } from '@/types'
import { Database, Plus, CheckCircle, AlertCircle } from 'lucide-react'

interface SimpleCollectionPickerProps {
  onSelectCollection: (collectionName: string, type: SystemType | null) => void
  selectedCollection?: string
}

export default function SimpleCollectionPicker({ 
  onSelectCollection, 
  selectedCollection 
}: SimpleCollectionPickerProps) {
  const [customInput, setCustomInput] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<{ [key: string]: { exists: boolean; type: SystemType | null } }>({})

  // Sizin gerçek koleksiyonlarınızdan örnekler
  const knownCollections = [
    'Voyag_1',
    'Voyag_2', 
    'Voyag_3',
    'Voyag_4',
    'Voyag_5',
    'Voyag_6',
    'Voyag_7',
    'Voyag_8',
    'Voyag_9',
    'Voyag_10_1',
    'Voyag_10_2',
    'voyag_11_arazi_ges_Inverters',
    'voyag_12_arazi_ges_Inverters',
    'voyag_13_arazi_ges_Inverters',
    'voyag_14_arazi_ges_Inverters',
    'voyag_15_arazi_ges_Inverters',
    'voyag_16_arazi_ges_Inverters',
    'voyag_17_arazi_ges_Inverters',
    'voyag_18_arazi_ges_Inverters',
    'centurion_arazi_ges_Inverters',
    'mra_1_arazi_ges_Inverters',
    'mra_2_arazi_ges_Inverters',
    'fusionsolar-stations',
    'station-devices'
  ]

  const testCollectionName = async (name: string) => {
    setTesting(true)
    try {
      const result = await testCollection(name)
      setTestResults(prev => ({
        ...prev,
        [name]: { exists: result.exists, type: result.type }
      }))
      
      if (result.exists) {
        onSelectCollection(name, result.type)
      }
    } catch (error) {
      console.error('Test error:', error)
    } finally {
      setTesting(false)
    }
  }

  const handleCustomSubmit = () => {
    if (customInput.trim()) {
      testCollectionName(customInput.trim())
      setCustomInput('')
    }
  }

  return (
    <div className="space-y-4">
      
      {/* Manuel giriş */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Koleksiyon Adınızı Yazın
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCustomSubmit()}
            placeholder="Örn: voyag_11_arazi_ges_Inverters"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            disabled={!customInput.trim() || testing}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {testing ? 'Test...' : 'Test Et'}
          </button>
        </div>
      </div>

      {/* Yaygın koleksiyon önerileri */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Veya Yaygın İsimlerden Seçin
        </label>
        <div className="grid grid-cols-1 gap-2">
          {knownCollections.map(name => {
            const result = testResults[name]
            const isSelected = selectedCollection === name
            
            return (
              <button
                key={name}
                type="button"
                onClick={() => testCollectionName(name)}
                disabled={testing}
                className={`flex items-center justify-between p-3 border rounded-lg text-left transition-colors ${
                  isSelected 
                    ? 'border-green-500 bg-green-50' 
                    : result?.exists
                    ? 'border-green-300 bg-green-50 hover:bg-green-100'
                    : result?.exists === false
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  <Database className="h-4 w-4 text-gray-400 mr-3" />
                  <span className="font-medium text-gray-900">{name}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {result?.type && (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      result.type === 'SANGROW' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {result.type}
                    </span>
                  )}
                  
                  {result?.exists === true && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  
                  {result?.exists === false && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  
                  {isSelected && (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Yardım metni */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="text-sm font-medium text-blue-900 mb-1">
          💡 Koleksiyonlarınızı nasıl bulabilirsiniz?
        </h4>
        <div className="text-xs text-blue-700 space-y-1">
          <p>1. Firebase Console → Firestore Database'e gidin</p>
          <p>2. Sol tarafta koleksiyonlarınızı görün</p>
          <p>3. Koleksiyon adını buraya yazın</p>
          <p>4. Sistem otomatik test edip seçecek</p>
        </div>
      </div>

      {/* Test sonuçları */}
      {Object.keys(testResults).length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Test Sonuçları:</h4>
          <div className="space-y-1 text-xs">
            {Object.entries(testResults).map(([name, result]) => (
              <div key={name} className="flex justify-between">
                <span className="text-gray-600">{name}</span>
                <span className={result.exists ? 'text-green-600' : 'text-red-600'}>
                  {result.exists ? `✓ ${result.type || 'Mevcut'}` : '✗ Bulunamadı'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
