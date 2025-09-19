import { collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface SiteProductionData {
  siteId: string;
  siteName: string;
  totalProduction: number; // kWh
  averagePower: number; // kW
  peakPower: number; // kW
  efficiency: number; // %
  status: 'active' | 'inactive';
  dataSource: 'realtime' | 'manual' | 'excel-import';
}

export interface DailyProductionDocument {
  date: string; // YYYY-MM-DD
  metadata: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    dataSource: 'realtime' | 'manual' | 'excel-import';
    importedBy?: string;
    systemVersion: string;
  };
  sites: SiteProductionData[];
  summary: {
    totalSites: number;
    activeSites: number;
    totalProduction: number;
    totalPower: number;
    peakPower: number;
    averageEfficiency: number;
    co2Saved: number;
    equivalentHomes: number;
  };
}

export interface ExcelImportRow {
  date: string;
  siteName: string;
  dailyProduction: number;
}

/**
 * Excel verilerini tarih bazlı gruplandırarak daily_production'a aktar
 * Dashboard ile aynı format kullanır
 */
export async function importExcelDataUnified(
  excelData: ExcelImportRow[],
  userId: string,
  progressCallback?: (processed: number, total: number) => void
): Promise<{ success: boolean; processedDates: number; errors: string[] }> {
  try {
    const errors: string[] = [];
    
    // 1. Verileri tarihe göre gruplandır
    const groupedByDate = new Map<string, ExcelImportRow[]>();
    
    excelData.forEach(row => {
      if (!groupedByDate.has(row.date)) {
        groupedByDate.set(row.date, []);
      }
      groupedByDate.get(row.date)!.push(row);
    });
    
    console.log(`📊 Excel data grouped into ${groupedByDate.size} dates`);
    
    // 2. Her tarih için daily_production document oluştur/güncelle
    let processedDates = 0;
    const totalDates = groupedByDate.size;
    
    for (const [date, dateRows] of groupedByDate) {
      try {
        await processDateData(date, dateRows, userId);
        processedDates++;
        
        if (progressCallback) {
          progressCallback(processedDates, totalDates);
        }
        
        console.log(`✅ Processed date: ${date} with ${dateRows.length} sites`);
      } catch (error) {
        const errorMsg = `Date ${date}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`❌ Error processing date ${date}:`, error);
      }
    }
    
    return {
      success: errors.length === 0,
      processedDates,
      errors
    };
    
  } catch (error) {
    console.error('❌ Excel import failed:', error);
    return {
      success: false,
      processedDates: 0,
      errors: [error instanceof Error ? error.message : 'Import failed']
    };
  }
}

/**
 * Belirli bir tarih için veri işle
 */
async function processDateData(
  date: string,
  dateRows: ExcelImportRow[],
  userId: string
): Promise<void> {
  const docRef = doc(db, 'daily_production', date);
  
  // Mevcut document'i kontrol et
  const existingDoc = await getDoc(docRef);
  let existingSites: SiteProductionData[] = [];
  let metadata = {
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    dataSource: 'excel-import' as const,
    importedBy: userId,
    systemVersion: '1.0'
  };
  
  if (existingDoc.exists()) {
    const existingData = existingDoc.data() as DailyProductionDocument;
    existingSites = existingData.sites || [];
    metadata.createdAt = existingData.metadata.createdAt;
  }
  
  // Site ID'lerini resolve et
  const siteMap = await resolveSiteIds(dateRows.map(row => row.siteName));
  
  // Yeni site verilerini hazırla
  const newSites: SiteProductionData[] = dateRows.map(row => {
    const siteId = siteMap.get(row.siteName);
    if (!siteId) {
      throw new Error(`Site not found: ${row.siteName}`);
    }
    
    return {
      siteId,
      siteName: row.siteName,
      totalProduction: row.dailyProduction,
      averagePower: row.dailyProduction / 8, // 8 saatlik ortalama
      peakPower: row.dailyProduction / 6, // 6 saatlik peak
      efficiency: 85, // Varsayılan
      status: 'active',
      dataSource: 'excel-import'
    };
  });
  
  // Mevcut verilerle birleştir (excel-import olanları güncelle)
  const mergedSites = [...existingSites.filter(site => site.dataSource !== 'excel-import')];
  newSites.forEach(newSite => {
    const existingIndex = mergedSites.findIndex(site => site.siteId === newSite.siteId);
    if (existingIndex >= 0) {
      mergedSites[existingIndex] = newSite; // Güncelle
    } else {
      mergedSites.push(newSite); // Ekle
    }
  });
  
  // Summary hesapla
  const summary = calculateSummary(mergedSites);
  
  // Document'i kaydet
  const documentData: DailyProductionDocument = {
    date,
    metadata,
    sites: mergedSites,
    summary
  };
  
  await setDoc(docRef, documentData);
}

/**
 * Site isimlerini ID'lere çevir
 */
async function resolveSiteIds(siteNames: string[]): Promise<Map<string, string>> {
  const siteMap = new Map<string, string>();
  
  try {
    const sitesSnapshot = await getDocs(collection(db, 'sites'));
    const sites = sitesSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name
    }));
    
    siteNames.forEach(siteName => {
      const site = sites.find(s => 
        s.name.toLowerCase().trim() === siteName.toLowerCase().trim()
      );
      
      if (site) {
        siteMap.set(siteName, site.id);
      } else {
        // Site bulunamazsa otomatik oluştur
        const siteId = generateSiteId(siteName);
        siteMap.set(siteName, siteId);
        console.warn(`⚠️ Site not found, generated ID: ${siteName} -> ${siteId}`);
      }
    });
    
    return siteMap;
  } catch (error) {
    console.error('Error resolving site IDs:', error);
    throw error;
  }
}

/**
 * Site ID oluştur
 */
function generateSiteId(siteName: string): string {
  return siteName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Summary hesapla
 */
function calculateSummary(sites: SiteProductionData[]) {
  const activeSites = sites.filter(site => site.status === 'active').length;
  const totalProduction = sites.reduce((sum, site) => sum + site.totalProduction, 0);
  const totalPower = sites.reduce((sum, site) => sum + site.averagePower, 0);
  const peakPower = Math.max(...sites.map(site => site.peakPower), 0);
  const averageEfficiency = sites.length > 0 
    ? sites.reduce((sum, site) => sum + site.efficiency, 0) / sites.length 
    : 0;
  
  return {
    totalSites: sites.length,
    activeSites,
    totalProduction,
    totalPower,
    peakPower,
    averageEfficiency,
    co2Saved: totalProduction * 0.0004,
    equivalentHomes: totalProduction / 30
  };
}

/**
 * Manuel veri ekleme (Dashboard ile uyumlu)
 */
export async function addManualProductionUnified(
  date: string,
  siteId: string,
  siteName: string,
  production: number,
  userId: string
): Promise<void> {
  const docRef = doc(db, 'daily_production', date);
  
  // Mevcut document'i al
  const existingDoc = await getDoc(docRef);
  let existingSites: SiteProductionData[] = [];
  let metadata = {
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    dataSource: 'manual' as const,
    systemVersion: '1.0'
  };
  
  if (existingDoc.exists()) {
    const existingData = existingDoc.data() as DailyProductionDocument;
    existingSites = existingData.sites || [];
    metadata.createdAt = existingData.metadata.createdAt;
  }
  
  // Yeni site verisi
  const newSiteData: SiteProductionData = {
    siteId,
    siteName,
    totalProduction: production,
    averagePower: production / 8,
    peakPower: production / 6,
    efficiency: 85,
    status: 'active',
    dataSource: 'manual'
  };
  
  // Mevcut verilerle birleştir
  const updatedSites = [...existingSites.filter(site => site.siteId !== siteId)];
  updatedSites.push(newSiteData);
  
  // Summary hesapla
  const summary = calculateSummary(updatedSites);
  
  // Kaydet
  const documentData: DailyProductionDocument = {
    date,
    metadata,
    sites: updatedSites,
    summary
  };
  
  await setDoc(docRef, documentData);
}
