import { useEffect, useRef, useState } from 'react'
import { saveDailyProductionData } from '@/services/dailyProductionService'

export function useAutoSaveTimer(enabled: boolean = true, intervalMinutes: number = 5) {
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null)
  const [nextAutoSave, setNextAutoSave] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveCount, setSaveCount] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const performAutoSave = async () => {
    const now = new Date()
    const currentHour = now.getHours()
    
    console.log(`🕐 Saat kontrolü: ${currentHour}:${now.getMinutes()} (06:00-22:00 arası çalışır)`)
    
    // Sadece 06:00 - 22:00 arası çalış
    if (currentHour < 6 || currentHour >= 22) {
      console.log(`⏸️ Auto-save atlandı - çalışma saati dışı (${currentHour}:00)`)
      return
    }

    setIsSaving(true)
    
    try {
      console.log(`🔄 [${now.toLocaleTimeString('tr-TR')}] Otomatik kayıt başlıyor...`)
      
      // Manuel kayıt ile aynı fonksiyonu kullan
      await saveDailyProductionData(undefined, false) // Otomatik kayıt (manuel=false)
      console.log('💾 Firestore\'a kaydedildi!')
      
      setLastAutoSave(now)
      setSaveCount(prev => prev + 1)
      
      console.log(`✅ Otomatik kayıt başarılı! #${saveCount + 1}`)
      
    } catch (error) {
      console.error('❌ Otomatik kayıt hatası:', error)
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    console.log(`🔧 useAutoSaveTimer: enabled=${enabled}, interval=${intervalMinutes} dakika`)
    
    if (!enabled) {
      console.log('⚠️ Auto-save devre dışı (enabled=false)')
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // HEMEN İLK KAYIT - 3 saniye bekle (sadece sayfa yüklenmesi için)
    const initialDelay = setTimeout(() => {
      console.log('🚀 İlk otomatik kayıt başlatılıyor...')
      performAutoSave()
    }, 3000) // 3 saniye

    // Sonraki kayıtlar için interval kur (5 dakikada bir)
    intervalRef.current = setInterval(() => {
      performAutoSave()
    }, intervalMinutes * 60 * 1000)

    // Next save time hesapla
    const updateNextSave = () => {
      const next = new Date()
      next.setMinutes(next.getMinutes() + intervalMinutes)
      setNextAutoSave(next)
    }
    
    updateNextSave()
    const nextSaveInterval = setInterval(updateNextSave, 60000) // Her dakika güncelle

    console.log(`⏰ Otomatik kayıt sistemi başlatıldı (${intervalMinutes} dakikada bir)`)
    console.log(`⏳ İlk kayıt 3 saniye sonra başlayacak...`)

    return () => {
      clearTimeout(initialDelay)
      clearInterval(nextSaveInterval)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      console.log('⏹️ Otomatik kayıt sistemi durduruldu')
    }
  }, [enabled, intervalMinutes])

  return {
    lastAutoSave,
    nextAutoSave,
    isSaving,
    saveCount,
    performAutoSave // Manuel tetikleme için
  }
}
