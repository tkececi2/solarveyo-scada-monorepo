import { collection, getDocs, query, where, orderBy, limit, startAfter, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Rapor verileri için interface
export interface ReportData {
  date: string
  metadata: {
    createdAt: Timestamp
    updatedAt: Timestamp
    lastRealtimeUpdate?: string
    totalUpdates?: number
    dataSource: string
  }
  sites: ReportSiteData[]
  summary: ReportSummary
}

export interface ReportSiteData {
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

export interface ReportSummary {
  totalSites: number
  activeSites: number
  totalProduction: number
  totalPower: number
  peakPower: number
  averageEfficiency: number
  co2Saved: number
  equivalentHomes: number
}

// Tarih filtreleri
export type DateRange = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

export interface DateFilter {
  type: DateRange
  startDate: Date
  endDate: Date
}

/**
 * Tarih aralığına göre daily_production verilerini getir
 */
export async function getProductionReports(
  dateFilter: DateFilter,
  siteIds?: string[]
): Promise<ReportData[]> {
  try {
    const startDateStr = dateFilter.startDate.toISOString().split('T')[0]
    const endDateStr = dateFilter.endDate.toISOString().split('T')[0]
    

    
    // Firestore query oluştur
    let q = query(
      collection(db, 'daily_production'),
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr),
      orderBy('date', 'desc')
    )
    
    const snapshot = await getDocs(q)
    const reports: ReportData[] = []
    
    snapshot.forEach(doc => {
      const raw = doc.data() as any
      // Bazı kayıtlarda tarih Timestamp olarak tutulmuş olabilir; stringe çevir.
      const normalizedDate = typeof raw.date === 'string'
        ? raw.date
        : (raw.date?.toDate ? raw.date.toDate() : new Date(raw.date)).toISOString().split('T')[0]
      const data = { ...raw, date: normalizedDate } as ReportData
      

      
      // Site filtresi varsa uygula
      if (siteIds && siteIds.length > 0) {
        // Normalize helper: boşluk, alt çizgi, tire ve nokta gibi tüm ayırıcıları yok say
        // Ayrıca diakritikleri kaldır ve küçük harfe çevir (örn: İ/ı -> i)
        const norm = (s: any) =>
          (s ?? '')
            .toString()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '')
            .trim();

        // Site ID'lerine göre filtrele - esnek eşleşme: id veya adı yakala
        data.sites = data.sites.filter(site => {
          const siteIdNorm = norm(site.siteId);
          const siteNameNorm = norm(site.siteName);
          return siteIds.some(sel => {
            const selNorm = norm(sel);
            return selNorm === siteIdNorm || selNorm === siteNameNorm;
          })
        })
        
        // Özeti yeniden hesapla
        data.summary = recalculateSummary(data.sites)
      }
      
      reports.push(data)
    })
    
    return reports
  } catch (error) {
    console.error('Error fetching production reports:', error)
    throw error
  }
}

/**
 * Belirli bir site için tarih aralığındaki verileri getir
 */
export async function getSiteReports(
  siteId: string,
  dateFilter: DateFilter
): Promise<ReportSiteData[]> {
  try {
    const allReports = await getProductionReports(dateFilter)
    const siteReports: ReportSiteData[] = []
    
    allReports.forEach(report => {
      const siteData = report.sites.find(site => site.siteId === siteId)
      if (siteData) {
        siteReports.push({
          ...siteData,
          // Tarihi ekle (site data'sında yok)
          date: report.date
        } as ReportSiteData & { date: string })
      }
    })
    
    return siteReports
  } catch (error) {
    console.error('Error fetching site reports:', error)
    throw error
  }
}

/**
 * Aylık toplam verileri hesapla
 */
export async function getMonthlyReports(year: number, month?: number): Promise<MonthlyReport[]> {
  try {
    const startDate = new Date(year, month ? month - 1 : 0, 1)
    const endDate = month 
      ? new Date(year, month, 0) // Ay sonu
      : new Date(year, 11, 31)   // Yıl sonu
    
    const reports = await getProductionReports({
      type: 'custom',
      startDate,
      endDate
    })
    
    // Aylık gruplama
    const monthlyData: { [key: string]: ReportData[] } = {}
    
    reports.forEach(report => {
      const reportDate = new Date(report.date)
      const monthKey = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = []
      }
      monthlyData[monthKey].push(report)
    })
    
    // Aylık özet hesapla
    const monthlyReports: MonthlyReport[] = []
    
    Object.entries(monthlyData).forEach(([monthKey, monthReports]) => {
      const [year, month] = monthKey.split('-')
      
      const totalProduction = monthReports.reduce((sum, report) => 
        sum + report.summary.totalProduction, 0
      )
      
      const avgPower = monthReports.reduce((sum, report) => 
        sum + report.summary.totalPower, 0
      ) / monthReports.length
      
      const maxPower = Math.max(...monthReports.map(r => r.summary.peakPower))
      
      monthlyReports.push({
        year: parseInt(year),
        month: parseInt(month),
        monthName: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('tr-TR', { month: 'long' }),
        totalProduction,
        averagePower: avgPower,
        peakPower: maxPower,
        activeDays: monthReports.length,
        co2Saved: totalProduction * 0.0004,
        equivalentHomes: totalProduction / 30
      })
    })
    
    return monthlyReports.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
  } catch (error) {
    console.error('Error fetching monthly reports:', error)
    throw error
  }
}

export interface MonthlyReport {
  year: number
  month: number
  monthName: string
  totalProduction: number
  averagePower: number
  peakPower: number
  activeDays: number
  co2Saved: number
  equivalentHomes: number
}

/**
 * Site istatistiklerini yeniden hesapla
 */
function recalculateSummary(sites: ReportSiteData[]): ReportSummary {
  const activeSites = sites.filter(site => site.status === 'active').length
  const totalProduction = sites.reduce((sum, site) => sum + site.totalProduction, 0)
  const totalPower = sites.reduce((sum, site) => sum + site.averagePower, 0)
  const peakPower = Math.max(...sites.map(site => site.peakPower), 0)
  const avgEfficiency = sites.length > 0 
    ? sites.reduce((sum, site) => sum + site.efficiency, 0) / sites.length 
    : 0
  
  return {
    totalSites: sites.length,
    activeSites,
    totalProduction,
    totalPower,
    peakPower,
    averageEfficiency: avgEfficiency,
    co2Saved: totalProduction * 0.0004,
    equivalentHomes: totalProduction / 30
  }
}

/**
 * Excel export için veri hazırla
 */
export function prepareExcelData(reports: ReportData[], type: 'daily' | 'monthly' = 'daily') {
  if (type === 'daily') {
    return reports.map(report => ({
      'Tarih': report.date,
      'Toplam Üretim (kWh)': report.summary.totalProduction.toFixed(2),
      'Toplam Güç (kW)': report.summary.totalPower.toFixed(2),
      'Tepe Güç (kW)': report.summary.peakPower.toFixed(2),
      'Aktif Santral': report.summary.activeSites,
      'Toplam Santral': report.summary.totalSites,
      'Ortalama Verimlilik (%)': report.summary.averageEfficiency.toFixed(1),
      'CO2 Tasarrufu (ton)': report.summary.co2Saved.toFixed(3),
      'Eşdeğer Ev': Math.round(report.summary.equivalentHomes),
      'Son Güncelleme': report.metadata.lastRealtimeUpdate || 'N/A'
    }))
  }
  
  // Monthly data için farklı format
  return reports.map(report => ({
    'Ay': report.date,
    'Aylık Üretim (kWh)': report.summary.totalProduction.toFixed(2),
    'Ortalama Günlük Güç (kW)': report.summary.totalPower.toFixed(2),
    'En Yüksek Güç (kW)': report.summary.peakPower.toFixed(2),
    'Aktif Gün Sayısı': report.summary.activeSites,
    'CO2 Tasarrufu (ton)': report.summary.co2Saved.toFixed(3)
  }))
}
