import React from 'react'
import { Download, Circle, Clock } from 'lucide-react'

interface SaveStatusIndicatorsProps {
  lastSaved: string | null;
  lastAutoSave: string | null;
  nextAutoSave: string | null;
}

export default React.memo(function SaveStatusIndicators({ 
  lastSaved, 
  lastAutoSave, 
  nextAutoSave 
}: SaveStatusIndicatorsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Manuel Kayıt Durumu */}
      {lastSaved && (
        <div className="bg-white border border-green-200 rounded-lg p-4 shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
                <Download className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-bold text-green-800">✅ Manuel Kayıt</p>
              <p className="text-xs text-green-600 mt-1">
                Son kayıt: {lastSaved}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Otomatik Kayıt Durumu */}
      <div className="bg-white border border-blue-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <div className="flex items-center">
                <Circle className="h-3 w-3 text-green-500 fill-current animate-pulse mr-1" />
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="ml-4">
            <p className="text-sm font-bold text-blue-800">🔄 Otomatik Güncelleme (10dk)</p>
            <div className="text-xs text-blue-600 mt-1">
              {lastAutoSave ? (
                <div>Son güncelleme: {lastAutoSave}</div>
              ) : (
                <div>Sürekli güncelleniyor</div>
              )}
              {nextAutoSave && (
                <div>Sonraki: {nextAutoSave}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
