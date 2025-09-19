import React from 'react'
import { Sun, Moon, Cloud, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { getSolarTimeDescription } from '@/utils/solarTime'

interface SystemHealthStatusProps {
  totalSites: number;
  totalInverters: number;
  faultCount: number;
  totalPower: number;
  expectedPower?: number;
}

export default function SystemHealthStatus({
  totalSites,
  totalInverters, 
  faultCount,
  totalPower,
  expectedPower
}: SystemHealthStatusProps) {
  const currentTime = new Date()
  const solarInfo = getSolarTimeDescription(currentTime)
  
  // Sistem sağlık skoru hesapla
  const healthScore = totalInverters > 0 ? 
    ((totalInverters - faultCount) / totalInverters * 100) : 100
  
  // Performans analizi
  const powerEfficiency = expectedPower && expectedPower > 0 ? 
    (totalPower / expectedPower * 100) : 0
  
  const getHealthColor = (score: number) => {
    if (score >= 95) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 85) return 'text-yellow-600 bg-yellow-50 border-yellow-200' 
    if (score >= 70) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }
  
  const getHealthIcon = (score: number) => {
    if (score >= 95) return <CheckCircle className="h-5 w-5 text-green-500" />
    if (score >= 70) return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    return <AlertTriangle className="h-5 w-5 text-red-500" />
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-center mb-4">
        {solarInfo.phase === 'night' ? (
          <Moon className="h-6 w-6 text-blue-600 mr-2" />
        ) : solarInfo.phase === 'peak' ? (
          <Sun className="h-6 w-6 text-yellow-500 mr-2" />
        ) : (
          <Cloud className="h-6 w-6 text-gray-500 mr-2" />
        )}
        <h3 className="text-lg font-bold text-gray-900">🏥 Sistem Sağlık Durumu</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Genel Sağlık Skoru */}
        <div className={`border rounded-lg p-4 ${getHealthColor(healthScore)}`}>
          <div className="flex items-center">
            {getHealthIcon(healthScore)}
            <div className="ml-3">
              <div className="text-sm font-medium">🎯 Genel Sağlık</div>
              <div className="text-lg font-bold">{healthScore.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Arıza Durumu */}
        <div className={`border rounded-lg p-4 ${
          faultCount === 0 ? 'bg-green-50 border-green-200' :
          faultCount <= 2 ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center">
            <AlertTriangle className={`h-5 w-5 ${
              faultCount === 0 ? 'text-green-500' :
              faultCount <= 2 ? 'text-yellow-500' :
              'text-red-500'
            }`} />
            <div className="ml-3">
              <div className="text-sm font-medium">🚨 Problemli Birim</div>
              <div className="text-lg font-bold">{faultCount}/{totalInverters}</div>
            </div>
          </div>
        </div>

        {/* Güneş Durumu */}
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <div className="flex items-center">
            {solarInfo.phase === 'night' ? (
              <Moon className="h-5 w-5 text-blue-500" />
            ) : solarInfo.phase === 'peak' ? (
              <Sun className="h-5 w-5 text-yellow-500" />
            ) : (
              <Clock className="h-5 w-5 text-blue-500" />
            )}
            <div className="ml-3">
              <div className="text-sm font-medium text-blue-800">☀️ Güneş Durumu</div>
              <div className="text-xs text-blue-600">{solarInfo.description}</div>
            </div>
          </div>
        </div>

        {/* Performans */}
        {powerEfficiency > 0 && (
          <div className={`border rounded-lg p-4 ${
            powerEfficiency >= 80 ? 'bg-green-50 border-green-200' :
            powerEfficiency >= 60 ? 'bg-yellow-50 border-yellow-200' :
            'bg-orange-50 border-orange-200'
          }`}>
            <div className="flex items-center">
              <Sun className={`h-5 w-5 ${
                powerEfficiency >= 80 ? 'text-green-500' :
                powerEfficiency >= 60 ? 'text-yellow-500' :
                'text-orange-500'
              }`} />
              <div className="ml-3">
                <div className="text-sm font-medium">⚡ Performans</div>
                <div className="text-lg font-bold">{powerEfficiency.toFixed(0)}%</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detaylı Açıklama */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <div className="mb-2">
            <strong>🕐 Şu anki durum:</strong> {currentTime.toLocaleTimeString('tr-TR')} - {solarInfo.description}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div>⚡ <strong>Beklenen güç oranı:</strong> %{(solarInfo.expectedPowerRatio * 100).toFixed(0)}</div>
            <div>🎯 <strong>Arıza değerlendirmesi:</strong> {solarInfo.phase === 'night' ? 'Devre dışı' : 'Aktif'}</div>
            <div>📊 <strong>Toplam birim:</strong> {totalInverters} inverter</div>
            <div>🏥 <strong>Sağlık oranı:</strong> {((totalInverters - faultCount) / Math.max(totalInverters, 1) * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}
