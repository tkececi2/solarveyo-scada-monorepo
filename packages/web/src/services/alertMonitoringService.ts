import { NotificationService } from './notificationService';
import { 
  NotificationSettings, 
  NotificationAlert, 
  SangrowData, 
  FusionData, 
  InverterData,
  User,
  Site
} from '../types';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export class AlertMonitoringService {
  private static instance: AlertMonitoringService;
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastAlertTimes: Map<string, Date> = new Map();
  private isMonitoring = false;

  static getInstance(): AlertMonitoringService {
    if (!AlertMonitoringService.instance) {
      AlertMonitoringService.instance = new AlertMonitoringService();
    }
    return AlertMonitoringService.instance;
  }

  // İzlemeyi başlat
  async startMonitoring(user: User): Promise<void> {
    if (this.isMonitoring) {
      console.log('🔔 Monitoring already started');
      return;
    }

    // 🔒 GÜVENLİK KONTROLÜ: Sadece admin/manager için monitoring
    if (user.role !== 'admin' && user.role !== 'manager') {
      console.log('🔔 Alert monitoring disabled for role:', user.role);
      return;
    }

    console.log('🔔 Starting alert monitoring for manager/admin:', user.uid, user.role);
    this.isMonitoring = true;

    // Kullanıcı ayarlarını al
    let settings = await NotificationService.getUserNotificationSettings(user.uid);
    if (!settings) {
      try {
        console.log('🔔 Creating default notification settings for manager/admin');
        settings = await NotificationService.createDefaultSettings(user.uid, user.assignedSites || []);
      } catch (error) {
        console.error('🔔 Could not create default settings (permissions):', error);
        // Varsayılan client-side settings ile devam et
        this.isMonitoring = false;
        return;
      }
    }

    // Her site için izleme başlat
    const sitesToMonitor = user.role === 'admin' ? await this.getAllSiteIds() : (user.assignedSites || []);
    
    console.log('🔔 Sites to monitor:', sitesToMonitor);
    
    for (const siteId of sitesToMonitor) {
      console.log('🔔 Starting monitoring for site:', siteId);
      this.startSiteMonitoring(siteId, user, settings);
    }
  }

  // İzlemeyi durdur
  stopMonitoring(): void {
    console.log('Stopping alert monitoring');
    this.isMonitoring = false;
    
    // Tüm interval'ları temizle
    this.monitoringIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.monitoringIntervals.clear();
    this.lastAlertTimes.clear();
  }

  // Belirli bir site için izleme başlat
  private startSiteMonitoring(siteId: string, user: User, settings: NotificationSettings): void {
    const intervalId = setInterval(async () => {
      try {
        await this.checkSiteAlerts(siteId, user, settings);
      } catch (error) {
        console.error(`Site ${siteId} monitoring error:`, error);
      }
    }, 30000); // 30 saniye aralıklarla kontrol

    this.monitoringIntervals.set(siteId, intervalId);
  }

  // Site uyarılarını kontrol et
  private async checkSiteAlerts(siteId: string, user: User, settings: NotificationSettings): Promise<void> {
    try {
      // Site verilerini al - basit yaklaşım
      const siteData = await this.getSiteData(siteId);
      if (!siteData || siteData.length === 0) {
        console.log(`🔔 No data found for site ${siteId}`);
        return;
      }
      
      console.log(`🔔 Found ${siteData.length} inverters for site ${siteId}`);

      const siteName = await this.getSiteName(siteId);

      // Her inverter için kontrolleri yap
      for (const inverterData of siteData) {
        await this.checkInverterAlerts(inverterData, siteId, siteName, user, settings);
        await this.checkTemperatureAlerts(inverterData, siteId, siteName, user, settings);
        await this.checkPVStringAlerts(inverterData, siteId, siteName, user, settings);
      }
    } catch (error) {
      console.error(`Error checking alerts for site ${siteId}:`, error);
    }
  }

  // Santraller sayfasındaki mevcut hata tespit sistemini kullan
  private async getSiteData(siteId: string): Promise<InverterData[]> {
    // Bu fonksiyon artık Sites.tsx'deki mevcut veri akışını kullanacak
    // Gerçek zamanlı veri için subscribeToCollection kullanılmalı
    console.log(`🔔 Using existing site data monitoring for site: ${siteId}`);
    return []; // Placeholder - gerçek veri Sites.tsx'den gelecek
  }

  // SANGROW status'unu normalize et
  private getSangrowStatus(deviceStatus?: number): string {
    switch (deviceStatus) {
      case 0: return 'offline';
      case 1: return 'normal';
      case 2: return 'fault';
      case 3: return 'standby';
      case 4: return 'alarm';
      default: return 'unknown';
    }
  }

  // İnvertör durumu uyarıları
  private async checkInverterAlerts(
    inverterData: InverterData, 
    siteId: string, 
    siteName: string, 
    user: User, 
    settings: NotificationSettings
  ): Promise<void> {
    if (!settings.inverterAlerts.enabled) return;

    const deviceKey = `${siteId}-${inverterData.id}`;
    const cooldownKey = `inverter-${deviceKey}`;
    
    // Cooldown kontrolü (5 dakika)
    if (this.isInCooldown(cooldownKey, 5)) return;

    let shouldAlert = false;
    let alertType = '';
    let severity: 'info' | 'warning' | 'critical' = 'warning';
    let message = '';

    // SANGROW için durum kontrolleri
    if (inverterData.systemType === 'SANGROW') {
      const sangrowData = inverterData as any as SangrowData;
      const status = sangrowData.device_status;
      
      if (status === 0 && settings.inverterAlerts.offlineAlert) {
        shouldAlert = true;
        alertType = 'offline';
        severity = 'critical';
        message = `${inverterData.name} invertörü çevrimdışı durumda`;
      } else if (status === 2 && settings.inverterAlerts.faultAlert) {
        shouldAlert = true;
        alertType = 'fault';
        severity = 'critical';
        message = `${inverterData.name} invertöründe arıza tespit edildi (Fault Code: ${sangrowData.device_fault_status})`;
      } else if (status === 4 && settings.inverterAlerts.alarmAlert) {
        shouldAlert = true;
        alertType = 'alarm';
        severity = 'warning';
        message = `${inverterData.name} invertöründe alarm durumu`;
      }
    }
    
    // FUSION için durum kontrolleri
    else if (inverterData.systemType === 'FUSION') {
      const fusionData = inverterData as any as FusionData;
      const state = fusionData.status?.state?.toLowerCase();
      
      if (state === 'offline' && settings.inverterAlerts.offlineAlert) {
        shouldAlert = true;
        alertType = 'offline';
        severity = 'critical';
        message = `${inverterData.name} invertörü çevrimdışı durumda`;
      } else if (state === 'fault' && settings.inverterAlerts.faultAlert) {
        shouldAlert = true;
        alertType = 'fault';
        severity = 'critical';
        message = `${inverterData.name} invertöründe arıza tespit edildi`;
      }
    }

    if (shouldAlert) {
      await NotificationService.createAlert({
        userId: user.uid,
        siteId,
        siteName,
        type: 'inverter',
        severity,
        title: `İnvertör ${alertType === 'offline' ? 'Çevrimdışı' : alertType === 'fault' ? 'Arıza' : 'Alarm'}`,
        message,
        deviceId: inverterData.id,
        deviceName: inverterData.name,
        acknowledged: false,
      });

      this.setLastAlertTime(cooldownKey);
    }
  }

  // Sıcaklık uyarıları
  private async checkTemperatureAlerts(
    inverterData: InverterData, 
    siteId: string, 
    siteName: string, 
    user: User, 
    settings: NotificationSettings
  ): Promise<void> {
    if (!settings.temperatureAlerts.enabled) return;

    const temperature = inverterData.temperature || inverterData.internalTemperature;
    if (!temperature) return;

    const deviceKey = `${siteId}-${inverterData.id}`;
    const cooldownKey = `temperature-${deviceKey}`;
    
    // Cooldown kontrolü (10 dakika)
    if (this.isInCooldown(cooldownKey, 10)) return;

    let shouldAlert = false;
    let severity: 'warning' | 'critical' = 'warning';
    let message = '';

    if (temperature >= settings.temperatureAlerts.criticalTempThreshold) {
      shouldAlert = true;
      severity = 'critical';
      message = `${inverterData.name} invertörü kritik sıcaklık seviyesinde (${temperature}°C)`;
    } else if (temperature >= settings.temperatureAlerts.highTempThreshold) {
      shouldAlert = true;
      severity = 'warning';
      message = `${inverterData.name} invertörü yüksek sıcaklık seviyesinde (${temperature}°C)`;
    }

    if (shouldAlert) {
      await NotificationService.createAlert({
        userId: user.uid,
        siteId,
        siteName,
        type: 'temperature',
        severity,
        title: severity === 'critical' ? 'Kritik Sıcaklık Uyarısı' : 'Yüksek Sıcaklık Uyarısı',
        message,
        deviceId: inverterData.id,
        deviceName: inverterData.name,
        value: temperature,
        threshold: severity === 'critical' ? 
          settings.temperatureAlerts.criticalTempThreshold : 
          settings.temperatureAlerts.highTempThreshold,
        acknowledged: false,
      });

      this.setLastAlertTime(cooldownKey);
    }
  }

  // PV String uyarıları
  private async checkPVStringAlerts(
    inverterData: InverterData, 
    siteId: string, 
    siteName: string, 
    user: User, 
    settings: NotificationSettings
  ): Promise<void> {
    if (!settings.pvStringAlerts.enabled) return;

    // SANGROW string verilerini kontrol et
    if (inverterData.systemType === 'SANGROW') {
      await this.checkSangrowStringAlerts(inverterData as any, siteId, siteName, user, settings);
    }
    // FUSION PV input verilerini kontrol et
    else if (inverterData.systemType === 'FUSION') {
      await this.checkFusionPVInputAlerts(inverterData as any, siteId, siteName, user, settings);
    }
  }

  // SANGROW string uyarıları
  private async checkSangrowStringAlerts(
    sangrowData: SangrowData, 
    siteId: string, 
    siteName: string, 
    user: User, 
    settings: NotificationSettings
  ): Promise<void> {
    // 32 string'i kontrol et
    for (let i = 1; i <= 32; i++) {
      const voltage = (sangrowData as any)[`string${i}_voltage`];
      const current = (sangrowData as any)[`string${i}_current`];
      
      if (!voltage && !current) continue; // String mevcut değil

      const stringKey = `string${i}`;
      const deviceKey = `${siteId}-${sangrowData.device_sn}-${stringKey}`;
      const cooldownKey = `pvstring-${deviceKey}`;
      
      // Cooldown kontrolü (15 dakika)
      if (this.isInCooldown(cooldownKey, 15)) continue;

      const power = (voltage || 0) * (current || 0) / 1000; // kW
      const expectedPower = this.calculateExpectedStringPower(); // Ortalama beklenen güç
      const performance = expectedPower > 0 ? (power / expectedPower) * 100 : 0;

      let shouldAlert = false;
      let severity: 'warning' | 'critical' = 'warning';
      let message = '';

      // Performans uyarısı
      if (performance < settings.pvStringAlerts.performanceThreshold && settings.pvStringAlerts.lowPerformanceAlert) {
        shouldAlert = true;
        severity = 'warning';
        message = `${sangrowData.device_name} - String ${i} düşük performans gösteriyor (%${performance.toFixed(1)})`;
      }
      
      // String arıza uyarısı (voltaj var ama akım yok)
      else if (voltage > 50 && current < 0.1 && settings.pvStringAlerts.faultAlert) {
        shouldAlert = true;
        severity = 'critical';
        message = `${sangrowData.device_name} - String ${i} arızalı olabilir (V:${voltage}V, I:${current}A)`;
      }

      if (shouldAlert) {
        await NotificationService.createAlert({
          userId: user.uid,
          siteId,
          siteName,
          type: 'pvstring',
          severity,
          title: severity === 'critical' ? 'PV String Arızası' : 'PV String Düşük Performans',
          message,
          deviceId: sangrowData.device_sn,
          deviceName: `${sangrowData.device_name} - String ${i}`,
          value: performance,
          threshold: settings.pvStringAlerts.performanceThreshold,
          acknowledged: false,
        });

        this.setLastAlertTime(cooldownKey);
      }
    }
  }

  // FUSION PV input uyarıları
  private async checkFusionPVInputAlerts(
    fusionData: FusionData, 
    siteId: string, 
    siteName: string, 
    user: User, 
    settings: NotificationSettings
  ): Promise<void> {
    if (!fusionData.pvInputs) return;

    for (const [pvKey, pvData] of Object.entries(fusionData.pvInputs)) {
      const voltage = pvData.V || pvData.voltage || 0;
      const current = pvData.I || pvData.current || 0;
      
      if (!voltage && !current) continue;

      const deviceKey = `${siteId}-${fusionData.sn}-${pvKey}`;
      const cooldownKey = `pvstring-${deviceKey}`;
      
      // Cooldown kontrolü (15 dakika)
      if (this.isInCooldown(cooldownKey, 15)) continue;

      const power = voltage * current / 1000; // kW
      const expectedPower = this.calculateExpectedStringPower();
      const performance = expectedPower > 0 ? (power / expectedPower) * 100 : 0;

      let shouldAlert = false;
      let severity: 'warning' | 'critical' = 'warning';
      let message = '';

      // Performans uyarısı
      if (performance < settings.pvStringAlerts.performanceThreshold && settings.pvStringAlerts.lowPerformanceAlert) {
        shouldAlert = true;
        severity = 'warning';
        message = `${fusionData.sn} - ${pvKey} düşük performans gösteriyor (%${performance.toFixed(1)})`;
      }
      
      // String arıza uyarısı
      else if (voltage > 50 && current < 0.1 && settings.pvStringAlerts.faultAlert) {
        shouldAlert = true;
        severity = 'critical';
        message = `${fusionData.sn} - ${pvKey} arızalı olabilir (V:${voltage}V, I:${current}A)`;
      }

      if (shouldAlert) {
        await NotificationService.createAlert({
          userId: user.uid,
          siteId,
          siteName,
          type: 'pvstring',
          severity,
          title: severity === 'critical' ? 'PV Input Arızası' : 'PV Input Düşük Performans',
          message,
          deviceId: fusionData.sn,
          deviceName: `${fusionData.sn} - ${pvKey}`,
          value: performance,
          threshold: settings.pvStringAlerts.performanceThreshold,
          acknowledged: false,
        });

        this.setLastAlertTime(cooldownKey);
      }
    }
  }

  // Cooldown kontrolü
  private isInCooldown(key: string, minutes: number): boolean {
    const lastAlert = this.lastAlertTimes.get(key);
    if (!lastAlert) return false;
    
    const cooldownMs = minutes * 60 * 1000;
    return (Date.now() - lastAlert.getTime()) < cooldownMs;
  }

  // Son uyarı zamanını kaydet
  private setLastAlertTime(key: string): void {
    this.lastAlertTimes.set(key, new Date());
  }

  // Beklenen string gücünü hesapla (basit algoritma)
  private calculateExpectedStringPower(): number {
    const hour = new Date().getHours();
    
    // Gündüz saatlerinde beklenen güç (örnek değerler)
    if (hour >= 6 && hour <= 18) {
      // Güneş açısına göre basit hesaplama
      if (hour >= 11 && hour <= 14) return 2.0; // Öğle saatleri
      if (hour >= 9 && hour <= 16) return 1.5; // İyi saatler
      return 1.0; // Diğer gündüz saatleri
    }
    
    return 0.1; // Gece saatleri
  }

  // Tüm site ID'lerini al
  private async getAllSiteIds(): Promise<string[]> {
    try {
      const sitesSnapshot = await getDocs(collection(db, 'sites'));
      return sitesSnapshot.docs.map(doc => doc.id);
    } catch (error) {
      console.error('Error getting all site IDs:', error);
      return [];
    }
  }

  // Site adını al
  private async getSiteName(siteId: string): Promise<string> {
    try {
      const sitesSnapshot = await getDocs(collection(db, 'sites'));
      const siteDoc = sitesSnapshot.docs.find(doc => doc.id === siteId);
      if (siteDoc) {
        const siteData = siteDoc.data() as Site;
        return siteData.name || `Site ${siteId}`;
      }
      return `Site ${siteId}`;
    } catch (error) {
      console.error('Error getting site name:', error);
      return `Site ${siteId}`;
    }
  }
}
