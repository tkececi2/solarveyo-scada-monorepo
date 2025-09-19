import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, query, where, Timestamp, getDoc, documentId, deleteDoc } from 'firebase/firestore';

export interface SiteEstimate {
  siteId: string;
  siteName: string;
  month: number; // 1-12
  estimatedProductionKWh: number; // kWh cinsinden
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface MonthlyPerformance {
  siteId: string;
  siteName: string;
  year: number;
  month: number;
  estimatedKWh: number; // kWh cinsinden
  actualKWh: number; // kWh cinsinden
  performancePercentage: number; // (actual / estimated) * 100
  status: 'on_track' | 'below_target' | 'above_target';
}

export class ProductionEstimatesService {
  
  /**
   * Bir santral için aylık üretim tahmini ekler/günceller (yılsız - genel tahmin)
   */
  static async saveMonthlyEstimate(
    siteId: string, 
    siteName: string, 
    month: number, 
    estimatedKWh: number, 
    userId: string
  ): Promise<void> {
    const docId = `${siteId}-${String(month).padStart(2, '0')}`;
    const estimateRef = doc(db, 'production_estimates', docId);

    const now = Timestamp.now();
    const estimate: SiteEstimate = {
      siteId,
      siteName,
      month,
      estimatedProductionKWh: estimatedKWh,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    await setDoc(estimateRef, estimate, { merge: true });
    console.log(`✅ Monthly estimate saved: ${siteName} ${month} = ${estimatedKWh} kWh`);
  }

  /**
   * Belirli bir santral ve ay için tahmini getirir (yılsız)
   */
  static async getMonthlyEstimate(siteId: string, month: number): Promise<SiteEstimate | null> {
    const docId = `${siteId}-${String(month).padStart(2, '0')}`;
    const estimateDoc = await getDoc(doc(db, 'production_estimates', docId));
    
    if (estimateDoc.exists()) {
      return estimateDoc.data() as SiteEstimate;
    }
    return null;
  }

  /**
   * Belirli bir santral ve ay için tahmini siler
   */
  static async deleteMonthlyEstimate(siteId: string, month: number): Promise<void> {
    const docId = `${siteId}-${String(month).padStart(2, '0')}`;
    await deleteDoc(doc(db, 'production_estimates', docId));
  }

  /**
   * Bir santralin tüm aylık tahminlerini siler
   */
  static async deleteAllEstimatesForSite(siteId: string): Promise<number> {
    const q = query(collection(db, 'production_estimates'), where('siteId', '==', siteId));
    const snapshot = await getDocs(q);
    const ops = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(ops);
    return snapshot.size;
  }

  /**
   * Belirli bir santralın tüm tahminlerini getirir
   */
  static async getEstimatesForSite(siteId: string): Promise<SiteEstimate[]> {
    const q = query(
      collection(db, 'production_estimates'),
      where('siteId', '==', siteId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as SiteEstimate);
  }

  /**
   * Belirli bir ay için tüm santrallerin tahminlerini getirir
   */
  static async getMonthlyEstimatesForAllSites(month: number): Promise<SiteEstimate[]> {
    const q = query(
      collection(db, 'production_estimates'),
      where('month', '==', month)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as SiteEstimate);
  }

  /**
   * Belirli bir ay ve siteId listesi için tahminleri getirir (siteId 'in' ≤ 10 sınırını batch'leyerek)
   */
  static async getMonthlyEstimatesForSiteIds(month: number, siteIds: string[]): Promise<SiteEstimate[]> {
    if (siteIds.length === 0) return [];
    const batches: string[][] = [];
    for (let i = 0; i < siteIds.length; i += 10) {
      batches.push(siteIds.slice(i, i + 10));
    }
    const results = await Promise.all(batches.map(async (batch) => {
      const q = query(
        collection(db, 'production_estimates'),
        where('month', '==', month),
        where('siteId', 'in', batch)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => d.data() as SiteEstimate);
    }));
    return results.flat();
  }

  /**
   * Aylık performansı hesaplar (tahmin vs gerçekleşen)
   */
  static async calculateMonthlyPerformance(
    siteId: string, 
    siteName: string, 
    year: number, 
    month: number
  ): Promise<MonthlyPerformance> {
    
    // 1. Tahmini al (yılsız - genel tahmin)
    const estimate = await this.getMonthlyEstimate(siteId, month);
    const estimatedKWh = estimate ? estimate.estimatedProductionKWh : 0;

    // 2. Gerçekleşen üretimi hesapla (daily_production koleksiyonundan) — tek sorgu ile ayın tüm günleri
    let actualKWh = 0;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Ayın son günü
    const startId = `${year}-${String(month).padStart(2, '0')}-01`;
    const endId = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    try {
      const q = query(
        collection(db, 'daily_production'),
        where(documentId(), '>=', startId),
        where(documentId(), '<=', endId)
      );
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const dailyData: any = docSnap.data();
        const siteData = dailyData.sites?.find((s: any) => s.siteId === siteId);
        if (siteData) {
          actualKWh += (siteData.totalProduction || 0);
        }
      });
    } catch (error) {
      console.warn(`⚠️ Monthly data fetch failed for ${startId}..${endId}:`, error);
    }

    // 3. Performans hesapla
    const performancePercentage = estimatedKWh > 0 ? (actualKWh / estimatedKWh) * 100 : 0;
    
    let status: MonthlyPerformance['status'] = 'on_track';
    if (performancePercentage < 90) {
      status = 'below_target';
    } else if (performancePercentage > 110) {
      status = 'above_target';
    }

    return {
      siteId,
      siteName,
      year,
      month,
      estimatedKWh,
      actualKWh,
      performancePercentage,
      status,
    };
  }

  /**
   * Birden fazla santral için performans hesaplar
   */
  static async calculatePerformanceForSites(
    siteIds: string[], 
    siteNames: { [siteId: string]: string }, 
    year: number, 
    month: number
  ): Promise<MonthlyPerformance[]> {
    const performances: MonthlyPerformance[] = [];
    
    for (const siteId of siteIds) {
      const siteName = siteNames[siteId] || siteId;
      try {
        const performance = await this.calculateMonthlyPerformance(siteId, siteName, year, month);
        performances.push(performance);
      } catch (error) {
        console.error(`❌ Error calculating performance for ${siteName}:`, error);
        // Hata durumunda boş performans ekle
        performances.push({
          siteId,
          siteName,
          year,
          month,
          estimatedKWh: 0,
          actualKWh: 0,
          performancePercentage: 0,
          status: 'below_target'
        });
      }
    }
    
    return performances;
  }

  /**
   * Santral kapasitesine göre basit bir aylık tahmin hesaplar (kWh cinsinden)
   */
  static calculateMonthlyEstimateFromCapacity(capacityMWp: number, month: number): number {
    // Aylık güneş radyasyonu katsayıları (Türkiye ortalaması)
    const monthlyFactors = [
      0.6,  // Ocak
      0.7,  // Şubat
      0.85, // Mart
      1.0,  // Nisan
      1.15, // Mayıs
      1.2,  // Haziran
      1.25, // Temmuz
      1.2,  // Ağustos
      1.0,  // Eylül
      0.85, // Ekim
      0.65, // Kasım
      0.55  // Aralık
    ];
    
    const monthFactor = monthlyFactors[month - 1] || 0.8;
    const daysInMonth = new Date(2024, month, 0).getDate();
    
    // Basit hesaplama: Kapasite × Günlük ortalama × Gün sayısı × Aylık faktör
    return capacityMWp * 4.5 * daysInMonth * monthFactor; // kWh cinsinden
  }

  /**
   * Yıllık performansı hesaplar (tahmin vs gerçekleşen)
   */
  static async calculateYearlyPerformance(
    siteId: string, 
    siteName: string, 
    year: number
  ): Promise<MonthlyPerformance> {
    
    let totalEstimatedKWh = 0;
    let totalActualKWh = 0;

    // Her ay için tahmin ve gerçekleşenleri topla
    for (let month = 1; month <= 12; month++) {
      const monthlyPerf = await this.calculateMonthlyPerformance(siteId, siteName, year, month);
      totalEstimatedKWh += monthlyPerf.estimatedKWh;
      totalActualKWh += monthlyPerf.actualKWh;
    }

    // Yıllık performans hesapla
    const performancePercentage = totalEstimatedKWh > 0 ? (totalActualKWh / totalEstimatedKWh) * 100 : 0;
    
    let status: MonthlyPerformance['status'] = 'on_track';
    if (performancePercentage < 90) {
      status = 'below_target';
    } else if (performancePercentage > 110) {
      status = 'above_target';
    }

    return {
      siteId,
      siteName,
      year,
      month: 0, // Yıllık için 0 kullanıyoruz
      estimatedKWh: totalEstimatedKWh,
      actualKWh: totalActualKWh,
      performancePercentage,
      status,
    };
  }

  /**
   * Birden fazla santral için yıllık performans hesaplar
   */
  static async calculateYearlyPerformanceForSites(
    siteIds: string[], 
    siteNames: { [siteId: string]: string }, 
    year: number
  ): Promise<MonthlyPerformance[]> {
    const performances: MonthlyPerformance[] = [];
    
    for (const siteId of siteIds) {
      const siteName = siteNames[siteId] || siteId;
      try {
        const performance = await this.calculateYearlyPerformance(siteId, siteName, year);
        performances.push(performance);
      } catch (error) {
        console.error(`❌ Error calculating yearly performance for ${siteName}:`, error);
        // Hata durumunda boş performans ekle
        performances.push({
          siteId,
          siteName,
          year,
          month: 0,
          estimatedKWh: 0,
          actualKWh: 0,
          performancePercentage: 0,
          status: 'below_target'
        });
      }
    }
    
    return performances;
  }
}