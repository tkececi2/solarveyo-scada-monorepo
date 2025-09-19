import * as XLSX from 'xlsx';
import { importExcelDataUnified } from './unifiedProductionService';

export interface BulkExcelRow {
  date: string;
  siteProductions: { [siteName: string]: number };
}

export interface BulkImportResult {
  success: boolean;
  totalDays: number;
  totalRecords: number;
  processedDays: number;
  errors: string[];
}

/**
 * Toplu Excel formatını parse eder
 * Format: Gün | VOYAG 1 | VOYAG 2 | ... | VOYAG N
 */
export class BulkExcelImportService {
  
  /**
   * Excel dosyasını parse et
   */
  static async parseExcelFile(file: File): Promise<BulkExcelRow[]> {
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
      console.log('📋 Excel headers:', headers);
      
      // İlk sütun tarih, diğerleri santral isimleri
      const dateColumnIndex = 0;
      const siteColumns: { index: number; name: string }[] = [];
      
      for (let i = 1; i < headers.length; i++) {
        const header = headers[i];
        if (header && header.toString().trim()) {
          siteColumns.push({
            index: i,
            name: header.toString().trim()
          });
        }
      }
      
      console.log('🏭 Site columns found:', siteColumns);
      
      if (siteColumns.length === 0) {
        throw new Error('Santral sütunları bulunamadı. Excel formatını kontrol edin.');
      }
      
      // Veri satırlarını işle (2. satırdan itibaren)
      const parsedRows: BulkExcelRow[] = [];
      
      for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex++) {
        const row = jsonData[rowIndex];
        
        if (!row || row.length === 0) continue; // Boş satırları atla
        
        try {
          // Tarihi parse et
          const dateValue = row[dateColumnIndex];
          if (!dateValue) continue; // Tarih yoksa atla
          
          const parsedDate = this.parseDate(dateValue);
          
          // Santral üretimlerini al
          const siteProductions: { [siteName: string]: number } = {};
          let hasAnyProduction = false;
          
          for (const siteColumn of siteColumns) {
            const productionValue = row[siteColumn.index];
            const production = this.parseNumber(productionValue);
            
            if (production !== null && production > 0) {
              siteProductions[siteColumn.name] = production;
              hasAnyProduction = true;
            }
          }
          
          // En az bir santralda üretim varsa ekle
          if (hasAnyProduction) {
            parsedRows.push({
              date: parsedDate,
              siteProductions
            });
          }
          
        } catch (error) {
          console.warn(`⚠️ Row ${rowIndex + 1} skipped:`, error);
          // Hatalı satırları atla, devam et
        }
      }
      
      console.log(`✅ Parsed ${parsedRows.length} days with production data`);
      return parsedRows;
      
    } catch (error) {
      console.error('❌ Excel parse error:', error);
      throw new Error(`Excel dosyası işlenemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    }
  }
  
  /**
   * Parse edilen verileri Firestore'a aktar
   */
  static async importBulkData(
    bulkRows: BulkExcelRow[],
    userId: string,
    progressCallback?: (processed: number, total: number) => void
  ): Promise<BulkImportResult> {
    try {
      const errors: string[] = [];
      let totalRecords = 0;
      
      // Her gün için kayıt sayısını hesapla
      bulkRows.forEach(row => {
        totalRecords += Object.keys(row.siteProductions).length;
      });
      
      console.log(`📊 Starting bulk import: ${bulkRows.length} days, ${totalRecords} total records`);
      
      // Bulk verileri standart formata çevir
      const standardRows: Array<{ date: string; siteName: string; dailyProduction: number; siteId: string }> = [];
      
      bulkRows.forEach(bulkRow => {
        Object.entries(bulkRow.siteProductions).forEach(([siteName, production]) => {
          standardRows.push({
            date: bulkRow.date,
            siteName,
            dailyProduction: production,
            siteId: siteName.toLowerCase().replace(/\s+/g, '_')
          });
        });
      });
      
      // Unified service ile import et
      const result = await importExcelDataUnified(
        standardRows,
        userId,
        progressCallback
      );
      
      return {
        success: result.success,
        totalDays: bulkRows.length,
        totalRecords,
        processedDays: result.processedDates,
        errors: result.errors
      };
      
    } catch (error) {
      console.error('❌ Bulk import failed:', error);
      return {
        success: false,
        totalDays: bulkRows.length,
        totalRecords: 0,
        processedDays: 0,
        errors: [error instanceof Error ? error.message : 'Import failed']
      };
    }
  }
  
  /**
   * Örnek Excel şablonu oluştur
   */
  static generateBulkSampleExcel(sites: Array<{ id: string; name: string }>): void {
    try {
      // Başlık satırı
      const headers = ['Gün', ...sites.map(site => site.name)];
      
      // Örnek veri satırları (son 7 gün)
      const sampleData: any[][] = [headers];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        const dateStr = date.toLocaleDateString('tr-TR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        
        // Her santral için örnek üretim değeri (2000-8000 kWh arası)
        const row = [dateStr];
        sites.forEach(() => {
          const sampleProduction = Math.floor(Math.random() * 6000) + 2000;
          row.push(sampleProduction.toString());
        });
        
        sampleData.push(row);
      }
      
      // Excel oluştur
      const ws = XLSX.utils.aoa_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Günlük Üretim');
      
      // Sütun genişliklerini ayarla
      const colWidths = [{ wch: 12 }]; // Tarih sütunu
      sites.forEach(() => colWidths.push({ wch: 15 })); // Santral sütunları
      ws['!cols'] = colWidths;
      
      // İndir
      const filename = `SolarVeyo_Toplu_Import_Sablonu_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      
      console.log(`✅ Sample Excel generated: ${filename}`);
      
    } catch (error) {
      console.error('❌ Error generating sample Excel:', error);
      throw error;
    }
  }
  
  /**
   * Tarih parse et
   */
  private static parseDate(dateValue: any): string {
    let date: Date;
    
    if (typeof dateValue === 'string') {
      // Türkçe format: "1.01.2025", "01.01.2025"
      const turkishDateRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
      const match = dateValue.match(turkishDateRegex);
      
      if (match) {
        const [, day, month, year] = match;
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        date = new Date(dateValue);
      }
    } else if (typeof dateValue === 'number') {
      // Excel serial date
      date = new Date((dateValue - 25569) * 86400 * 1000);
    } else {
      date = new Date(dateValue);
    }
    
    if (isNaN(date.getTime())) {
      throw new Error(`Geçersiz tarih: ${dateValue}`);
    }
    
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
  
  /**
   * Sayı parse et
   */
  private static parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    
    let numStr = value.toString();
    
    // Türkçe sayı formatı: "1.234,56" -> "1234.56"
    if (typeof value === 'string' && value.includes(',')) {
      numStr = numStr.replace(/\./g, '').replace(',', '.');
    }
    
    const num = parseFloat(numStr);
    return isNaN(num) ? null : num;
  }
}
