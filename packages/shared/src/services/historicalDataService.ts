import { collection, addDoc, writeBatch, doc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as XLSX from 'xlsx';

export interface HistoricalDataRow {
  date: string; // YYYY-MM-DD format
  siteId: string; // Otomatik oluşturulacak
  siteName: string;
  dailyProduction: number; // kWh
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: string[];
  duplicateCount: number;
}

export interface ImportProgress {
  processed: number;
  total: number;
  currentRow: HistoricalDataRow | null;
  status: 'preparing' | 'processing' | 'completed' | 'error';
}

/**
 * Excel dosyasından geçmiş üretim verilerini okur ve Firebase'e aktarır
 */
export class HistoricalDataService {
  
  /**
   * Excel dosyasını parse eder ve veri yapısını kontrol eder
   */
  static parseExcelFile(file: File): Promise<HistoricalDataRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // İlk sheet'i al
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // JSON'a çevir
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) {
            throw new Error('Excel dosyasında yeterli veri bulunamadı');
          }
          
          // Header satırını al
          const headers = jsonData[0] as string[];
          
          // Gerekli sütunları kontrol et (sadece 3 sütun)
          const requiredColumns = ['tarih', 'saha_adi', 'gunluk_uretim'];
          const missingColumns = requiredColumns.filter(col => 
            !headers.some(header => 
              header.toLowerCase().replace(/[^a-z]/g, '').includes(col.replace(/_/g, ''))
            )
          );
          
          if (missingColumns.length > 0) {
            throw new Error(`Eksik sütunlar: ${missingColumns.join(', ')}`);
          }
          
          // Sütun indekslerini bul (sadece 3 sütun)
          const columnMapping = {
            date: this.findColumnIndex(headers, ['tarih', 'date']),
            siteName: this.findColumnIndex(headers, ['saha_adi', 'site_name', 'sahaadi', 'santral', 'saha']),
            dailyProduction: this.findColumnIndex(headers, ['gunluk_uretim', 'daily_production', 'uretim', 'production'])
          };
          
          // Veri satırlarını parse et
          const rows: HistoricalDataRow[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            
            if (!row || row.length === 0) continue;
            
            try {
              const siteName = String(row[columnMapping.siteName] || '').trim();
              const production = this.parseNumber(row[columnMapping.dailyProduction]);
              
              // SiteId'yi site adından otomatik oluştur
              const siteId = this.generateSiteId(siteName);
              
              const parsedRow: HistoricalDataRow = {
                date: this.parseDate(row[columnMapping.date]),
                siteId: siteId,
                siteName: siteName,
                dailyProduction: production || 0
              };
              
              // Gerekli alanları kontrol et
              if (!parsedRow.date || !parsedRow.siteName || parsedRow.dailyProduction === null) {
                console.warn(`Satır ${i + 1} geçersiz: eksik gerekli alan`);
                continue;
              }
              
              rows.push(parsedRow);
            } catch (error) {
              console.warn(`Satır ${i + 1} parse edilemedi:`, error);
            }
          }
          
          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Dosya okunamadı'));
      reader.readAsArrayBuffer(file);
    });
  }
  
  /**
   * Site adından siteId oluşturur
   */
  private static generateSiteId(siteName: string): string {
    if (!siteName) return 'unknown-site';
    
    return siteName
      .toLowerCase()
      .replace(/[çğıöşü]/g, (char) => {
        const map: { [key: string]: string } = {
          'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u'
        };
        return map[char] || char;
      })
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  /**
   * Sütun adından indeks bulur
   */
  private static findColumnIndex(headers: string[], searchTerms: string[]): number {
    for (const term of searchTerms) {
      const index = headers.findIndex(header => 
        header.toLowerCase().replace(/[^a-z]/g, '').includes(term.replace(/_/g, ''))
      );
      if (index !== -1) return index;
    }
    return -1;
  }
  
  /**
   * Tarih string'ini YYYY-MM-DD formatına çevirir
   */
  private static parseDate(dateValue: any): string {
    if (!dateValue) throw new Error('Tarih değeri boş');
    
    let date = new Date(); // Default initialization
    
    if (typeof dateValue === 'number') {
      // Excel date number
      date = new Date((dateValue - 25569) * 86400 * 1000);
    } else if (typeof dateValue === 'string') {
      // String date
      const formats = [
        /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
        /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
        /^(\d{2})\.(\d{2})\.(\d{4})$/, // DD.MM.YYYY
        /^(\d{4})\/(\d{2})\/(\d{2})$/, // YYYY/MM/DD
      ];
      
      let matched = false;
      for (const format of formats) {
        const match = dateValue.match(format);
        if (match) {
          if (format.toString().includes('\\d{4})-')) {
            // YYYY-MM-DD
            date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          } else if (format.toString().includes('\\/')) {
            if (format.toString().startsWith('^(\\d{4})')) {
              // YYYY/MM/DD
              date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
            } else {
              // DD/MM/YYYY
              date = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
            }
          } else {
            // DD.MM.YYYY
            date = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
          }
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        date = new Date(dateValue);
      }
    } else {
      date = new Date(dateValue);
    }
    
    if (isNaN(date.getTime())) {
      throw new Error(`Geçersiz tarih: ${dateValue}`);
    }
    
    return date.toISOString().split('T')[0];
  }
  
  /**
   * Sayı değerini parse eder
   */
  private static parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    
    const num = typeof value === 'string' 
      ? parseFloat(value.replace(',', '.').replace(/[^0-9.-]/g, ''))
      : Number(value);
    
    return isNaN(num) ? null : num;
  }
  
  /**
   * Mevcut kayıtları kontrol eder (duplicate prevention)
   */
  static async checkExistingRecords(data: HistoricalDataRow[]): Promise<Set<string>> {
    const existingKeys = new Set<string>();
    
    try {
      // Unique date-siteId kombinasyonlarını al
      const uniqueCombinations = [...new Set(data.map(row => `${row.date}-${row.siteId}`))];
      
      // Batch olarak kontrol et (Firestore 'in' operatörü max 10 değer alır)
      const batchSize = 10;
      for (let i = 0; i < uniqueCombinations.length; i += batchSize) {
        const batch = uniqueCombinations.slice(i, i + batchSize);
        
        for (const combination of batch) {
          const [date, siteId] = combination.split('-');
          
          const q = query(
            collection(db, 'daily_production'),
            where('date', '==', date),
            where('siteId', '==', siteId)
          );
          
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            existingKeys.add(combination);
          }
        }
      }
    } catch (error) {
      console.error('Mevcut kayıtlar kontrol edilemedi:', error);
    }
    
    return existingKeys;
  }
  
  /**
   * Verileri Firebase'e yükler
   */
  static async importData(
    data: HistoricalDataRow[], 
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      totalRows: data.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      duplicateCount: 0
    };
    
    if (data.length === 0) {
      result.success = true;
      return result;
    }
    
    try {
      // Mevcut kayıtları kontrol et
      onProgress?.({
        processed: 0,
        total: data.length,
        currentRow: null,
        status: 'preparing'
      });
      
      const existingRecords = await this.checkExistingRecords(data);
      
      // Batch işlemi başlat
      const batchSize = 500; // Firestore batch limit
      let currentBatch = writeBatch(db);
      let batchCount = 0;
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const key = `${row.date}-${row.siteId}`;
        
        onProgress?.({
          processed: i,
          total: data.length,
          currentRow: row,
          status: 'processing'
        });
        
        try {
          // Duplicate kontrol
          if (existingRecords.has(key)) {
            result.duplicateCount++;
            continue;
          }
          
          // Document oluştur (basitleştirilmiş)
          const docData = {
            date: row.date,
            siteId: row.siteId,
            siteName: row.siteName,
            dailyProduction: row.dailyProduction,
            createdAt: new Date().toISOString(),
            importedBy: 'manual-upload',
            dataSource: 'excel-import'
          };
          
          const docRef = doc(collection(db, 'daily_production'));
          currentBatch.set(docRef, docData);
          batchCount++;
          
          // Batch limitine ulaştıysak commit et
          if (batchCount >= batchSize) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            batchCount = 0;
          }
          
          result.successCount++;
        } catch (error) {
          result.errorCount++;
          result.errors.push(`Satır ${i + 1}: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
        }
      }
      
      // Son batch'i commit et
      if (batchCount > 0) {
        await currentBatch.commit();
      }
      
      result.success = result.errorCount === 0;
      
      onProgress?.({
        processed: data.length,
        total: data.length,
        currentRow: null,
        status: 'completed'
      });
      
    } catch (error) {
      result.errors.push(`Genel hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
      onProgress?.({
        processed: 0,
        total: data.length,
        currentRow: null,
        status: 'error'
      });
    }
    
    return result;
  }
  
  /**
   * Basit Excel şablonu oluşturur (sadece 3 sütun)
   */
  static generateSampleExcel(sites: Array<{id: string, name: string}>): void {
    const sampleData = [
      ['Tarih', 'Saha Adı', 'Günlük Üretim (kWh)'],
    ];
    
    // Son 7 gün için örnek veriler
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      sites.slice(0, 3).forEach(site => {
        const randomProduction = Math.floor(Math.random() * 5000) + 1000;
        sampleData.push([
          dateStr,
          site.name,
          randomProduction.toString()
        ]);
      });
    }
    
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Geçmiş Üretim Verileri');
    
    const filename = `SolarVeyo_Basit_Veri_Sablonu_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  /**
   * Excel import edilen verileri saha bazında listeler
   */
  static async getImportedDataSummary(
    dateRange?: { startDate: string; endDate: string }
  ): Promise<Array<{
    siteId: string;
    siteName: string;
    recordCount: number;
    totalProduction: number;
    dateRange: { first: string; last: string };
    records: Array<{ date: string; production: number; docId: string }>;
  }>> {
    try {
      let q = query(
        collection(db, 'daily_production'),
        where('dataSource', '==', 'excel-import')
      );

      // Tarih aralığı filtresi varsa ekle
      if (dateRange) {
        q = query(q, 
          where('date', '>=', dateRange.startDate),
          where('date', '<=', dateRange.endDate)
        );
      }

      const snapshot = await getDocs(q);
      const allRecords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Saha bazında gruplama
      const siteGroups = new Map<string, any>();

      allRecords.forEach((record: any) => {
        const key = record.siteId;
        if (!siteGroups.has(key)) {
          siteGroups.set(key, {
            siteId: record.siteId,
            siteName: record.siteName,
            records: [],
            totalProduction: 0
          });
        }

        const group = siteGroups.get(key);
        group.records.push({
          date: record.date,
          production: record.dailyProduction,
          docId: record.id
        });
        group.totalProduction += record.dailyProduction;
      });

      // Sonuçları formatla
      const result = Array.from(siteGroups.values()).map(group => {
        const dates = group.records.map((r: any) => r.date).sort();
        return {
          siteId: group.siteId,
          siteName: group.siteName,
          recordCount: group.records.length,
          totalProduction: group.totalProduction,
          dateRange: {
            first: dates[0] || '',
            last: dates[dates.length - 1] || ''
          },
          records: group.records.sort((a: any, b: any) => a.date.localeCompare(b.date))
        };
      });

      return result.sort((a, b) => a.siteName.localeCompare(b.siteName));
    } catch (error) {
      console.error('Error getting imported data summary:', error);
      return [];
    }
  }

  /**
   * Geçmiş verileri siler (yönetici yetkisi gerekli)
   */
  static async deleteHistoricalData(
    dateRange: { startDate: string; endDate: string },
    siteIds?: string[],
    onProgress?: (deleted: number, total: number) => void
  ): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
    const result = {
      success: false,
      deletedCount: 0,
      errors: [] as string[]
    };

    try {
      // Query oluştur
      let q = query(
        collection(db, 'daily_production'),
        where('date', '>=', dateRange.startDate),
        where('date', '<=', dateRange.endDate),
        where('dataSource', '==', 'excel-import') // Sadece manuel import edilen verileri sil
      );

      const snapshot = await getDocs(q);
      const docsToDelete = snapshot.docs.filter(doc => {
        const data = doc.data();
        return !siteIds || siteIds.length === 0 || siteIds.includes(data.siteId);
      });

      if (docsToDelete.length === 0) {
        result.success = true;
        return result;
      }

      // Batch delete
      const batchSize = 500;
      let currentBatch = writeBatch(db);
      let batchCount = 0;

      for (let i = 0; i < docsToDelete.length; i++) {
        const docRef = docsToDelete[i].ref;
        currentBatch.delete(docRef);
        batchCount++;

        onProgress?.(result.deletedCount, docsToDelete.length);

        // Batch limitine ulaştıysak commit et
        if (batchCount >= batchSize || i === docsToDelete.length - 1) {
          await currentBatch.commit();
          result.deletedCount += batchCount;
          currentBatch = writeBatch(db);
          batchCount = 0;
        }
      }

      result.success = true;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Silme işlemi başarısız');
    }

    return result;
  }

  /**
   * Belirli kayıtları doküman ID'lerine göre siler
   */
  static async deleteSpecificRecords(
    docIds: string[],
    onProgress?: (deleted: number, total: number) => void
  ): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
    const result = {
      success: false,
      deletedCount: 0,
      errors: [] as string[]
    };

    if (docIds.length === 0) {
      result.success = true;
      return result;
    }

    try {
      // Batch delete
      const batchSize = 500;
      let currentBatch = writeBatch(db);
      let batchCount = 0;

      for (let i = 0; i < docIds.length; i++) {
        const docRef = doc(db, 'daily_production', docIds[i]);
        currentBatch.delete(docRef);
        batchCount++;

        onProgress?.(result.deletedCount, docIds.length);

        // Batch limitine ulaştıysak commit et
        if (batchCount >= batchSize || i === docIds.length - 1) {
          await currentBatch.commit();
          result.deletedCount += batchCount;
          currentBatch = writeBatch(db);
          batchCount = 0;
        }
      }

      result.success = true;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Silme işlemi başarısız');
    }

    return result;
  }
}
