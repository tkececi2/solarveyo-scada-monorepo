import React from 'react'
import { AlertTriangle, Zap, Clock, Info, AlertCircle } from 'lucide-react'
import { getSolarTimeDescription, isNightOrIdleImproved } from '@/utils/solarTime'

interface FaultInfo {
  type: 'inverter' | 'pvstring' | 'weather' | 'maintenance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  description: string;
  expectedResolution?: string;
  isTemporary: boolean;
}

interface FaultDisplayProps {
  inverterData: any[];
  siteName: string;
  compact?: boolean;
  isLoading?: boolean; // Loading state eklendi
}

export default function FaultDisplaySystem({ inverterData, siteName, compact = false, isLoading = false }: FaultDisplayProps) {
  
  // Loading durumunda skeleton göster
  if (isLoading || !inverterData || inverterData.length === 0) {
    if (compact) {
      return (
        <div className="text-xs px-3 py-1 rounded-full font-medium bg-gray-100 text-gray-500 border border-gray-200 animate-pulse">
          ⏳ Yükleniyor...
        </div>
      )
    }
    
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 animate-pulse">
        <div className="flex items-center">
          <div className="h-8 w-8 bg-gray-200 rounded-full mr-3"></div>
          <div>
            <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </div>
    )
  }
  const currentTime = new Date()
  const solarInfo = getSolarTimeDescription(currentTime)
  
  // Gelişmiş arıza analizi
  const analyzeFaults = (): FaultInfo[] => {
    const faults: FaultInfo[] = []
    
    let inverterFaults = 0
    let pvStringFaults = 0  
    let weatherRelated = 0
    let maintenanceNeeded = 0
    
    inverterData.forEach(inv => {
      const nightAnalysis = isNightOrIdleImproved(inv, currentTime)
      
      // Gece ise değerlendirme yapma
      if (nightAnalysis.isNightOrIdle && solarInfo.phase === 'night') {
        return
      }
      
      // İnverter durumu analizi
      const statusText = (inv.status || '').toString().toLowerCase()
      if (statusText.includes('fault') || statusText.includes('error')) {
        inverterFaults++
      } else if (statusText.includes('offline') && solarInfo.phase !== 'night') {
        // Gündüz çevrimdışı = ciddi sorun
        inverterFaults++
      } else if (statusText.includes('alarm') || statusText.includes('warning')) {
        maintenanceNeeded++
      }
      
      // PV String analizi
      if (inv.pvInputs || inv.mpptData) {
        const entries = inv.pvInputs ? Object.entries(inv.pvInputs) : (inv.mpptData || [])
        let stringProblems = 0
        
        entries.forEach(([key, pvData]: [string, any]) => {
          const current = pvData?.current || pvData?.I || 0
          const voltage = pvData?.voltage || pvData?.V || 0
          
          if (current === 0 && voltage < 100) {
            // Düşük performans - hava durumu etkisi olabilir
            if (solarInfo.expectedPowerRatio < 0.3) {
              weatherRelated++
            } else {
              stringProblems++
            }
          }
        })
        
        if (stringProblems > 0) {
          pvStringFaults += stringProblems
        }
      }
    })
    
    // Arıza tiplerini kategorize et
    if (inverterFaults > 0) {
      faults.push({
        type: 'inverter',
        severity: inverterFaults > 3 ? 'critical' : inverterFaults > 1 ? 'high' : 'medium',
        count: inverterFaults,
        description: `${inverterFaults} inverter arızalı/çevrimdışı`,
        expectedResolution: 'Teknik müdahale gerekli',
        isTemporary: false
      })
    }
    
    if (pvStringFaults > 0) {
      faults.push({
        type: 'pvstring', 
        severity: pvStringFaults > 10 ? 'high' : pvStringFaults > 5 ? 'medium' : 'low',
        count: pvStringFaults,
        description: `${pvStringFaults} PV string düşük performans`,
        expectedResolution: 'Panel temizliği/kontrolü',
        isTemporary: false
      })
    }
    
    if (weatherRelated > 0) {
      faults.push({
        type: 'weather',
        severity: 'low',
        count: weatherRelated, 
        description: `${weatherRelated} birim düşük performans`,
        expectedResolution: 'Hava durumu normale dönünce düzelir',
        isTemporary: true
      })
    }
    
    if (maintenanceNeeded > 0) {
      faults.push({
        type: 'maintenance',
        severity: 'medium',
        count: maintenanceNeeded,
        description: `${maintenanceNeeded} birim bakım uyarısı`,
        expectedResolution: 'Rutin bakım planla',
        isTemporary: false
      })
    }
    
    return faults
  }
  
  const faults = analyzeFaults()
  const totalFaultCount = faults.reduce((sum, f) => sum + f.count, 0)
  
  // Kompakt görünüm (santral kartlarında)
  if (compact) {
    if (totalFaultCount === 0) {
      return (
        <div className="text-xs px-3 py-1 rounded-full font-medium bg-green-50 text-green-700 border border-green-200">
          ✅ Sorunsuz
        </div>
      )
    }
    
    const criticalCount = faults.filter(f => f.severity === 'critical').length
    const highCount = faults.filter(f => f.severity === 'high').length
    
    return (
      <div className={`text-xs px-3 py-1 rounded-full font-medium ${
        criticalCount > 0 ? 'bg-red-50 text-red-700 border border-red-200' :
        highCount > 0 ? 'bg-orange-50 text-orange-700 border border-orange-200' :
        'bg-yellow-50 text-yellow-700 border border-yellow-200'
      }`}>
        {criticalCount > 0 ? '🚨' : highCount > 0 ? '⚠️' : '⚠️'} {totalFaultCount} Problem
      </div>
    )
  }
  
  // Detaylı görünüm
  if (totalFaultCount === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
            <Zap className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-green-800">✅ {siteName} - Sorunsuz</h4>
            <p className="text-xs text-green-600 mt-1">{solarInfo.description}</p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-3">
      {faults.map((fault, index) => (
        <div key={index} className={`border rounded-lg p-4 ${
          fault.severity === 'critical' ? 'bg-red-50 border-red-200' :
          fault.severity === 'high' ? 'bg-orange-50 border-orange-200' :
          fault.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-start">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 ${
              fault.severity === 'critical' ? 'bg-red-100' :
              fault.severity === 'high' ? 'bg-orange-100' :
              fault.severity === 'medium' ? 'bg-yellow-100' :
              'bg-blue-100'
            }`}>
              {fault.type === 'inverter' ? (
                <AlertCircle className={`h-4 w-4 ${
                  fault.severity === 'critical' ? 'text-red-600' :
                  fault.severity === 'high' ? 'text-orange-600' :
                  'text-yellow-600'
                }`} />
              ) : fault.type === 'pvstring' ? (
                <Zap className={`h-4 w-4 ${
                  fault.severity === 'high' ? 'text-orange-600' : 'text-yellow-600'
                }`} />
              ) : fault.type === 'weather' ? (
                <Info className="h-4 w-4 text-blue-600" />
              ) : (
                <Clock className="h-4 w-4 text-yellow-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className={`text-sm font-medium ${
                  fault.severity === 'critical' ? 'text-red-800' :
                  fault.severity === 'high' ? 'text-orange-800' :
                  fault.severity === 'medium' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  {fault.type === 'inverter' ? '🔴 İnverter Arızası' :
                   fault.type === 'pvstring' ? '⚡ PV String Sorunu' :
                   fault.type === 'weather' ? '🌤️ Hava Durumu Etkisi' :
                   '🔧 Bakım Gerekli'}
                </h4>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  fault.isTemporary ? 'bg-gray-100 text-gray-600' : 'bg-gray-800 text-white'
                }`}>
                  {fault.isTemporary ? 'Geçici' : 'Kalıcı'}
                </span>
              </div>
              <p className={`text-xs mt-1 ${
                fault.severity === 'critical' ? 'text-red-600' :
                fault.severity === 'high' ? 'text-orange-600' :
                fault.severity === 'medium' ? 'text-yellow-600' :
                'text-blue-600'
              }`}>
                {fault.description}
              </p>
              {fault.expectedResolution && (
                <p className="text-xs text-gray-500 mt-1">
                  💡 <strong>Çözüm:</strong> {fault.expectedResolution}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
      
      {/* Zaman bilgisi */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center text-xs text-gray-600">
          <Clock className="h-4 w-4 mr-2" />
          <span><strong>Güneş Durumu:</strong> {solarInfo.description}</span>
          <span className="ml-4"><strong>Beklenen Güç:</strong> %{(solarInfo.expectedPowerRatio * 100).toFixed(0)}</span>
        </div>
      </div>
    </div>
  )
}
