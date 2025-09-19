// Türkçe sayı formatları için utility functions

/**
 * Sayıları Türkçe formatında gösterir (nokta yerine virgül)
 * @param value - Formatlanacak sayı
 * @param decimals - Ondalık basamak sayısı (varsayılan: 1)
 * @returns Türkçe formatında sayı string
 */
export function formatNumberTR(value: number, decimals: number = 1): string {
  if (isNaN(value) || value === null || value === undefined) {
    return '0';
  }
  
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Güç değerlerini formatlar (kW, MW)
 * @param powerKW - kW cinsinden güç değeri
 * @param unit - Birim ('kW' veya 'MW')
 * @returns Formatlanmış güç değeri
 */
export function formatPower(powerKW: number, unit: 'kW' | 'MW' = 'kW'): string {
  if (unit === 'MW') {
    return `${formatNumberTR(powerKW / 1000, 2)} MW`;
  }
  return `${formatNumberTR(powerKW, 1)} kW`;
}

/**
 * Enerji değerlerini formatlar (kWh, MWh)
 * @param energyKWh - kWh cinsinden enerji değeri
 * @param unit - Birim ('kWh' veya 'MWh')
 * @returns Formatlanmış enerji değeri
 */
export function formatEnergy(energyKWh: number, unit: 'kWh' | 'MWh' = 'kWh'): string {
  if (unit === 'MWh') {
    return `${formatNumberTR(energyKWh / 1000, 2)} MWh`;
  }
  return `${formatNumberTR(energyKWh, 1)} kWh`;
}

/**
 * Sıcaklık değerlerini formatlar
 * @param tempC - Celsius cinsinden sıcaklık
 * @returns Formatlanmış sıcaklık değeri
 */
export function formatTemperature(tempC: number): string {
  return `${formatNumberTR(tempC, 1)}°C`;
}

/**
 * Yüzde değerlerini formatlar
 * @param percentage - Yüzde değeri
 * @returns Formatlanmış yüzde değeri
 */
export function formatPercentage(percentage: number): string {
  return `%${formatNumberTR(percentage, 1)}`;
}

/**
 * Voltaj değerlerini formatlar
 * @param voltage - Voltaj değeri
 * @returns Formatlanmış voltaj değeri
 */
export function formatVoltage(voltage: number): string {
  return `${formatNumberTR(voltage, 1)} V`;
}

/**
 * Akım değerlerini formatlar
 * @param current - Akım değeri
 * @returns Formatlanmış akım değeri
 */
export function formatCurrent(current: number): string {
  return `${formatNumberTR(current, 2)} A`;
}

/**
 * Frekans değerlerini formatlar
 * @param frequency - Frekans değeri
 * @returns Formatlanmış frekans değeri
 */
export function formatFrequency(frequency: number): string {
  return `${formatNumberTR(frequency, 2)} Hz`;
}

/**
 * Büyük sayıları otomatik olarak uygun birimde formatlar
 * @param value - Formatlanacak değer
 * @param baseUnit - Temel birim (örn: 'W', 'Wh')
 * @param type - Değer tipi ('power' veya 'energy')
 * @returns Formatlanmış değer
 */
export function formatAutoUnit(value: number, baseUnit: string = 'W', type: 'power' | 'energy' = 'power'): string {
  if (value >= 1000000) {
    return `${formatNumberTR(value / 1000000, 2)} M${baseUnit}`;
  } else if (value >= 1000) {
    return `${formatNumberTR(value / 1000, 1)} k${baseUnit}`;
  }
  return `${formatNumberTR(value, 1)} ${baseUnit}`;
}

/**
 * Tarih değerlerini Türkçe formatla
 * @param date - Formatlanacak tarih
 * @returns Türkçe formatında tarih string
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

