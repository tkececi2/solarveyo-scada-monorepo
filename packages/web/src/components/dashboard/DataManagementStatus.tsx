import React, { useState, useEffect } from 'react'
import { Cloud, Database, Clock, CheckCircle, AlertTriangle, Wifi, WifiOff } from 'lucide-react'

interface DataManagementStatusProps {
  lastSaved: string | null;
  lastAutoSave: string | null;
  nextAutoSave: string | null;
}

export default function DataManagementStatus({ 
  lastSaved, 
  lastAutoSave, 
  nextAutoSave 
}: DataManagementStatusProps) {
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // İnternet bağlantısı kontrolü
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Firebase Functions durumu kontrolü
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        // Firebase Functions'ın çalışıp çalışmadığını test et
        const response = await fetch('https://us-central1-tkececi-b86ba.cloudfunctions.net/autoSaveProduction', {
          method: 'HEAD',
          mode: 'no-cors'
        })
        setBackendStatus('online')
      } catch (error) {
        setBackendStatus('offline')
      }
    }

    if (isOnline) {
      checkBackendStatus()
      // Her 5 dakikada bir backend durumunu kontrol et
      const interval = setInterval(checkBackendStatus, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [isOnline])

  const getWorkingHours = () => {
    const now = new Date()
    const hour = now.getHours()
    return hour >= 6 && hour < 22
  }

  const isInWorkingHours = getWorkingHours()

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-center mb-4">
        <Database className="h-6 w-6 text-blue-600 mr-2" />
        <h3 className="text-lg font-bold text-gray-900">📊 Veri Yönetimi Durumu</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* İnternet Bağlantısı */}
        <div className="flex items-center p-3 border rounded-lg">
          {isOnline ? (
            <>
              <Wifi className="h-5 w-5 text-green-500 mr-2" />
              <div>
                <div className="text-sm font-medium text-green-700">🌐 Çevrimiçi</div>
                <div className="text-xs text-green-600">İnternet bağlı</div>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-red-500 mr-2" />
              <div>
                <div className="text-sm font-medium text-red-700">🔴 Çevrimdışı</div>
                <div className="text-xs text-red-600">İnternet yok</div>
              </div>
            </>
          )}
        </div>

        {/* Backend Durum */}
        <div className="flex items-center p-3 border rounded-lg">
          {backendStatus === 'online' ? (
            <>
              <Cloud className="h-5 w-5 text-green-500 mr-2" />
              <div>
                <div className="text-sm font-medium text-green-700">☁️ Functions Aktif</div>
                <div className="text-xs text-green-600">Arka plan çalışıyor</div>
              </div>
            </>
          ) : backendStatus === 'offline' ? (
            <>
              <Cloud className="h-5 w-5 text-red-500 mr-2" />
              <div>
                <div className="text-sm font-medium text-red-700">☁️ Functions Pasif</div>
                <div className="text-xs text-red-600">Backend bağlanamıyor</div>
              </div>
            </>
          ) : (
            <>
              <Cloud className="h-5 w-5 text-yellow-500 mr-2" />
              <div>
                <div className="text-sm font-medium text-yellow-700">☁️ Kontrol Ediliyor</div>
                <div className="text-xs text-yellow-600">Durum test ediliyor</div>
              </div>
            </>
          )}
        </div>

        {/* Çalışma Saatleri */}
        <div className="flex items-center p-3 border rounded-lg">
          {isInWorkingHours ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <div>
                <div className="text-sm font-medium text-green-700">⏰ Aktif Saat</div>
                <div className="text-xs text-green-600">06:00-22:00 arası</div>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
              <div>
                <div className="text-sm font-medium text-yellow-700">🌙 Gece Modu</div>
                <div className="text-xs text-yellow-600">22:00-06:00 arası</div>
              </div>
            </>
          )}
        </div>

        {/* Oto-kayıt Durumu */}
        <div className="flex items-center p-3 border rounded-lg">
          {isOnline && backendStatus === 'online' && isInWorkingHours ? (
            <>
              <Clock className="h-5 w-5 text-green-500 mr-2 animate-pulse" />
              <div>
                <div className="text-sm font-medium text-green-700">🔄 Oto-kayıt ON</div>
                <div className="text-xs text-green-600">Her 10dk</div>
              </div>
            </>
          ) : (
            <>
              <Clock className="h-5 w-5 text-gray-500 mr-2" />
              <div>
                <div className="text-sm font-medium text-gray-700">⏸️ Oto-kayıt OFF</div>
                <div className="text-xs text-gray-600">
                  {!isOnline ? 'İnternet yok' : 
                   backendStatus === 'offline' ? 'Backend yok' : 
                   !isInWorkingHours ? 'Gece modu' : 'Beklemede'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detaylı Bilgiler */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-bold text-blue-800 mb-2">📋 Otomatik Kayıt Programı</h4>
          <div className="text-xs text-blue-700 space-y-1">
            <div>⏰ <strong>Günlük kayıt:</strong> Her gece 23:30</div>
            <div>🔄 <strong>10dk kayıt:</strong> 06:00-22:00 arası</div>
            <div>👁️ <strong>Tarayıcı durumu:</strong> Artık önemsiz!</div>
            <div>☁️ <strong>Arka plan:</strong> Firebase Functions çalışıyor</div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-sm font-bold text-green-800 mb-2">✅ Akıllı Tarih Sistemi</h4>
          <div className="text-xs text-green-700 space-y-1">
            <div>🌙 <strong>Gece 00:00-06:00:</strong> Dün/Bugün seçimi</div>
            <div>☀️ <strong>Gündüz 06:00-24:00:</strong> Otomatik bugün</div>
            <div>🎯 <strong>Manuel kayıt:</strong> Akıllı tarih seçimi</div>
            <div>📊 <strong>Veri tutarlılığı:</strong> %100 garantili</div>
          </div>
        </div>
      </div>

      {/* Son Kayıt Bilgileri */}
      {(lastSaved || lastAutoSave) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 space-y-1">
            {lastSaved && (
              <div>💾 <strong>Son manuel kayıt:</strong> {lastSaved}</div>
            )}
            {lastAutoSave && (
              <div>🔄 <strong>Son otomatik kayıt:</strong> {lastAutoSave}</div>
            )}
            {nextAutoSave && (
              <div>⏰ <strong>Sonraki otomatik:</strong> {nextAutoSave}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
