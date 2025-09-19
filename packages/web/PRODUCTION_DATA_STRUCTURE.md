# Üretim Veri Yapısı Standardizasyonu

## 1. Daily Production Collection Yapısı

```javascript
// Collection: daily_production
// Document ID: YYYY-MM-DD (örn: 2025-01-15)
{
  date: "2025-01-15",
  metadata: {
    createdAt: Timestamp,
    updatedAt: Timestamp,
    dataSource: "realtime" | "manual" | "excel-import",
    importedBy: "user_id", // excel import için
    systemVersion: "1.0"
  },
  sites: [
    {
      siteId: "site_id",
      siteName: "Voyag 15",
      totalProduction: 25000, // kWh
      averagePower: 1200, // kW
      peakPower: 1500, // kW
      efficiency: 85.5, // %
      status: "active" | "inactive",
      dataSource: "realtime" | "manual" | "excel-import"
    }
  ],
  summary: {
    totalSites: 22,
    activeSites: 20,
    totalProduction: 760000, // kWh
    totalPower: 25000, // kW
    peakPower: 30000, // kW
    averageEfficiency: 87.2
  }
}
```

## 2. Production Estimates Collection (YENİ)

```javascript
// Collection: production_estimates
// Document ID: site_id
{
  siteId: "site_id",
  siteName: "Voyag 15",
  capacity: 2.5, // MWp
  estimates: {
    yearly: {
      2025: {
        target: 3500000, // kWh/yıl
        monthly: {
          1: 250000, // Ocak tahmini
          2: 280000, // Şubat tahmini
          // ... 12 aya kadar
        }
      }
    }
  },
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: "user_id"
}
```

## 3. Performance Tracking (YENİ)

```javascript
// Collection: performance_tracking
// Document ID: YYYY-MM (örn: 2025-01)
{
  year: 2025,
  month: 1,
  sites: [
    {
      siteId: "site_id",
      siteName: "Voyag 15",
      estimated: 250000, // kWh
      actual: 245000, // kWh
      performance: 98.0, // %
      variance: -5000, // kWh
      dailyData: [
        {
          date: "2025-01-01",
          estimated: 8064, // günlük tahmin
          actual: 7800, // gerçekleşen
          performance: 96.7
        }
      ]
    }
  ],
  summary: {
    totalEstimated: 5500000,
    totalActual: 5245000,
    overallPerformance: 95.4,
    bestPerformingSite: "site_id",
    worstPerformingSite: "site_id"
  }
}
```
