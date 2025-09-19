import { collection, getDocs, query, limit, onSnapshot, doc, getDoc, setDoc, deleteDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { SangrowData, FusionData, InverterData, SystemType, PVStringState } from '@/types'

// Site isimlerini hiyerarşik sıralamak için utility function
export function parseAndCompareSiteNames(a: string, b: string): number {
  // "Voyag 1", "Voyag 10.2", "Centurion" gibi isimleri parse et
  const parseNameParts = (name: string) => {
    // "Voyag 10.2" -> ["Voyag", "10.2"]
    const match = name.match(/^(\D*)(\d+(?:\.\d+)?)?\s*(.*)$/)
    if (match) {
      const prefix = match[1].trim() // "Voyag"
      const number = match[2] ? parseFloat(match[2]) : 0 // 10.2
      const suffix = match[3].trim() // boş veya ek metin
      return { prefix, number, suffix, original: name }
    }
    return { prefix: name, number: 0, suffix: '', original: name }
  }

  const aParts = parseNameParts(a)
  const bParts = parseNameParts(b)

  // Önce prefix'e göre sırala (Centurion, Voyag vs.)
  const prefixCompare = aParts.prefix.localeCompare(bParts.prefix, 'tr')
  if (prefixCompare !== 0) return prefixCompare

  // Aynı prefix'te sayıya göre sırala
  const numberCompare = aParts.number - bParts.number
  if (numberCompare !== 0) return numberCompare

  // Son olarak suffix'e göre sırala
  return aParts.suffix.localeCompare(bParts.suffix, 'tr')
}

// Firestore koleksiyonlarını listele
export async function getFirestoreCollections(): Promise<string[]> {
  try {
    // Firebase Admin SDK olmadan collection listesi alamayız
    // Bu yüzden bilinen koleksiyonları test ederiz ve manuel giriş sağlarız
    
    // Yaygın koleksiyon isimlerini test et
    const commonCollections = [
      // SCADA/İnverter koleksiyonları
      'voyag_11_arazi_ges_Inverters',
      'sangrow_data',
      'fusion_data',
      'inverters',
      'daily_production',
      // Yaygın Türkçe isimler
      'santral_verileri',
      'inverter_verileri',
      'gunes_enerjisi',
      'scada_data',
      // Voyag serileri
      'voyag_data',
      'voyag_inverters',
      'voyag_1_data',
      'voyag_2_data',
      'voyag_3_data',
      'voyag_4_data',
      'voyag_5_data',
      'voyag_6_data',
      'voyag_7_data',
      'voyag_8_data',
      'voyag_9_data',
      'voyag_10_data',
      'voyag_11_data',
      'voyag_12_data',
      // Arazi GES serileri
      'arazi_ges_data',
      'arazi_ges_inverters',
      'arazi_1_ges',
      'arazi_2_ges',
      'arazi_3_ges',
      // Sangrow yaygın isimler
      'sangrow_inverters',
      'sangrow_plant_data',
      'sg_inverters',
      // Fusion yaygın isimler
      'fusion_inverters',
      'fusion_plant_data',
      'huawei_inverters',
      // Test koleksiyonları
      'test_data',
      'demo_data'
    ]
    
    const existingCollections: string[] = []
    
    // Her koleksiyonu paralel olarak test et
    const testPromises = commonCollections.map(async (collectionName) => {
      try {
        const testQuery = query(collection(db, collectionName), limit(1))
        const snapshot = await getDocs(testQuery)
        // Koleksiyon varsa (boş olsa bile) listeye ekle
        return collectionName
      } catch (error) {
        // Koleksiyon yoksa null döndür
        return null
      }
    })
    
    const results = await Promise.all(testPromises)
    
    // Null olmayan sonuçları filtrele
    results.forEach((collectionName, index) => {
      if (collectionName) {
        existingCollections.push(collectionName)
      }
    })
    
    console.log('Found collections:', existingCollections)
    return existingCollections
  } catch (error) {
    console.error('Error listing collections:', error)
    return []
  }
}

// Kullanıcı girişiyle eşleşen koleksiyonları ara
export async function searchCollections(searchTerm: string): Promise<string[]> {
  try {
    if (!searchTerm || searchTerm.length < 2) {
      return []
    }

    // Önce bilinen koleksiyonları al
    const allCollections = await getFirestoreCollections()
    
    // Arama terimini normalize et (küçük harf, Türkçe karakterler)
    const normalizedSearch = searchTerm.toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
    
    // Eşleşen koleksiyonları filtrele
    const matchingCollections = allCollections.filter(collection => {
      const normalizedCollection = collection.toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
      
      return normalizedCollection.includes(normalizedSearch)
    })

    // Kullanıcının yazdığı tam ismi de test et (eğer listede yoksa)
    const exactMatch = searchTerm.trim()
    if (exactMatch && !allCollections.includes(exactMatch)) {
      try {
        const testQuery = query(collection(db, exactMatch), limit(1))
        const snapshot = await getDocs(testQuery)
        // Koleksiyon varsa listeye ekle
        if (!snapshot.empty || snapshot.docs.length >= 0) {
          matchingCollections.unshift(exactMatch) // En başa ekle
        }
      } catch (error) {
        // Koleksiyon yoksa hiçbir şey yapma
        console.log(`Collection '${exactMatch}' does not exist`)
      }
    }

    return [...new Set(matchingCollections)] // Duplikatları kaldır
  } catch (error) {
    console.error('Error searching collections:', error)
    return []
  }
}

// Manuel koleksiyon test et
export async function testCollection(collectionName: string): Promise<{ exists: boolean; type: SystemType | null; sampleData?: any }> {
  try {
    const testQuery = query(collection(db, collectionName), limit(1))
    const snapshot = await getDocs(testQuery)
    
    if (snapshot.empty) {
      return { exists: false, type: null }
    }
    
    const sampleDoc = snapshot.docs[0].data()
    const type = detectTypeFromData(sampleDoc)
    
    return { exists: true, type, sampleData: sampleDoc }
  } catch (error) {
    console.error('Error testing collection:', error)
    return { exists: false, type: null }
  }
}

// Veri yapısından tip tespit et
function detectTypeFromData(data: any): SystemType | null {
  // SANGROW tespiti: device_sn, total_active_power vb. alanlar
  if (data.device_sn || data.device_name || data.total_active_power || data.yield_today || data.grid_frequency) {
    return 'SANGROW'
  }
  
  // FUSION tespiti: sn, power.active_kW, status.efficiency_pct vb. alanlar
  if (data.sn || data.power?.active_kW || data.status?.efficiency_pct || data.energy?.daily_kWh) {
    return 'FUSION'
  }
  
  // Yeni FUSION yapısı tespiti (sizin veriniz):
  // devId, devName, energy.daily_kWh, power.active_kW, phases, pvInputs, mpptCaps
  if (data.devId || data.devName || data.energy?.daily_kWh || data.power?.active_kW || 
      data.phases?.voltages || data.pvInputs || data.mpptCaps) {
    return 'FUSION'
  }
  
  // data map'i içindeki FUSION yapısı (sizin gerçek yapınız)
  if (data.data?.devId || data.data?.devName || data.data?.energy?.daily_kWh || 
      data.data?.power?.active_kW || data.data?.phases?.voltages) {
    return 'FUSION'
  }
  
  // Diğer yaygın SANGROW alanları
  if (data.device_status || data.string1_voltage || data.mppt1_voltage) {
    return 'SANGROW'
  }
  
  return null
}

// Koleksiyondaki veri tipini otomatik tespit et
export async function detectCollectionType(collectionName: string): Promise<SystemType | null> {
  try {
    const result = await testCollection(collectionName)
    return result.type
  } catch (error) {
    console.error('Error detecting collection type:', error)
    return null
  }
}

// Sangrow device_status kodlarını string'e çevir
function convertSangrowStatus(deviceStatus: number, faultStatus: number = 0, activePower: number = 0): string {
  // device_status: 1=Normal, 2=Fault, 3=Standby, 4=Alarm, 0=Offline
  // device_fault_status: 0=No fault, >0=Fault codes
  
  if (deviceStatus === 0) return 'Offline'
  if (deviceStatus === 1 && faultStatus === 0) return 'Normal'
  
  // Eğer device_status=1 ve güç üretimi varsa, fault_status'a rağmen "Normal" göster
  if (deviceStatus === 1 && activePower > 0) return 'Normal'
  
  // Gerçek arıza durumları
  if (deviceStatus === 2) return 'Fault'
  if (deviceStatus === 3) return 'Standby'
  if (deviceStatus === 4) return 'Alarm'
  
  // Sadece fault_status varsa ve güç üretimi yoksa Warning
  if (faultStatus > 0 && activePower === 0) return 'Warning'
  if (faultStatus > 0 && activePower > 0) return 'Normal' // Çalışıyor ama uyarı var
  
  return 'Unknown'
}

// SANGROW verisini normalize et
export function normalizeSangrowData(data: SangrowData, docId: string): InverterData {
  // PV String verilerini (sadece aktif string veriler)
  const pvStringData: Array<[string, any]> = []
  
  // String verilerini PV formatında ekle (string1-32 → PV1-32) - TÜM stringleri ekle
  for (let i = 1; i <= 32; i++) {
    const currentKey = `string${i}_current`
    const voltageKey = `string${i}_voltage`
    const current = data[currentKey as keyof SangrowData] as number
    const voltage = data[voltageKey as keyof SangrowData] as number
    
    // Tüm stringleri ekle - hem aktif hem pasif olanları
    if (current !== undefined || voltage !== undefined) {
      pvStringData.push([`PV${i}`, { 
        current: current || 0, 
        voltage: voltage || 0,
        power: ((current || 0) * (voltage || 0)) / 1000 // kW hesaplama
      }])
    }
  }

  // Phase data'yı inverter çıkış akım/gerilimlerinden oluştur
  const phaseData = {
    currents: {
      A: data.inverter_output_current_r || 0,
      B: data.inverter_output_current_s || 0,
      C: data.inverter_output_current_t || 0
    },
    voltages: {
      A: data.inverter_output_voltage_r || 0,
      B: data.inverter_output_voltage_s || 0,
      C: data.inverter_output_voltage_t || 0
    }
  }

  const activePowerKW = (data.total_active_power || 0) / 1000 // W to kW

  return {
    id: docId,
    name: data.device_name || data.device_sn || docId,
    systemType: 'SANGROW',
    status: convertSangrowStatus(data.device_status || 0, data.device_fault_status || 0, activePowerKW),
    activePower: activePowerKW,
    dailyYield: (data.yield_today || 0) / 1000, // Wh to kWh
    totalYield: (data.total_yield || 0) / 1000, // Wh to kWh
    efficiency: undefined,
    dcPower: (data.total_dc_power || 0) / 1000, // W to kW
    gridFrequency: data.grid_frequency || undefined,
    temperature: data.internal_air_temperature || undefined,
    phaseData: phaseData,
    mpptData: pvStringData.length > 0 ? pvStringData as any[] : undefined,
    // SANGROW için pvInputs alanını da ekle (uyumluluk için)
    pvInputs: pvStringData.length > 0 ? Object.fromEntries(pvStringData) : undefined,
    lastUpdate: data.updated_at?.toDate ? data.updated_at.toDate() : new Date()
  }
}

// FUSION verisini normalize et (sizin veri yapınız için güncellenmiş)
export function normalizeFusionData(rawData: any, docId: string): InverterData {
  // Eğer veri 'data' map'i içindeyse onu kullan (sizin gerçek yapınız)
  const data = rawData.data || rawData
  
  // Eski FUSION yapısı (sn alanı varsa)
  if (data.sn && !data.devId) {
    // DC toplam gücü: öncelik power.mppt_kW, yoksa pvInputs üzerinden hesapla
    const pvEntries: Array<[string, any]> = data.pvInputs ? Object.entries(data.pvInputs) : []
    const dcTotalFromPv = pvEntries.reduce((sum, [, pv]) => {
      const I = pv?.current !== undefined ? pv.current : pv?.I
      const V = pv?.voltage !== undefined ? pv.voltage : pv?.V
      const P = pv?.power
      if (typeof P === 'number') {
        return sum + P
      }
      if (typeof I === 'number' && typeof V === 'number') {
        return sum + (I * V) / 1000 // kW
      }
      return sum
    }, 0)
    const dcTotalPowerKW = typeof data.power?.mppt_kW === 'number' ? data.power.mppt_kW : dcTotalFromPv
    const gridFreq = (data.status?.frequency_Hz as number | undefined) 
      ?? (data.gridFrequency as number | undefined) 
      ?? (data.frequency as number | undefined) 
      ?? (data.grid?.frequency as number | undefined) 
      ?? (data.phases?.frequency as number | undefined)

    return {
      id: docId,
      name: data.sn || docId,
      systemType: 'FUSION',
      status: data.status?.state || 'unknown',
      activePower: data.power?.active_kW || 0,
      dailyYield: data.energy?.daily_kWh || 0,
      totalYield: data.energy?.total_kWh || 0,
      efficiency: data.status?.efficiency_pct || undefined,
      dcTotalPower: dcTotalPowerKW || undefined,
      gridFrequency: gridFreq,
      phaseData: data.phases || undefined,
      pvInputs: data.pvInputs || undefined,
      mpptData: data.pvInputs ? Object.entries(data.pvInputs) as any[] : undefined,
      lastUpdate: new Date()
    }
  }
  
  // Yeni FUSION yapısı (sizin gerçek veriniz - devId/devName ile)
  // DC toplam gücü: öncelik power.mppt_kW, yoksa pvInputs üzerinden hesapla
  const pvEntries: Array<[string, any]> = data.pvInputs ? Object.entries(data.pvInputs) : []
  const dcTotalFromPv = pvEntries.reduce((sum, [, pv]) => {
    const I = pv?.current !== undefined ? pv.current : pv?.I
    const V = pv?.voltage !== undefined ? pv.voltage : pv?.V
    const P = pv?.power
    if (typeof P === 'number') {
      return sum + P
    }
    if (typeof I === 'number' && typeof V === 'number') {
      return sum + (I * V) / 1000 // kW
    }
    return sum
  }, 0)
  const dcTotalPowerKW = typeof data.power?.mppt_kW === 'number' ? data.power.mppt_kW : dcTotalFromPv
  const gridFreq = (data.status?.frequency_Hz as number | undefined) 
    ?? (data.gridFrequency as number | undefined) 
    ?? (data.frequency as number | undefined) 
    ?? (data.grid?.frequency as number | undefined) 
    ?? (data.phases?.frequency as number | undefined)

  return {
    id: docId,
    name: data.devName || data.sn || docId,
    systemType: 'FUSION',
    status: data.status?.runState === 1 ? 'Normal' : 'Offline',
    activePower: data.power?.active_kW || 0,
    dailyYield: data.energy?.daily_kWh || 0,
    totalYield: data.energy?.total_kWh || 0,
    efficiency: data.status?.efficiency_pct || undefined,
    temperature: data.status?.temperature_C || undefined,
    dcTotalPower: dcTotalPowerKW || undefined,
    gridFrequency: gridFreq,
    phaseData: data.phases || undefined,
    // Tüm PV string verilerini al (pvInputs - hem aktif hem pasif)
    pvInputs: data.pvInputs || undefined,
    mpptData: data.pvInputs ? Object.entries(data.pvInputs) as any[] : undefined,
    lastUpdate: data.lastUpdate?.toDate ? data.lastUpdate.toDate() : 
                rawData.lastUpdate?.toDate ? rawData.lastUpdate.toDate() : new Date()
  }
}

// Koleksiyondaki tüm verileri normalize et
export function normalizeCollectionData(
  docs: any[],
  systemType: SystemType
): InverterData[] {
  return docs.map(doc => {
    const data = doc.data()
    const docId = doc.id
    
    switch (systemType) {
      case 'SANGROW':
        return normalizeSangrowData(data as SangrowData, docId)
      case 'FUSION':
        return normalizeFusionData(data as FusionData, docId)
      default:
        throw new Error(`Unsupported system type: ${systemType}`)
    }
  })
}

// Real-time veri dinleme
export function subscribeToCollection(
  collectionName: string,
  systemType: SystemType,
  callback: (data: InverterData[]) => void
) {
  const unsubscribe = onSnapshot(
    collection(db, collectionName),
    (snapshot) => {
      const normalizedData = normalizeCollectionData(snapshot.docs, systemType)
      callback(normalizedData)
    },
    (error) => {
      console.error('Error in collection subscription:', error)
    }
  )
  
  return unsubscribe
}

// Gece/boşta (site bağımsız) tespiti
// Kriterler:
// - Status: Offline/Standby
// - veya Güç: activePower < 0.5 kW ve stringlerin %70+ düşük sinyalde (I <=0.2A veya V <=50V)
export function isNightOrIdle(inverter: InverterData): boolean {
  const statusText = (inverter.status || '').toString().toLowerCase()
  const byStatus = statusText.includes('offline') || statusText.includes('standby')
  const byPower = (inverter.activePower || 0) < 0.5

  // PV string verilerini topla (varsa)
  const entries: Array<[string, any]> = inverter.pvInputs
    ? Object.entries(inverter.pvInputs)
    : (Array.isArray(inverter.mpptData) ? inverter.mpptData : [])

  if (entries.length === 0) {
    // PV detay yoksa status/güç ile karar ver
    return byStatus || byPower
  }

  let lowCount = 0
  let totalVisible = 0
  for (const [_, pv] of entries) {
    const current = pv?.current !== undefined ? pv.current : (pv?.I !== undefined ? pv.I : undefined)
    const voltage = pv?.voltage !== undefined ? pv.voltage : (pv?.V !== undefined ? pv.V : undefined)
    if (current !== undefined || voltage !== undefined) {
      totalVisible++
      const I = typeof current === 'number' ? current : 0
      const V = typeof voltage === 'number' ? voltage : 0
      if (I <= 0.2 || V <= 50) lowCount++
    }
  }
  const lowRatio = totalVisible > 0 ? lowCount / totalVisible : 1
  return byStatus || (byPower && lowRatio >= 0.7)
}

// PV String kontrol fonksiyonları
export async function setPVStringState(
  inverterId: string, 
  stringKey: string, 
  isActive: boolean, 
  userId: string
): Promise<void> {
  const stateId = `${inverterId}_${stringKey}`
  const stateRef = doc(db, 'pv_string_states', stateId)
  
  const pvState: PVStringState = {
    inverterId,
    stringKey,
    isActive,
    modifiedAt: new Date(),
    modifiedBy: userId
  }
  
  if (isActive) {
    // Aktif yapmak için state'i sil (default aktif)
    await deleteDoc(stateRef)
  } else {
    // Pasif yapmak için state'i kaydet
    await setDoc(stateRef, pvState)
  }
}

export async function getPVStringStates(inverterId: string): Promise<Map<string, boolean>> {
  const statesQuery = query(
    collection(db, 'pv_string_states'),
    where('inverterId', '==', inverterId)
  )
  
  const snapshot = await getDocs(statesQuery)
  const states = new Map<string, boolean>()
  
  snapshot.docs.forEach(doc => {
    const data = doc.data() as PVStringState
    states.set(data.stringKey, data.isActive)
  })
  
  return states
}

export function subscribeToPVStringStates(
  inverterId: string,
  callback: (states: Map<string, boolean>) => void
): () => void {
  const statesQuery = query(
    collection(db, 'pv_string_states'),
    where('inverterId', '==', inverterId)
  )
  
  const unsubscribe = onSnapshot(statesQuery, (snapshot) => {
    const states = new Map<string, boolean>()
    
    snapshot.docs.forEach(doc => {
      const data = doc.data() as PVStringState
      states.set(data.stringKey, data.isActive)
    })
    
    callback(states)
  })
  
  return unsubscribe
}
