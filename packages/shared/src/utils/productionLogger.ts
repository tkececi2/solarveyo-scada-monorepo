/**
 * Production-safe logger utility
 * Development'ta console.log, production'da sessiz
 */

const isDevelopment = import.meta.env.DEV
const isDebugEnabled = import.meta.env.VITE_DEBUG === 'true'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private shouldLog(level: LogLevel): boolean {
    // Production'da sadece error ve warn logları
    if (!isDevelopment) {
      return level === 'error' || level === 'warn'
    }
    // Development'ta her şey
    return true
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.shouldLog(level)) return

    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`

    switch (level) {
      case 'debug':
        if (isDebugEnabled) console.log(`🔍 ${prefix}`, message, ...args)
        break
      case 'info':
        console.info(`ℹ️ ${prefix}`, message, ...args)
        break
      case 'warn':
        console.warn(`⚠️ ${prefix}`, message, ...args)
        break
      case 'error':
        console.error(`❌ ${prefix}`, message, ...args)
        // Production'da hataları bir servise gönderebiliriz
        if (!isDevelopment) {
          this.sendToErrorService(message, args)
        }
        break
    }
  }

  private sendToErrorService(message: string, args: any[]): void {
    // TODO: Sentry, LogRocket veya custom error service entegrasyonu
    // Şimdilik localStorage'a yazalım
    try {
      const errors = JSON.parse(localStorage.getItem('app_errors') || '[]')
      errors.push({
        message,
        args: args.map(arg => {
          // Hassas verileri filtrele
          if (typeof arg === 'object' && arg !== null) {
            const filtered = { ...arg }
            // Password, token gibi alanları kaldır
            delete filtered.password
            delete filtered.token
            delete filtered.apiKey
            delete filtered.secret
            return filtered
          }
          return arg
        }),
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      })
      // Son 50 hatayı tut
      if (errors.length > 50) {
        errors.shift()
      }
      localStorage.setItem('app_errors', JSON.stringify(errors))
    } catch (e) {
      // localStorage hatası durumunda sessizce devam et
    }
  }

  debug(message: string, ...args: any[]): void {
    this.formatMessage('debug', message, ...args)
  }

  info(message: string, ...args: any[]): void {
    this.formatMessage('info', message, ...args)
  }

  warn(message: string, ...args: any[]): void {
    this.formatMessage('warn', message, ...args)
  }

  error(message: string, ...args: any[]): void {
    this.formatMessage('error', message, ...args)
  }

  // Grup loglama
  group(label: string): void {
    if (isDevelopment) console.group(label)
  }

  groupEnd(): void {
    if (isDevelopment) console.groupEnd()
  }

  // Tablo loglama
  table(data: any): void {
    if (isDevelopment) console.table(data)
  }

  // Performance loglama
  time(label: string): void {
    if (isDevelopment) console.time(label)
  }

  timeEnd(label: string): void {
    if (isDevelopment) console.timeEnd(label)
  }
}

export const logger = new Logger()

// Eski console.log'ları yakalamak için (migration kolaylığı)
if (!isDevelopment) {
  // Production'da console metodlarını override et
  const noop = () => {}
  console.log = noop
  console.debug = noop
  console.info = noop
  // warn ve error'u bırak
}
