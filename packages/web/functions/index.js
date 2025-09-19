const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

try {
  admin.initializeApp();
} catch (_) {}

// HTTPS callable: deleteAuthUser
exports.deleteAuthUser = functions.https.onCall(async (data, context) => {
  // Only admins can delete auth users
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Not signed in");
  }
  const db = admin.firestore();
  const uid = context.auth.uid;
  const userDoc = await db.collection("users").doc(uid).get();
  const role = userDoc.exists ? userDoc.data().role : null;
  if (role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Only admin");
  }

  const targetUid = data?.uid;
  if (!targetUid) {
    throw new functions.https.HttpsError("invalid-argument", "uid required");
  }

  try {
    await admin.auth().deleteUser(targetUid);
    return { ok: true };
  } catch (err) {
    throw new functions.https.HttpsError("internal", err.message || "delete failed");
  }
});

// HTTPS request: getUserByEmail with CORS (admin only)
exports.getUserByEmail = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      // Extract authorization token
      const authHeader = req.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      
      // Check if user is admin
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(uid).get();
      const role = userDoc.exists ? userDoc.data().role : null;
      if (role !== "admin") {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const email = req.body?.email || req.query?.email;
      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }
      
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        return res.json({ uid: userRecord.uid });
      } catch (err) {
        if (err.code === "auth/user-not-found") {
          return res.json({ uid: null });
        }
        return res.status(500).json({ error: err.message || 'Lookup failed' });
      }
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
});

// HTTP Callable function: Otomatik veri kayıt (Cloud Scheduler HTTP trigger için)
// ⚡ MANUAL SCHEDULER İLE ÇAĞRILACAK
exports.autoSaveProduction = functions.https.onRequest(async (req, res) => {
  // CORS desteği
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
    const now = new Date();
    const currentTime = now.toLocaleTimeString('tr-TR');
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    
    console.log(`🔄 Firebase Auto-save başlıyor: ${currentTime} (IST: ${istTime.toLocaleTimeString('tr-TR')})`);
    
    // Çift güvenlik: Istanbul saati kontrolü
    const hour = istTime.getHours();
    if (hour < 6 || hour >= 22) {
      console.log(`⏰ Auto-save atlandı - Çalışma saatleri dışında (IST: ${hour}:xx)`);
      return { success: false, reason: 'outside_working_hours', hour };
    }
    
    try {
      const db = admin.firestore();
      
      // Tüm siteleri getir
      const sitesSnapshot = await db.collection('sites').get();
      const sites = sitesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const siteProductionData = [];
      let totalProduction = 0;
      let totalPower = 0;
      let peakPower = 0;
      let activeSites = 0;
      
      // Her site için veri topla (basitleştirilmiş)
      for (const site of sites) {
        for (const source of site.sources || []) {
          try {
            // Site'in inverter verilerini getir (son 50 kayıt)
            const inverterSnapshot = await db.collection(source.collection)
              .orderBy('lastUpdate', 'desc')
              .limit(50)
              .get();
            
            if (!inverterSnapshot.empty) {
              let siteActivePower = 0;
              let siteDailyYield = 0;
              let activeInverters = 0;
              
              inverterSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const power = parseFloat(data.activePower || 0);
                const daily = parseFloat(data.dailyYield || 0);
                
                siteActivePower += power;
                siteDailyYield += daily;
                
                if (power > 0.5) activeInverters++; // 0.5 kW üzeri aktif sayılır
              });
              
              const siteData = {
                siteId: site.id,
                siteName: site.name || 'Bilinmeyen',
                location: site.location || '',
                capacity: (site.capacityMWp || 0).toString(),
                type: source.type === 'SANGROW' ? 'ariza_ges' : 'voyag',
                status: siteActivePower > 0 ? 'active' : 'inactive',
                collectionName: source.collection,
                activeInverters,
                totalProduction: siteDailyYield,
                averagePower: siteActivePower,
                peakPower: siteActivePower,
                efficiency: 85, // Sabit verimlilik
                operatingHours: calculateOperatingHours(),
                dataPoints: inverterSnapshot.docs.length
              };
              
              siteProductionData.push(siteData);
              
              totalProduction += siteDailyYield;
              totalPower += siteActivePower;
              peakPower = Math.max(peakPower, siteActivePower);
              
              if (siteActivePower > 0) activeSites++;
            }
          } catch (siteError) {
            console.error(`Site ${site.name} işlenirken hata:`, siteError);
          }
        }
      }
      
      // Özet hesapla
      const summary = {
        totalSites: sites.length,
        activeSites,
        totalProduction,
        totalPower,
        peakPower,
        averageEfficiency: 85,
        co2Saved: totalProduction * 0.0004,
        equivalentHomes: totalProduction / 30
      };
      
      // Bugünün tarihi
      const today = new Date().toISOString().split('T')[0];
      const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      
      // daily_production koleksiyonuna kaydet
      const docRef = db.collection('daily_production').doc(today);
      const existingDoc = await docRef.get();
      
      if (existingDoc.exists) {
        // Mevcut günü güncelle
        const existingData = existingDoc.data();
        await docRef.update({
          'metadata.updatedAt': admin.firestore.Timestamp.now(),
          'metadata.lastRealtimeUpdate': currentTime,
          'metadata.totalUpdates': (existingData.metadata?.totalUpdates || 0) + 1,
          sites: siteProductionData,
          summary: summary
        });
      } else {
        // Yeni gün oluştur
        await docRef.set({
          date: today,
          metadata: {
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            savedAt: admin.firestore.Timestamp.now(),
            savedMethod: 'auto',
            systemVersion: '1.0',
            dataSource: 'cloud_function_10min',
            autoSaved: true,
            lastRealtimeUpdate: currentTime,
            totalUpdates: 1
          },
          sites: siteProductionData,
          summary: summary
        });
      }
      
      console.log(`✅ Firebase Auto-save tamamlandı: ${currentTime}`);
      console.log(`📊 Güç: ${totalPower.toFixed(1)} kW, Üretim: ${totalProduction.toFixed(1)} kWh, Aktif Site: ${activeSites}/${sites.length}`);
      
      // Başarı bildirimi gönder (opsiyonel)
      try {
        await db.collection('system_logs').add({
          type: 'auto_save_success',
          timestamp: admin.firestore.Timestamp.now(),
          data: {
            totalPower: totalPower.toFixed(1),
            totalProduction: totalProduction.toFixed(1),
            activeSites,
            totalSites: sites.length,
            date: today
          },
          source: 'firebase_function'
        });
      } catch (logError) {
        console.warn('⚠️ Log yazarken hata:', logError);
      }
      
      return { 
        success: true, 
        timestamp: currentTime,
        istTime: istTime.toLocaleTimeString('tr-TR'),
        totalPower: totalPower.toFixed(1),
        totalProduction: totalProduction.toFixed(1),
        activeSites,
        totalSites: sites.length,
        date: today
      };
    } catch (error) {
      console.error('❌ Firebase Auto-save hatası:', error);
      
      // Hata logu kaydet
      try {
        await db.collection('system_logs').add({
          type: 'auto_save_error',
          timestamp: admin.firestore.Timestamp.now(),
          error: error.message,
          source: 'firebase_function'
        });
      } catch (logError) {
        console.warn('⚠️ Error log yazarken hata:', logError);
      }
      
      return { success: false, error: error.message, timestamp: currentTime };
    }
  });

// HTTP Callable function: Günlük kayıt (Cloud Scheduler HTTP trigger için)  
// ⚡ MANUAL SCHEDULER İLE ÇAĞRILACAK
exports.dailyProductionSave = functions.https.onRequest(async (req, res) => {
  // CORS desteği
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const currentTime = istTime.toLocaleTimeString('tr-TR');
    
    console.log(`🌙 Firebase Daily-save başlıyor: ${currentTime} (IST)`);
    
    try {
      const db = admin.firestore();
      
      // AKILLI TARİH SEÇİMİ: 23:30'da bugünün verilerini kaydet
      const targetDate = istTime.toISOString().split('T')[0]; // Bugün (İstanbul saati ile)
      
      console.log(`📅 Hedef tarih: ${targetDate}`);
      
      // Bugünün mevcut verisini kontrol et
      const docRef = db.collection('daily_production').doc(targetDate);
      const existingDoc = await docRef.get();
      
      if (existingDoc.exists) {
        // Mevcut veriyi günlük kayıt olarak işaretle
        const updateData = {
          'metadata.savedMethod': 'daily_auto',
          'metadata.finalSaveAt': admin.firestore.Timestamp.now(),
          'metadata.isDailyComplete': true,
          'metadata.dailyCompleteTime': currentTime,
          'metadata.timezone': 'Europe/Istanbul'
        };
        
        await docRef.update(updateData);
        
        console.log(`✅ Firebase Daily-save tamamlandı: ${targetDate} (${currentTime})`);
        
        // Başarı logu kaydet
        await db.collection('system_logs').add({
          type: 'daily_save_success',
          timestamp: admin.firestore.Timestamp.now(),
          date: targetDate,
          completedAt: currentTime,
          source: 'firebase_daily_function'
        });
        
        return { success: true, date: targetDate, action: 'finalized', time: currentTime };
      } else {
        console.log(`⚠️ ${targetDate} için veri bulunamadı - daily save atlandı`);
        
        // Hata logu kaydet
        await db.collection('system_logs').add({
          type: 'daily_save_no_data',
          timestamp: admin.firestore.Timestamp.now(),
          date: targetDate,
          reason: 'no_existing_data',
          source: 'firebase_daily_function'
        });
        
        return { success: false, date: targetDate, action: 'no_data', reason: 'No data found for target date' };
      }
    } catch (error) {
      console.error('❌ Firebase Daily-save hatası:', error);
      
      // Kritik hata logu kaydet
      try {
        await db.collection('system_logs').add({
          type: 'daily_save_error',
          timestamp: admin.firestore.Timestamp.now(),
          error: error.message,
          source: 'firebase_daily_function'
        });
      } catch (logError) {
        console.warn('⚠️ Error log yazarken hata:', logError);
      }
      
      return { success: false, error: error.message, timestamp: currentTime };
    }
  });

// Yardımcı fonksiyon: çalışma saati hesaplama
function calculateOperatingHours() {
  const now = new Date();
  const currentHour = now.getHours();
  
  if (currentHour >= 6 && currentHour <= 19) {
    return currentHour - 6 + (now.getMinutes() / 60);
  }
  return 0;
}


