// Kullanıcı tipleri
export interface User {
  uid: string
  email: string
  role: 'admin' | 'manager' | 'viewer'
  displayName?: string
  assignedSites?: string[] // Viewer için atanan sahalar
  createdAt?: Date
  createdBy?: string
}

// Sistem tipleri
export type SystemType = 'SANGROW' | 'FUSION'

// Santral tipleri
export interface Site {
  id: string
  name: string
  location?: string
  capacityMWp: number
  systemType: SystemType
  sources: DataSource[]
  createdAt: Date
  createdBy: string
}

export interface DataSource {
  type: SystemType
  collection: string
}

// SANGROW veri yapısı (Arazi GES formatı)
export interface SangrowData {
  collection_name?: string | null
  communication_device_sn?: string
  daily_yield_theoretical?: number
  device_fault_status?: number // 0=No fault, >0=Fault codes
  device_name?: string
  device_sn?: string
  device_status?: number // 1=Normal, 2=Fault, 3=Standby, 4=Alarm, 0=Offline
  device_time?: number
  grid_frequency?: number
  internal_air_temperature?: number
  inverter_output_current_r?: number
  inverter_output_current_s?: number
  inverter_output_current_t?: number
  inverter_output_voltage_r?: number
  inverter_output_voltage_s?: number
  inverter_output_voltage_t?: number
  power_factor?: number
  ps_id?: string
  ps_key?: string
  ps_name?: string
  santralNo?: string
  toplamSantral?: string
  total_active_power?: number
  total_apparent_power?: number
  total_dc_power?: number
  total_reactive_power?: number
  total_yield?: number
  updated_at?: any // Firebase timestamp
  yield_this_month?: number
  yield_this_year?: number
  yield_today?: number
  // MPPT veriler (1-16)
  mppt1_current?: number
  mppt1_voltage?: number
  mppt2_current?: number
  mppt2_voltage?: number
  mppt3_current?: number
  mppt3_voltage?: number
  mppt4_current?: number
  mppt4_voltage?: number
  mppt5_current?: number
  mppt5_voltage?: number
  mppt6_current?: number
  mppt6_voltage?: number
  mppt7_current?: number
  mppt7_voltage?: number
  mppt8_current?: number
  mppt8_voltage?: number
  mppt9_current?: number
  mppt9_voltage?: number
  mppt10_current?: number
  mppt10_voltage?: number
  mppt11_current?: number
  mppt11_voltage?: number
  mppt12_current?: number
  mppt12_voltage?: number
  mppt13_current?: number
  mppt13_voltage?: number
  mppt14_current?: number
  mppt14_voltage?: number
  mppt15_current?: number
  mppt15_voltage?: number
  mppt16_current?: number
  mppt16_voltage?: number
  // String veriler (1-32)
  string1_current?: number
  string1_voltage?: number
  string2_current?: number
  string2_voltage?: number
  string3_current?: number
  string3_voltage?: number
  string4_current?: number
  string4_voltage?: number
  string5_current?: number
  string5_voltage?: number
  string6_current?: number
  string6_voltage?: number
  string7_current?: number
  string7_voltage?: number
  string8_current?: number
  string8_voltage?: number
  string9_current?: number
  string9_voltage?: number
  string10_current?: number
  string10_voltage?: number
  string11_current?: number
  string11_voltage?: number
  string12_current?: number
  string12_voltage?: number
  string13_current?: number
  string13_voltage?: number
  string14_current?: number
  string14_voltage?: number
  string15_current?: number
  string15_voltage?: number
  string16_current?: number
  string16_voltage?: number
  string17_current?: number
  string17_voltage?: number
  string18_current?: number
  string18_voltage?: number
  string19_current?: number
  string19_voltage?: number
  string20_current?: number
  string20_voltage?: number
  string21_current?: number
  string21_voltage?: number
  string22_current?: number
  string22_voltage?: number
  string23_current?: number
  string23_voltage?: number
  string24_current?: number
  string24_voltage?: number
  string25_current?: number
  string25_voltage?: number
  string26_current?: number
  string26_voltage?: number
  string27_current?: number
  string27_voltage?: number
  string28_current?: number
  string28_voltage?: number
  string29_current?: number
  string29_voltage?: number
  string30_current?: number
  string30_voltage?: number
  string31_current?: number
  string31_voltage?: number
  string32_current?: number
  string32_voltage?: number
}

// FUSION veri yapısı
export interface FusionData {
  sn: string
  status: {
    efficiency_pct: number
    state: string
  }
  power: {
    active_kW: number
    reactive_kvar: number
  }
  energy: {
    daily_kWh: number
    total_kWh: number
  }
  phases: {
    voltages: {
      A: number
      B: number
      C: number
    }
    currents: {
      A: number
      B: number
      C: number
    }
  }
  pvInputs: {
    [key: string]: any // dinamik MPPT yapısı
  }
  mpptCaps: {
    [key: string]: any
  }
}

// Normalize edilmiş inverter verisi
export interface InverterData {
  id: string
  name: string
  systemType: SystemType
  status: string
  activePower: number // kW
  dailyYield: number // kWh
  totalYield: number // kWh
  efficiency?: number // %
  temperature?: number // °C
  // İsteğe bağlı detay alanları
  voltage?: number
  current?: number
  dcPower?: number
  dcTotalPower?: number
  gridFrequency?: number
  mpptData?: any[] // PV String verileri (hem FUSION pvInputs hem SANGROW string verileri)
  pvInputs?: { [key: string]: PVInputData } // FUSION pvInputs object formatı
  phaseData?: PhaseData
  internalTemperature?: number // SANGROW için ek alan
  lastUpdate: Date
}

// PV Input ve MPPT veri tipleri
export interface PVInputData {
  current?: number
  voltage?: number
  I?: number // FUSION alias for current
  V?: number // FUSION alias for voltage
  power?: number
}

export interface MPPTData {
  id: string
  current?: number
  voltage?: number
  power?: number
}

export interface PhaseData {
  voltages?: { A?: number; B?: number; C?: number }
  currents?: { A?: number; B?: number; C?: number }
}

// Günlük üretim verisi
export interface DailyProduction {
  date: string
  totalProduction: number // kWh
  siteId: string
}

// PV String kontrolü
export interface PVStringState {
  inverterId: string
  stringKey: string // "PV1", "PV2", etc.
  isActive: boolean
  modifiedAt: Date
  modifiedBy: string
}

// Dashboard özeti
export interface DashboardSummary {
  currentPower: number // kW
  dailyProduction: number // kWh
  totalProduction: number // kWh
  faultCount: number
  activeInverters: number
  totalInverters: number
}

// Ekip yönetimi tipleri kaldırıldı - sistem sadece admin ile çalışıyor

// Bildirim Sistemi Types
export interface NotificationSettings {
  userId: string;
  assignedSites: string[]; // Kullanıcının atandığı sahalar
  inverterAlerts: {
    enabled: boolean;
    offlineAlert: boolean;
    faultAlert: boolean;
    alarmAlert: boolean;
  };
  pvStringAlerts: {
    enabled: boolean;
    lowPerformanceAlert: boolean;
    faultAlert: boolean;
    offlineAlert: boolean;
    performanceThreshold: number; // %
  };
  temperatureAlerts: {
    enabled: boolean;
    highTempThreshold: number; // °C
    criticalTempThreshold: number; // °C
  };
  notificationMethods: {
    browser: boolean;
    email: boolean;
    sound: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationAlert {
  id: string;
  userId: string;
  siteId: string;
  siteName: string;
  type: 'inverter' | 'pvstring' | 'temperature' | 'system';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  deviceId?: string; // inverter veya string ID
  deviceName?: string;
  value?: number; // sıcaklık değeri, güç değeri vs
  threshold?: number;
  previousValue?: number;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  autoResolved?: boolean;
}

export interface NotificationRule {
  id: string;
  name: string;
  description?: string;
  siteId: string;
  type: 'inverter' | 'pvstring' | 'temperature' | 'system';
  condition: {
    field: string; // 'device_status', 'internal_air_temperature', 'total_active_power' vs
    operator: 'equals' | 'greater_than' | 'less_than' | 'not_equals' | 'between';
    value: any;
    secondValue?: any; // 'between' operatörü için
  };
  enabled: boolean;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  cooldownMinutes: number; // Aynı uyarı için bekleme süresi
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}

// Bildirim geçmişi ve istatistikleri
export interface NotificationStats {
  userId: string;
  totalAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;
  lastWeekAlerts: number;
  mostFrequentType: string;
  averageResponseTime: number; // dakika
}
