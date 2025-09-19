/**
 * Global Error Handler
 * Merkezi hata yönetimi ve kullanıcı bildirimleri
 */

import { logger } from './productionLogger'

export interface AppError {
  code: string
  message: string
  details?: any
  timestamp: Date
  retryable: boolean
}

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical'

export class ErrorHandler {
  private static instance: ErrorHandler
  private errorCallbacks: Set<(error: AppError, severity: ErrorSeverity) => void> = new Set()
  private retryAttempts: Map<string, number> = new Map()
  private maxRetries = 3

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  /**
   * Error listener ekle
   */
  onError(callback: (error: AppError, severity: ErrorSeverity) => void): () => void {
    this.errorCallbacks.add(callback)
    return () => {
      this.errorCallbacks.delete(callback)
    }
  }

  /**
   * Firebase hatalarını handle et
   */
  handleFirebaseError(error: any): AppError {
    const appError: AppError = {
      code: error.code || 'FIREBASE_ERROR',
      message: this.getFirebaseErrorMessage(error.code),
      details: error,
      timestamp: new Date(),
      retryable: this.isRetryableError(error.code)
    }

    const severity = this.getErrorSeverity(error.code)
    this.notifyError(appError, severity)
    
    return appError
  }

  /**
   * Network hatalarını handle et
   */
  handleNetworkError(error: any): AppError {
    const isOffline = !navigator.onLine
    
    const appError: AppError = {
      code: isOffline ? 'OFFLINE' : 'NETWORK_ERROR',
      message: isOffline 
        ? 'İnternet bağlantınızı kontrol edin' 
        : 'Bağlantı hatası oluştu',
      details: error,
      timestamp: new Date(),
      retryable: true
    }

    this.notifyError(appError, isOffline ? 'warning' : 'error')
    return appError
  }

  /**
   * Genel hataları handle et
   */
  handleError(error: any, context?: string): AppError {
    logger.error(`Error in ${context || 'unknown context'}:`, error)

    const appError: AppError = {
      code: error.code || 'GENERAL_ERROR',
      message: error.message || 'Beklenmeyen bir hata oluştu',
      details: { error, context },
      timestamp: new Date(),
      retryable: false
    }

    this.notifyError(appError, 'error')
    return appError
  }

  /**
   * Retry mekanizması
   */
  async retry<T>(
    operation: () => Promise<T>,
    context: string,
    customRetries?: number
  ): Promise<T> {
    const maxAttempts = customRetries || this.maxRetries
    const attempts = this.retryAttempts.get(context) || 0

    try {
      const result = await operation()
      this.retryAttempts.delete(context)
      return result
    } catch (error: any) {
      if (attempts < maxAttempts - 1 && this.isRetryableError(error.code)) {
        this.retryAttempts.set(context, attempts + 1)
        
        // Exponential backoff
        const delay = Math.pow(2, attempts) * 1000
        logger.info(`Retrying ${context} after ${delay}ms (attempt ${attempts + 1}/${maxAttempts})`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.retry(operation, context, customRetries)
      } else {
        this.retryAttempts.delete(context)
        throw error
      }
    }
  }

  /**
   * Firebase hata mesajlarını Türkçeleştir
   */
  private getFirebaseErrorMessage(code: string): string {
    const messages: Record<string, string> = {
      'auth/user-not-found': 'Kullanıcı bulunamadı',
      'auth/wrong-password': 'Hatalı şifre',
      'auth/invalid-email': 'Geçersiz e-posta adresi',
      'auth/user-disabled': 'Kullanıcı hesabı devre dışı',
      'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanımda',
      'auth/weak-password': 'Şifre çok zayıf',
      'auth/network-request-failed': 'Ağ bağlantısı hatası',
      'permission-denied': 'Bu işlem için yetkiniz yok',
      'unavailable': 'Servis geçici olarak kullanılamıyor',
      'deadline-exceeded': 'İşlem zaman aşımına uğradı',
      'not-found': 'Kayıt bulunamadı',
      'already-exists': 'Bu kayıt zaten mevcut',
      'resource-exhausted': 'Kaynak limiti aşıldı',
      'cancelled': 'İşlem iptal edildi',
      'data-loss': 'Veri kaybı oluştu',
      'unknown': 'Bilinmeyen hata',
      'internal': 'Sunucu hatası',
      'invalid-argument': 'Geçersiz parametre',
      'failed-precondition': 'Ön koşul sağlanamadı',
      'aborted': 'İşlem durduruldu',
      'out-of-range': 'Değer aralık dışında',
      'unimplemented': 'Bu özellik henüz mevcut değil'
    }

    return messages[code] || 'Bir hata oluştu'
  }

  /**
   * Retry yapılabilir hata mı?
   */
  private isRetryableError(code: string): boolean {
    const retryableCodes = [
      'unavailable',
      'deadline-exceeded',
      'resource-exhausted',
      'aborted',
      'internal',
      'auth/network-request-failed',
      'NETWORK_ERROR',
      'OFFLINE'
    ]
    return retryableCodes.includes(code)
  }

  /**
   * Hata önem derecesi
   */
  private getErrorSeverity(code: string): ErrorSeverity {
    const criticalCodes = ['data-loss', 'internal']
    const warningCodes = ['resource-exhausted', 'deadline-exceeded', 'OFFLINE']
    const infoCodes = ['cancelled', 'already-exists']

    if (criticalCodes.includes(code)) return 'critical'
    if (warningCodes.includes(code)) return 'warning'
    if (infoCodes.includes(code)) return 'info'
    return 'error'
  }

  /**
   * Error callback'lerini çağır
   */
  private notifyError(error: AppError, severity: ErrorSeverity): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error, severity)
      } catch (e) {
        logger.error('Error in error callback:', e)
      }
    })
  }
}

export const errorHandler = ErrorHandler.getInstance()

// Global error yakalayıcı
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled Promise Rejection:', event.reason)
    errorHandler.handleError(event.reason, 'unhandledrejection')
  })

  window.addEventListener('error', (event) => {
    logger.error('Global Error:', event.error)
    errorHandler.handleError(event.error, 'window.onerror')
  })
}
