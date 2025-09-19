import { collection, doc, setDoc, getDocs, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Site, InverterData } from '@/types'
import { subscribeToCollection } from '@/utils/firestore'
import { toast } from '@/components/ToastNotification'
import { logger } from '@/utils/productionLogger'
import { errorHandler } from '@/utils/errorHandler'

// Günlük üretim verisi için interface
interface DailyProductionData {
  date: string
  metadata: {
    createdAt: Timestamp
    updatedAt: Timestamp
    savedAt: Timestamp
    savedMethod: 'auto' | 'manual'
    systemVersion: string
    dataSource: string
    autoSaved: boolean
    testMode?: boolean
  }
  sites: SiteProductionData[]
  summary: ProductionSummary
}

// Günlük kümülatif veri için interface (array yok)
interface DailyCumulativeData {
  date: string
  metadata: {
    createdAt: Timestamp
    updatedAt: Timestamp
    savedAt: Timestamp
    savedMethod: 'auto' | 'manual'
    systemVersion: string
    dataSource: string
    autoSaved: boolean
    testMode?: boolean
    lastRealtimeUpdate?: string // Son 10 dakikalık güncelleme zamanı
    totalUpdates?: number // Kaç kez güncellendiği
  }
  sites: SiteProductionData[] // En son kümülatif veriler
  summary: ProductionSummary // En son kümülatif özet
}

interface SiteProductionData {
  siteId: string
  siteName: string
  location?: string
  capacity: string
  type: 'voyag' | 'arazi_ges'
  status: 'active' | 'inactive'
  collectionName: string
  activeInverters: number
  totalProduction: number
  averagePower: number
  peakPower: number
  efficiency: number
  operatingHours: number
  dataPoints: number
}

interface ProductionSummary {
  totalSites: number
  activeSites: number
  totalProduction: number
  totalPower: number
  peakPower: number
  averageEfficiency: number
  co2Saved: number
  equivalentHomes: number
}

/**
 * Tüm santrallerin günlük üretim verilerini toplar
 */
export async function collectDailyProductionData(forDate?: string): Promise<DailyProductionData> {
  try {
    // Tüm siteleri getir
    const sitesSnapshot = await getDocs(collection(db, 'sites'))
    const sites = sitesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (Site & { id: string })[]

    const siteProductionData: SiteProductionData[] = []
    let totalProduction = 0
    let totalPower = 0
    let peakPower = 0
    let activeSites = 0

    // Her site için veri topla
    for (const site of sites) {
      for (const source of site.sources) {
        try {
          // Site'in inverter verilerini getir
          const inverterData = await getInverterDataForSite(source.collection, source.type)
          
          if (inverterData.length > 0) {
            const siteStats = calculateSiteStats(inverterData)
            
            const siteData: SiteProductionData = {
              siteId: site.id,
              siteName: site.name,
              location: site.location,
              capacity: site.capacityMWp.toString(),
              type: source.type === 'SANGROW' ? 'arazi_ges' : 'voyag',
              status: siteStats.totalPower > 0 ? 'active' : 'inactive',
              collectionName: source.collection,
              activeInverters: siteStats.activeInverters,
              totalProduction: siteStats.dailyYield,
              averagePower: siteStats.averagePower,
              peakPower: siteStats.peakPower,
              efficiency: siteStats.efficiency,
              operatingHours: 8, // Varsayılan çalışma saati
              dataPoints: inverterData.length
            }

            siteProductionData.push(siteData)
            
            totalProduction += siteStats.dailyYield
            totalPower += siteStats.totalPower
            peakPower = Math.max(peakPower, siteStats.peakPower)
            
            if (siteStats.totalPower > 0) {
              activeSites++
            }
          }
        } catch (error) {
          console.error(`Error processing site ${site.name}:`, error)
        }
      }
    }

    // Özet istatistikleri hesapla
    const summary: ProductionSummary = {
      totalSites: sites.length,
      activeSites,
      totalProduction,
      totalPower,
      peakPower,
      averageEfficiency: 100, // Varsayılan verimlilik
      co2Saved: totalProduction * 0.0004, // kWh başına CO2 tasarrufu (ton)
      equivalentHomes: totalProduction / 30 // Günlük ev tüketimi 30 kWh varsayımı
    }

    // Türkiye saati ile doğru tarihi hesapla
    let targetDate = forDate;
    if (!targetDate) {
      const now = new Date();
      const turkeyDate = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
      targetDate = turkeyDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
    const now = Timestamp.now()

    return {
      date: targetDate,
      metadata: {
        createdAt: now,
        updatedAt: now,
        savedAt: now,
        savedMethod: 'auto',
        systemVersion: '1.0',
        dataSource: 'dashboard_summary',
        autoSaved: true,
        testMode: true
      },
      sites: siteProductionData,
      summary
    }
  } catch (error) {
    console.error('Error collecting daily production data:', error)
    throw error
  }
}

/**
 * Belirli bir koleksiyondan inverter verilerini getir
 */
async function getInverterDataForSite(collectionName: string, systemType: string): Promise<InverterData[]> {
  return new Promise((resolve, reject) => {
    const unsubscribe = subscribeToCollection(
      collectionName,
      systemType as any,
      (data) => {
        unsubscribe() // Tek seferlik veri alımı
        resolve(data)
      }
    )
    
    // Timeout ekle
    setTimeout(() => {
      unsubscribe()
      resolve([]) // Veri gelmezse boş array döndür
    }, 5000)
  })
}

/**
 * Site istatistiklerini hesapla
 */
function calculateSiteStats(inverters: InverterData[]) {
  const activeInverters = inverters.filter(inv => 
    inv.status.toLowerCase().includes('normal') || 
    inv.status.toLowerCase().includes('run') ||
    inv.activePower > 0
  ).length

  const totalPower = inverters.reduce((sum, inv) => sum + inv.activePower, 0)
  const dailyYield = inverters.reduce((sum, inv) => sum + inv.dailyYield, 0)
  const peakPower = Math.max(...inverters.map(inv => inv.activePower), 0)
  const averagePower = inverters.length > 0 ? totalPower / inverters.length : 0
  const efficiency = inverters.length > 0 
    ? inverters.reduce((sum, inv) => sum + (inv.efficiency || 100), 0) / inverters.length 
    : 100

  return {
    activeInverters,
    totalPower,
    dailyYield,
    peakPower,
    averagePower,
    efficiency
  }
}

/**
 * Günlük üretim verilerini kaydet (manuel kayıt için - aynı format)
 */
export async function saveDailyProductionData(data?: DailyProductionData, isManual = false, targetDate?: string): Promise<void> {
  try {
    // Manuel kayıt için akıllı tarih seçimi
    let effectiveDate = targetDate;
    if (isManual && !targetDate) {
      // Türkiye saati ile kontrol et
      const now = new Date()
      const turkeyDate = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
      const hour = turkeyDate.getHours()
      
      if (hour >= 0 && hour < 6) {
        const yesterday = new Date(turkeyDate)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        const todayStr = turkeyDate.toISOString().split('T')[0]
        
        const userChoice = confirm(
          `Saat ${hour.toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} - Gece saatinde manuel kayıt yapıyorsunuz.\n\n` +
          `Hangi günün verilerini kaydetmek istiyorsunuz?\n\n` +
          `Tamam = Dün (${yesterdayStr})\n` +
          `İptal = Bugün (${todayStr})`
        )
        
        effectiveDate = userChoice ? yesterdayStr : todayStr
      } else {
        effectiveDate = turkeyDate.toISOString().split('T')[0] // Normal saatlerde bugün
      }
    }
    
    const productionData = data || await collectDailyProductionData(effectiveDate)
    const saveDate = effectiveDate || productionData.date
    
    if (isManual) {
      productionData.metadata.savedMethod = 'manual';
      productionData.metadata.autoSaved = false;
      // Manual save date bilgisi metadata'ya eklenir
      (productionData.metadata as any).manualSaveDate = saveDate;
      productionData.date = saveDate; // Seçilen tarihi kullan
    }

    const docRef = doc(db, 'daily_production', saveDate)
    
    // Mevcut document'i oku
    const existingDoc = await getDoc(docRef)
    
    if (existingDoc.exists()) {
      // Mevcut document varsa, kümülatif verileri güncelle
      const existingData = existingDoc.data() as DailyCumulativeData
      
      const updatedDoc: DailyCumulativeData = {
        ...existingData,
        metadata: {
          ...existingData.metadata,
          ...productionData.metadata,
          createdAt: existingData.metadata.createdAt, // İlk oluşturma tarihini koru
          totalUpdates: (existingData.metadata.totalUpdates || 0) + 1
        },
        sites: productionData.sites,    // Kümülatif verilerle güncelle
        summary: productionData.summary // Kümülatif özet ile güncelle
      }
      
      await setDoc(docRef, updatedDoc)
    } else {
      // Yeni document oluştur
      const newDoc: DailyCumulativeData = {
        date: saveDate,
        metadata: {
          ...productionData.metadata,
          totalUpdates: 1
        },
        sites: productionData.sites,
        summary: productionData.summary
      }
      
      await setDoc(docRef, newDoc)
    }
    
    console.log(`Daily production data saved for ${saveDate} (${isManual ? 'manual' : 'auto'})`)
  } catch (error) {
    console.error('Error saving daily production data:', error)
    throw error
  }
}

/**
 * Her 10 dakikada bir otomatik kaydetme işlemi (22:00'a kadar)
 */
export function startAutoSaveScheduler(): () => void {
  let isRunning = false
  let intervalId: NodeJS.Timeout | null = null
  
  const performAutoSave = async () => {
    if (isRunning) return // Çakışma önleme
    
    // Saat kontrolü: 22:00'dan sonra kaydetme yapma
    const now = new Date()
    const hour = now.getHours()
    
    if (hour >= 22 || hour < 6) { // 22:00 - 06:00 arası kaydetme yapma
      console.log(`⏰ Auto-save skipped - Outside operating hours (${now.toLocaleTimeString('tr-TR')})`)
      return
    }
    
    isRunning = true
    try {
      // 10 dakikalık veriler için farklı bir koleksiyon kullan
      const data = await collectCurrentProductionData()
      await saveCurrentProductionData(data)
      console.log(`✅ Auto-save completed at ${new Date().toLocaleTimeString('tr-TR')}`)
    } catch (error) {
      console.error('❌ Error in 10-minute auto save:', error)
    } finally {
      isRunning = false
    }
  }

  // Tarayıcı açık olup olmadığını kontrol et
  const isPageVisible = () => !document.hidden

  // İlk kayıt hemen yapılsın (eğer çalışma saatleri içindeyse)
  if (isPageVisible()) {
    performAutoSave()
  }
  
  // Her 10 dakikada bir tekrarla (10 * 60 * 1000 = 600000 ms)
  const startInterval = () => {
    intervalId = setInterval(() => {
      // Tarayıcı açık ve görünürse kaydet
      if (isPageVisible()) {
        performAutoSave()
      } else {
        console.log(`⏸️ Auto-save skipped - Page not visible (${new Date().toLocaleTimeString('tr-TR')})`)
      }
    }, 10 * 60 * 1000)
  }

  startInterval()

  // Page Visibility API - tarayıcı sekmesi değişince
  const handleVisibilityChange = () => {
    if (document.hidden) {
      console.log('🔄 Page hidden - Auto-save will continue in background until 22:00')
    } else {
      console.log('👁️ Page visible - Auto-save resumed')
      // Sayfa geri geldiğinde hemen bir kayıt yap
      performAutoSave()
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  
  // Cleanup function döndür
  return () => {
    if (intervalId) {
      clearInterval(intervalId)
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

/**
 * Anlık üretim verilerini toplar (10 dakikalık kayıtlar için)
 */
export async function collectCurrentProductionData(): Promise<DailyProductionData> {
  try {
    // Tüm siteleri getir
    const sitesSnapshot = await getDocs(collection(db, 'sites'))
    const sites = sitesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (Site & { id: string })[]

    const siteProductionData: SiteProductionData[] = []
    let totalProduction = 0
    let totalPower = 0
    let peakPower = 0
    let activeSites = 0

    // Her site için anlık veri topla
    for (const site of sites) {
      for (const source of site.sources) {
        try {
          // Site'in inverter verilerini getir
          const inverterData = await getInverterDataForSite(source.collection, source.type)
          
          if (inverterData.length > 0) {
            const siteStats = calculateSiteStats(inverterData)
            
            const siteData: SiteProductionData = {
              siteId: site.id,
              siteName: site.name,
              location: site.location,
              capacity: site.capacityMWp.toString(),
              type: source.type === 'SANGROW' ? 'arazi_ges' : 'voyag',
              status: siteStats.totalPower > 0 ? 'active' : 'inactive',
              collectionName: source.collection,
              activeInverters: siteStats.activeInverters,
              totalProduction: siteStats.dailyYield,
              averagePower: siteStats.averagePower,
              peakPower: siteStats.totalPower, // Anlık güç
              efficiency: siteStats.efficiency,
              operatingHours: calculateOperatingHours(), // Dinamik hesaplama
              dataPoints: inverterData.length
            }

            siteProductionData.push(siteData)
            
            totalProduction += siteStats.dailyYield
            totalPower += siteStats.totalPower
            peakPower = Math.max(peakPower, siteStats.totalPower)
            
            if (siteStats.totalPower > 0) {
              activeSites++
            }
          }
        } catch (error) {
          console.error(`Error processing site ${site.name}:`, error)
        }
      }
    }

    // Özet istatistikleri hesapla
    const summary: ProductionSummary = {
      totalSites: sites.length,
      activeSites,
      totalProduction,
      totalPower,
      peakPower,
      averageEfficiency: siteProductionData.length > 0 
        ? siteProductionData.reduce((sum, site) => sum + site.efficiency, 0) / siteProductionData.length 
        : 100,
      co2Saved: totalProduction * 0.0004, // kWh başına CO2 tasarrufu (ton)
      equivalentHomes: totalProduction / 30 // Günlük ev tüketimi 30 kWh varsayımı
    }

    const now = new Date()
    const timestamp = Timestamp.now()
    
    // Türkiye saati ile doğru tarihi hesapla
    const turkeyDate = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const dateString = turkeyDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    return {
      date: dateString,
      metadata: {
        createdAt: timestamp,
        updatedAt: timestamp,
        savedAt: timestamp,
        savedMethod: 'auto',
        systemVersion: '1.0',
        dataSource: 'realtime_10min',
        autoSaved: true,
        testMode: true
      },
      sites: siteProductionData,
      summary
    }
  } catch (error) {
    console.error('Error collecting current production data:', error)
    throw error
  }
}

/**
 * Kümülatif üretim verilerini güncelle (her 10 dakikada veriler üzerine yaz)
 */
export async function saveCurrentProductionData(data: DailyProductionData): Promise<void> {
  try {
    // Türkiye saati ile doğru tarihi hesapla
    const now = new Date()
    const turkeyDate = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const today = turkeyDate.toISOString().split('T')[0] // YYYY-MM-DD
    const timeString = turkeyDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    
    const docRef = doc(db, 'daily_production', data.date)
    
    // Mevcut document'i oku
    const existingDoc = await getDoc(docRef)

    if (existingDoc.exists()) {
      // Mevcut document varsa, kümülatif verileri güncelle
      const existingData = existingDoc.data() as DailyCumulativeData
      
      const updatedDoc: DailyCumulativeData = {
        ...existingData,
        metadata: {
          ...existingData.metadata,
          updatedAt: Timestamp.now(),
          savedAt: Timestamp.now(),
          lastRealtimeUpdate: timeString,
          totalUpdates: (existingData.metadata.totalUpdates || 0) + 1
        },
        sites: data.sites,     // Kümülatif verilerle değiştir
        summary: data.summary  // Kümülatif özet ile değiştir
      }
      
      await setDoc(docRef, updatedDoc)
    } else {
      // Yeni document oluştur
      const newDoc: DailyCumulativeData = {
        date: data.date,
        metadata: {
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          savedAt: Timestamp.now(),
          savedMethod: 'auto',
          systemVersion: '1.0',
          dataSource: 'realtime_10min',
          autoSaved: true,
          testMode: true,
          lastRealtimeUpdate: timeString,
          totalUpdates: 1
        },
        sites: data.sites,
        summary: data.summary
      }
      
      await setDoc(docRef, newDoc)
    }
    
    console.log(`Cumulative data updated for ${data.date} at ${timeString}`)
  } catch (error) {
    console.error('Error saving realtime production data:', error)
    throw error
  }
}

/**
 * Dinamik çalışma saati hesaplama
 */
function calculateOperatingHours(): number {
  const now = new Date()
  const currentHour = now.getHours()
  
  // Güneş çıkış (06:00) ve batış (19:00) saatleri arasında
  if (currentHour >= 6 && currentHour <= 19) {
    return currentHour - 6 + (now.getMinutes() / 60) // Ondalıklı saat
  }
  
  return 0 // Gece saatleri
}

/**
 * Otomatik günlük kaydetme işlemi (günde bir kez)
 */
export function startDailyProductionScheduler(): () => void {
  // Her gün saat 23:30'da otomatik kaydet
  const scheduleDaily = () => {
    const now = new Date()
    const target = new Date()
    target.setHours(23, 30, 0, 0) // 23:30
    
    if (now > target) {
      target.setDate(target.getDate() + 1) // Yarın
    }
    
    const timeUntilTarget = target.getTime() - now.getTime()
    
    return setTimeout(async () => {
      try {
        await saveDailyProductionData()
        console.log('Automatic daily production data saved')
        
        // Bir sonraki gün için tekrar planla
        scheduleDaily()
      } catch (error) {
        console.error('Error in automatic daily save:', error)
      }
    }, timeUntilTarget)
  }

  const timeoutId = scheduleDaily()
  
  // Cleanup function döndür
  return () => {
    clearTimeout(timeoutId)
  }
}
