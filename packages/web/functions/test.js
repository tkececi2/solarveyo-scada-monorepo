const functions = require("firebase-functions");
const admin = require("firebase-admin");

try {
  admin.initializeApp();
} catch (_) {}

// Basit test function - HTTP trigger
exports.testAutoSave = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  console.log('🧪 Test Auto-save çalışıyor!');
  
  try {
    const db = admin.firestore();
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const currentTime = istTime.toLocaleTimeString('tr-TR');
    
    // Test verisi kaydet
    await db.collection('system_logs').add({
      type: 'test_auto_save',
      timestamp: admin.firestore.Timestamp.now(),
      message: 'Test auto-save çalışıyor!',
      time: currentTime,
      source: 'test_function'
    });
    
    console.log('✅ Test başarılı:', currentTime);
    
    res.json({
      success: true,
      message: 'Test auto-save başarılı!',
      time: currentTime,
      timestamp: now.toISOString()
    });
    
  } catch (error) {
    console.error('❌ Test hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
