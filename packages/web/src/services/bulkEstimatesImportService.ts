import * as XLSX from 'xlsx';
import { ProductionEstimatesService } from './productionEstimatesService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface BulkEstimateRow {
  siteName: string;
  siteId: string;
  january?: number;
  february?: number;
  march?: number;
  april?: number;
  may?: number;
  june?: number;
  july?: number;
  august?: number;
  september?: number;
  october?: number;
  november?: number;
  december?: number;
}

export interface BulkEstimateImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: string[];
  duplicateCount: number;
}

/**
 * Toplu Excel tahmin formatını parse eder
 * Format: Santral Adı | Ocak | Şubat | ... | Aralık (yılsız - genel tahminler)
 */
export class BulkEstimatesImportService {
  private static normalizeSiteName(name: string): string {
    if (!name) return '';
    const map: Record<string, string> = {
      'ş': 's', 'Ş': 's',
      'ğ': 'g', 'Ğ': 'g',
      'ü': 'u', 'Ü': 'u',
      'ö': 'o', 'Ö': 'o',
      'ç': 'c', 'Ç': 'c',
      'ı': 'i', 'İ': 'i',
    };
    const replaced = name
      .split('')
      .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
      .join('');
    return replaced
      .toLowerCase()
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s+/g, ''); // remove spaces for robust matching ("voyag 1" -> "voyag1")
  }
  
  /**
   * Excel dosyasını parse et
   */
  static async parseEstimatesExcelFile(file: File): Promise<BulkEstimateRow[]> {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Excel'i JSON'a çevir
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (jsonData.length < 2) {
        throw new Error('Excel dosyası en az 2 satır içermelidir (başlık + veri)');
      }
      
      // Başlık satırını al (1. satır)
      const headers = jsonData[0] as string[];
      console.log('📋 Excel headers (raw):', headers);
      
      // Beklenen başlıklar (yılsız)
      const expectedHeaders = [
        'Santral Adı', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
      ];
      
      // Başlık kontrolü (esnek)
      const headerMap: { [key: string]: number } = {};
      headers.forEach((header, index) => {
        if (header && header.toString().trim()) {
          const originalHeader = header.toString().trim();
          const normalizedHeader = originalHeader.toLowerCase();
          // Santral adı (çok esnek tanıma)
          if (normalizedHeader.includes('santral') || normalizedHeader.includes('site') || 
              normalizedHeader.includes('adi') || normalizedHeader.includes('adı') ||
              normalizedHeader.includes('name') || normalizedHeader === 'santral adi' ||
              normalizedHeader === 'santral adı' || normalizedHeader.startsWith('santral') ||
              (index === 0 && originalHeader.length > 0)) { // İlk sütun boş değilse santral adı olabilir
            headerMap['siteName'] = index;
          }
          // Aylar (farklı yazım şekillerini destekle)
          else if (normalizedHeader.includes('ocak') || normalizedHeader.includes('january') || normalizedHeader === 'ocak') {
            headerMap['january'] = index;
          }
          else if (normalizedHeader.includes('şubat') || normalizedHeader.includes('subat') || normalizedHeader.includes('february')) {
            headerMap['february'] = index;
          }
          else if (normalizedHeader.includes('mart') || normalizedHeader.includes('march')) {
            headerMap['march'] = index;
          }
          else if (normalizedHeader.includes('nisan') || normalizedHeader.includes('april')) {
            headerMap['april'] = index;
          }
          else if (normalizedHeader.includes('mayıs') || normalizedHeader.includes('mayis') || normalizedHeader.includes('may')) {
            headerMap['may'] = index;
          }
          else if (normalizedHeader.includes('haziran') || normalizedHeader.includes('june')) {
            headerMap['june'] = index;
          }
          else if (normalizedHeader.includes('temmuz') || normalizedHeader.includes('july')) {
            headerMap['july'] = index;
          }
          else if (normalizedHeader.includes('ağustos') || normalizedHeader.includes('agustos') || normalizedHeader.includes('august')) {
            headerMap['august'] = index;
          }
          else if (normalizedHeader.includes('eylül') || normalizedHeader.includes('eylul') || normalizedHeader.includes('september')) {
            headerMap['september'] = index;
          }
          else if (normalizedHeader.includes('ekim') || normalizedHeader.includes('october')) {
            headerMap['october'] = index;
          }
          else if (normalizedHeader.includes('kasım') || normalizedHeader.includes('kasim') || normalizedHeader.includes('november')) {
            headerMap['november'] = index;
          }
          else if (normalizedHeader.includes('aralık') || normalizedHeader.includes('aralik') || normalizedHeader.includes('december')) {
            headerMap['december'] = index;
          }
        }
      });
      

      
      if (headerMap.siteName === undefined) {
        const foundHeaders = headers.filter(h => h && h.toString().trim()).join(', ');
        throw new Error(`Excel dosyasında "Santral Adı" sütunu bulunamadı. Bulunan sütunlar: ${foundHeaders}. Lütfen ilk sütunun "Santral Adı" veya "Santral Adi" olduğundan emin olun.`);
      }
      
      // Veri satırlarını işle (2. satırdan itibaren)
      const parsedRows: BulkEstimateRow[] = [];
      
      for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex++) {
        const row = jsonData[rowIndex];
        
        if (!row || row.length === 0) continue; // Boş satırları atla
        
        try {
          // Santral adı
          const siteName = row[headerMap.siteName]?.toString().trim();
          
          if (!siteName) continue; // Eksik veri varsa atla
          
          // Site ID oluştur
          const siteId = siteName.toLowerCase().replace(/\s+/g, '_');
          
          // Aylık değerleri al
          const estimateRow: BulkEstimateRow = {
            siteName,
            siteId,
            january: headerMap.january !== undefined ? this.parseNumber(row[headerMap.january]) : undefined,
            february: headerMap.february !== undefined ? this.parseNumber(row[headerMap.february]) : undefined,
            march: headerMap.march !== undefined ? this.parseNumber(row[headerMap.march]) : undefined,
            april: headerMap.april !== undefined ? this.parseNumber(row[headerMap.april]) : undefined,
            may: headerMap.may !== undefined ? this.parseNumber(row[headerMap.may]) : undefined,
            june: headerMap.june !== undefined ? this.parseNumber(row[headerMap.june]) : undefined,
            july: headerMap.july !== undefined ? this.parseNumber(row[headerMap.july]) : undefined,
            august: headerMap.august !== undefined ? this.parseNumber(row[headerMap.august]) : undefined,
            september: headerMap.september !== undefined ? this.parseNumber(row[headerMap.september]) : undefined,
            october: headerMap.october !== undefined ? this.parseNumber(row[headerMap.october]) : undefined,
            november: headerMap.november !== undefined ? this.parseNumber(row[headerMap.november]) : undefined,
            december: headerMap.december !== undefined ? this.parseNumber(row[headerMap.december]) : undefined,
          };
          
          parsedRows.push(estimateRow);
          
        } catch (error) {
          console.warn(`⚠️ Row ${rowIndex + 1} skipped:`, error);
          // Hatalı satırları atla, devam et
        }
      }
      
      console.log(`✅ Parsed ${parsedRows.length} estimate rows`);
      return parsedRows;
      
    } catch (error) {
      console.error('❌ Excel parse error:', error);
      throw new Error(`Excel dosyası işlenemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    }
  }
  
  /**
   * Parse edilen tahminleri Firestore'a aktar
   */
  static async importBulkEstimates(
    estimateRows: BulkEstimateRow[],
    userId: string,
    progressCallback?: (processed: number, total: number) => void
  ): Promise<BulkEstimateImportResult> {
    try {
      const errors: string[] = [];
      let successCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      
      console.log(`📊 Starting bulk estimates import: ${estimateRows.length} rows`);

      // Build site name -> { id, name } map from Firestore
      const sitesSnap = await getDocs(collection(db, 'sites'));
      const normalizedNameToSite: Record<string, { id: string; name: string }> = {};
      sitesSnap.forEach((docSnap) => {
        const data: any = docSnap.data();
        const siteName: string = (data?.name || '').toString();
        const normalized = BulkEstimatesImportService.normalizeSiteName(siteName);
        if (normalized) {
          normalizedNameToSite[normalized] = { id: docSnap.id, name: siteName };
        }
      });
      console.log(`📍 Loaded ${Object.keys(normalizedNameToSite).length} sites for name matching`);
      
      for (let i = 0; i < estimateRows.length; i++) {
        const row = estimateRows[i];
        
        if (progressCallback) {
          progressCallback(i, estimateRows.length);
        }
        
        try {
          // Resolve real site from Firestore by name
          const normalizedRowName = BulkEstimatesImportService.normalizeSiteName(row.siteName);
          const resolvedSite = normalizedNameToSite[normalizedRowName];
          if (!resolvedSite) {
            errorCount++;
            const available = Object.keys(normalizedNameToSite).slice(0, 5).join(', ');
            const msg = `Eşleşen santral bulunamadı: "${row.siteName}". Lütfen isimlerin birebir (boşluk/altçizgi fark etmez) eşleştiğinden emin olun.`;
            console.warn(msg);
            errors.push(msg);
            continue;
          }

          // Her ay için tahmin kaydet (yılsız)
          const months = [
            { month: 1, value: row.january, name: 'Ocak' },
            { month: 2, value: row.february, name: 'Şubat' },
            { month: 3, value: row.march, name: 'Mart' },
            { month: 4, value: row.april, name: 'Nisan' },
            { month: 5, value: row.may, name: 'Mayıs' },
            { month: 6, value: row.june, name: 'Haziran' },
            { month: 7, value: row.july, name: 'Temmuz' },
            { month: 8, value: row.august, name: 'Ağustos' },
            { month: 9, value: row.september, name: 'Eylül' },
            { month: 10, value: row.october, name: 'Ekim' },
            { month: 11, value: row.november, name: 'Kasım' },
            { month: 12, value: row.december, name: 'Aralık' },
          ];
          
          let rowSuccessCount = 0;
          for (const monthData of months) {
            if (monthData.value && monthData.value > 0) {
              try {
                // Mevcut tahmini kontrol et (yılsız)
                const existingEstimate = await ProductionEstimatesService.getMonthlyEstimate(
                  resolvedSite.id,
                  monthData.month
                );
                
                if (existingEstimate) {
                  duplicateCount++;
                  console.log(`⚠️ Duplicate estimate: ${row.siteName} ${monthData.name}`);
                }
                
                await ProductionEstimatesService.saveMonthlyEstimate(
                  resolvedSite.id,
                  resolvedSite.name,
                  monthData.month,
                  monthData.value,
                  userId
                );
                
                rowSuccessCount++;
                
              } catch (monthError) {
                console.error(`❌ Error saving ${row.siteName} ${monthData.name}:`, monthError);
                errors.push(`${row.siteName} ${monthData.name}: ${monthError instanceof Error ? monthError.message : 'Bilinmeyen hata'}`);
              }
            }
          }
          
          if (rowSuccessCount > 0) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`${row.siteName}: Hiçbir aylık tahmin kaydedilemedi`);
          }
          
        } catch (rowError) {
          errorCount++;
          errors.push(`${row.siteName}: ${rowError instanceof Error ? rowError.message : 'Bilinmeyen hata'}`);
          console.error(`❌ Error processing row ${i + 1}:`, rowError);
        }
      }
      
      if (progressCallback) {
        progressCallback(estimateRows.length, estimateRows.length);
      }
      
      console.log(`✅ Bulk estimates import completed: ${successCount} success, ${errorCount} errors, ${duplicateCount} duplicates`);
      
      return {
        success: errorCount === 0,
        totalRows: estimateRows.length,
        successCount,
        errorCount,
        errors,
        duplicateCount
      };
      
    } catch (error) {
      console.error('❌ Bulk estimates import failed:', error);
      return {
        success: false,
        totalRows: estimateRows.length,
        successCount: 0,
        errorCount: estimateRows.length,
        errors: [error instanceof Error ? error.message : 'Import failed'],
        duplicateCount: 0
      };
    }
  }
  
  /**
   * Örnek Excel şablonu oluştur
   */
  static generateEstimatesSampleExcel(sites: Array<{ id: string; name: string; capacityMWp?: number }>): void {
    try {
      // Başlık satırı (yılsız) - Türkçe karaktersiz de destekle
      const headers = [
        'Santral Adi', 'Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran',
        'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik'
      ];
      
      // Örnek veri satırları
      const sampleData: any[][] = [headers];
      
      // Aylık faktörler (Türkiye ortalaması)
      const monthlyFactors = [0.6, 0.7, 0.85, 1.0, 1.15, 1.2, 1.25, 1.2, 1.0, 0.85, 0.65, 0.55];
      
      sites.forEach(site => {
        const row = [site.name];
        
        // Her ay için örnek tahmin değeri (kWh cinsinden)
        monthlyFactors.forEach((factor, monthIndex) => {
          const daysInMonth = new Date(2024, monthIndex + 1, 0).getDate();
          const capacity = site.capacityMWp || 5; // Varsayılan 5 MWp
          const estimatedKWh = Math.round(capacity * 4.5 * daysInMonth * factor);
          row.push(estimatedKWh.toString());
        });
        
        sampleData.push(row);
      });
      
      // Boş satırlar ekle (kullanıcı için)
      for (let i = 0; i < 3; i++) {
        const emptyRow = [''];
        for (let j = 0; j < 12; j++) {
          emptyRow.push('');
        }
        sampleData.push(emptyRow);
      }
      
      // Excel oluştur
      const ws = XLSX.utils.aoa_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tahminler');
      
      // Sütun genişliklerini ayarla
      const colWidths = [
        { wch: 20 }, // Santral Adı
        ...Array(12).fill({ wch: 12 }) // Aylar
      ];
      ws['!cols'] = colWidths;
      
      // Başlık satırını vurgula
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) continue;
        ws[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'E3F2FD' } }
        };
      }
      
      // İndir
      const filename = `SolarVeyo_Tahminler_Sablonu.xlsx`;
      XLSX.writeFile(wb, filename);
      
      console.log(`✅ Estimates sample Excel generated: ${filename}`);
      
    } catch (error) {
      console.error('❌ Error generating estimates sample Excel:', error);
      throw error;
    }
  }
  
  /**
   * Sayı parse et
   */
  private static parseNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    
    let numStr = value.toString();
    
    // Türkçe sayı formatı: "1.234,56" -> "1234.56"
    if (typeof value === 'string' && value.includes(',')) {
      numStr = numStr.replace(/\./g, '').replace(',', '.');
    }
    
    const num = parseFloat(numStr);
    return isNaN(num) ? undefined : num;
  }
}
