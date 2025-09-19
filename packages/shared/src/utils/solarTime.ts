// Akıllı güneş enerji zamanlaması
// Türkiye için mevsimsel güneş doğum/batım saatleri

interface SolarTimeConfig {
  sunrise: number; // Saat (24h format)
  sunset: number;  // Saat (24h format)
  peakStart: number; // Yoğun üretim başlangıcı
  peakEnd: number;   // Yoğun üretim bitişi
}

/**
 * Türkiye için mevsimsel güneş saatleri
 * Ankara/İstanbul koordinatları baz alınarak
 */
export function getSolarTimeConfig(date: Date = new Date()): SolarTimeConfig {
  const month = date.getMonth() + 1; // 1-12
  
  // Mevsimsel güneş saatleri (yaklaşık değerler)
  const solarTimes: { [key: number]: SolarTimeConfig } = {
    1:  { sunrise: 7.5, sunset: 17.5, peakStart: 9.5, peakEnd: 15.5 }, // Ocak
    2:  { sunrise: 7.2, sunset: 18.2, peakStart: 9.2, peakEnd: 16.2 }, // Şubat  
    3:  { sunrise: 6.5, sunset: 19.0, peakStart: 8.5, peakEnd: 17.0 }, // Mart
    4:  { sunrise: 6.0, sunset: 19.5, peakStart: 8.0, peakEnd: 17.5 }, // Nisan
    5:  { sunrise: 5.5, sunset: 20.2, peakStart: 7.5, peakEnd: 18.2 }, // Mayıs
    6:  { sunrise: 5.3, sunset: 20.5, peakStart: 7.3, peakEnd: 18.5 }, // Haziran
    7:  { sunrise: 5.5, sunset: 20.3, peakStart: 7.5, peakEnd: 18.3 }, // Temmuz
    8:  { sunrise: 6.0, sunset: 19.8, peakStart: 8.0, peakEnd: 17.8 }, // Ağustos
    9:  { sunrise: 6.5, sunset: 19.0, peakStart: 8.5, peakEnd: 17.0 }, // Eylül
    10: { sunrise: 7.0, sunset: 18.2, peakStart: 9.0, peakEnd: 16.2 }, // Ekim
    11: { sunrise: 7.3, sunset: 17.3, peakStart: 9.3, peakEnd: 15.3 }, // Kasım
    12: { sunrise: 7.7, sunset: 17.0, peakStart: 9.7, peakEnd: 15.0 }, // Aralık
  };
  
  return solarTimes[month];
}

/**
 * Şu anki saat güneş enerji üretimi için uygun mu?
 */
export function isSolarActiveTime(date: Date = new Date()): boolean {
  const config = getSolarTimeConfig(date);
  const currentHour = date.getHours() + (date.getMinutes() / 60);
  
  return currentHour >= config.sunrise && currentHour <= config.sunset;
}

/**
 * Şu anki saat yoğun üretim saati mi?
 */
export function isPeakSolarTime(date: Date = new Date()): boolean {
  const config = getSolarTimeConfig(date);
  const currentHour = date.getHours() + (date.getMinutes() / 60);
  
  return currentHour >= config.peakStart && currentHour <= config.peakEnd;
}

/**
 * Güneş enerji durumu açıklaması
 */
export function getSolarTimeDescription(date: Date = new Date()): {
  phase: 'night' | 'dawn' | 'peak' | 'dusk';
  description: string;
  expectedPowerRatio: number; // 0-1 arası
} {
  const config = getSolarTimeConfig(date);
  const currentHour = date.getHours() + (date.getMinutes() / 60);
  
  if (currentHour < config.sunrise || currentHour > config.sunset) {
    return {
      phase: 'night',
      description: '🌙 Gece - Güneş enerji üretimi yok',
      expectedPowerRatio: 0
    };
  }
  
  if (currentHour >= config.peakStart && currentHour <= config.peakEnd) {
    return {
      phase: 'peak', 
      description: '☀️ Yoğun üretim - Maksimum güneş enerji',
      expectedPowerRatio: 1.0
    };
  }
  
  if (currentHour < config.peakStart) {
    return {
      phase: 'dawn',
      description: '🌅 Sabah - Artan güneş enerji',
      expectedPowerRatio: (currentHour - config.sunrise) / (config.peakStart - config.sunrise)
    };
  }
  
  return {
    phase: 'dusk',
    description: '🌇 Akşam - Azalan güneş enerji', 
    expectedPowerRatio: (config.sunset - currentHour) / (config.sunset - config.peakEnd)
  };
}

/**
 * İyileştirilmiş gece/boş kontrolü - ZAMAN DAHİL
 */
export function isNightOrIdleImproved(inverter: any, date: Date = new Date()): {
  isNightOrIdle: boolean;
  reason: string;
  confidence: number; // 0-1
} {
  const timeInfo = getSolarTimeDescription(date);
  
  // Kesin gece ise
  if (timeInfo.phase === 'night') {
    return {
      isNightOrIdle: true,
      reason: `🌙 Gece saati (${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')})`,
      confidence: 1.0
    };
  }
  
  // Status kontrolü
  const statusText = (inverter.status || '').toString().toLowerCase();
  const hasOfflineStatus = statusText.includes('offline') || statusText.includes('standby');
  
  if (hasOfflineStatus) {
    return {
      isNightOrIdle: true,
      reason: `⚠️ Sistem durumu: ${inverter.status}`,
      confidence: 0.9
    };
  }
  
  // Güç kontrolü (mevsimsel beklenti ile)
  const activePower = inverter.activePower || 0;
  const expectedMinPower = timeInfo.expectedPowerRatio * 0.5; // Dinamik eşik
  
  if (activePower < expectedMinPower) {
    return {
      isNightOrIdle: true,
      reason: `⚡ Düşük güç: ${activePower.toFixed(1)}kW < ${expectedMinPower.toFixed(1)}kW (${timeInfo.description})`,
      confidence: 0.7
    };
  }
  
  return {
    isNightOrIdle: false,
    reason: `✅ Normal çalışma (${timeInfo.description})`,
    confidence: 0.8
  };
}
