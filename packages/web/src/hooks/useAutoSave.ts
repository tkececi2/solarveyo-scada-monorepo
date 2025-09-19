import { useEffect, useRef } from 'react'

interface UseAutoSaveOptions {
  onSave: () => Promise<void>
  interval?: number // dakika cinsinden
  startHour?: number // başlama saati (24h format)
  endHour?: number // bitiş saati (24h format)
  enabled?: boolean
}

export function useAutoSave({
  onSave,
  interval = 10, // varsayılan 10 dakika
  startHour = 6,
  endHour = 22,
  enabled = true
}: UseAutoSaveOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRunningRef = useRef(false)

  const isWithinWorkingHours = () => {
    const now = new Date()
    const currentHour = now.getHours()
    return currentHour >= startHour && currentHour < endHour
  }

  const performSave = async () => {
    if (isRunningRef.current || !enabled) return
    if (!isWithinWorkingHours()) return

    isRunningRef.current = true
    try {
      await onSave()
      console.log(`✅ Auto-save completed at ${new Date().toLocaleTimeString('tr-TR')}`)
    } catch (error) {
      console.error('❌ Auto-save error:', error)
    } finally {
      isRunningRef.current = false
    }
  }

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // İlk kayıt hemen yap (eğer çalışma saatleri içindeyse)
    performSave()

    // Interval'ı başlat
    intervalRef.current = setInterval(performSave, interval * 60 * 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [onSave, interval, startHour, endHour, enabled])

  // Page visibility API ile entegrasyon
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && enabled && isWithinWorkingHours()) {
        // Sayfa geri geldiğinde hemen bir kayıt yap
        performSave()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [enabled])

  return {
    isWithinWorkingHours,
    performSave
  }
}
