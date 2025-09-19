import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { tr } from 'date-fns/locale';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import theme from './theme/theme';
import App from './App';
import './index.css';
// Production-safe logging
import './utils/logger';
import { saveDailyProductionData } from './services/dailyProductionService';

// GLOBAL OTOMATİK KAYIT SİSTEMİ
console.log('🌟 SolarVeyo SCADA başlatılıyor...');

// Otomatik kayıt fonksiyonu
const performGlobalAutoSave = async () => {
  const now = new Date();
  const hour = now.getHours();
  
  // Gece yarısı sonrası (00:00-06:00) otomatik kayıt yapma
  if (hour >= 0 && hour < 6) {
    console.log(`⏸️ [${now.toLocaleTimeString('tr-TR')}] Gece saatleri - otomatik kayıt atlandı`);
    return;
  }
  
  console.log(`🔄 [${now.toLocaleTimeString('tr-TR')}] Global otomatik kayıt başlıyor...`);
  
  try {
    // Türkiye saati ile doğru tarihi hesapla
    const turkeyDate = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const targetDate = turkeyDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    await saveDailyProductionData(undefined, false, targetDate); // Otomatik kayıt
    console.log(`✅ Global otomatik kayıt başarılı! Tarih: ${targetDate}`);
  } catch (error) {
    console.error('❌ Global otomatik kayıt hatası:', error);
  }
};

// İlk kayıt - 5 saniye sonra
setTimeout(() => {
  console.log('🚀 İlk global otomatik kayıt tetikleniyor...');
  performGlobalAutoSave();
}, 5000);

// Sonraki kayıtlar - her 5 dakikada bir
setInterval(() => {
  console.log('⏰ 5 dakikalık global otomatik kayıt tetikleniyor...');
  performGlobalAutoSave();
}, 5 * 60 * 1000);

console.log('⏰ Global otomatik kayıt sistemi aktif!');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={tr}>
        <BrowserRouter future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}>
          <App />
        </BrowserRouter>
      </LocalizationProvider>
      <ToastContainer position="top-right" autoClose={3000} closeOnClick theme="light" />
    </ThemeProvider>
  </React.StrictMode>
);

// Register service worker for PWA
// Service Worker temporarily disabled due to caching issues
// Uncomment below to re-enable when needed
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
*/

// Unregister existing service workers to fix caching issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister();
      // Service Worker unregistered
    });
  });
}

