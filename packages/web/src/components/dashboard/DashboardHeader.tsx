import React from 'react'
import { Save } from 'lucide-react'

interface DashboardHeaderProps {
  isSaving: boolean;
  onSaveDailyData: () => void;
}

export default React.memo(function DashboardHeader({ isSaving, onSaveDailyData }: DashboardHeaderProps) {
  return (
    <div className="md:flex md:items-center md:justify-between">
      <div className="flex-1 min-w-0">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">☀️ SolarVeyo Dashboard</h1>
        <p className="mt-2 text-base text-gray-600">
          Güneş enerji santralları - Gerçek zamanlı izleme ve kontrol sistemi
        </p>
      </div>
      <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
        <button
          onClick={onSaveDailyData}
          disabled={isSaving}
          className="inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Kaydediliyor...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              💾 Günlük Veri Kaydet
            </>
          )}
        </button>
      </div>
    </div>
  )
})
