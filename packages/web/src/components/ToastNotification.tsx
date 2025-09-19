/**
 * Modern Toast Notification System
 * Alert() yerine kullanılacak
 */

import React, { createContext, useContext, useState, useCallback } from 'react'
import { Snackbar, Alert, AlertTitle, Slide, IconButton } from '@mui/material'
import { Close, CheckCircle, Error, Warning, Info } from '@mui/icons-material'
import { TransitionProps } from '@mui/material/transitions'

export type ToastSeverity = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  title?: string
  message: string
  severity: ToastSeverity
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  showToast: (message: string, severity?: ToastSeverity, title?: string, duration?: number) => void
  showSuccess: (message: string, title?: string) => void
  showError: (message: string, title?: string) => void
  showWarning: (message: string, title?: string) => void
  showInfo: (message: string, title?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

function SlideTransition(props: TransitionProps & { children: React.ReactElement }) {
  return <Slide {...props} direction="up" />
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [currentToast, setCurrentToast] = useState<ToastMessage | null>(null)

  const showToast = useCallback((
    message: string,
    severity: ToastSeverity = 'info',
    title?: string,
    duration: number = 4000
  ) => {
    const newToast: ToastMessage = {
      id: `${Date.now()}_${Math.random()}`,
      message,
      severity,
      title,
      duration
    }

    setToasts(prev => [...prev, newToast])
    
    // İlk toast'ı göster
    if (!currentToast) {
      setCurrentToast(newToast)
    }
  }, [currentToast])

  const showSuccess = useCallback((message: string, title?: string) => {
    showToast(message, 'success', title || 'Başarılı', 3000)
  }, [showToast])

  const showError = useCallback((message: string, title?: string) => {
    showToast(message, 'error', title || 'Hata', 5000)
  }, [showToast])

  const showWarning = useCallback((message: string, title?: string) => {
    showToast(message, 'warning', title || 'Uyarı', 4000)
  }, [showToast])

  const showInfo = useCallback((message: string, title?: string) => {
    showToast(message, 'info', title, 4000)
  }, [showToast])

  const handleClose = () => {
    setCurrentToast(null)
    
    // Sıradaki toast'ı göster
    setTimeout(() => {
      setToasts(prev => {
        const remaining = prev.filter(t => t.id !== currentToast?.id)
        if (remaining.length > 0) {
          setCurrentToast(remaining[0])
        }
        return remaining
      })
    }, 200)
  }

  const getIcon = (severity: ToastSeverity) => {
    switch (severity) {
      case 'success':
        return <CheckCircle />
      case 'error':
        return <Error />
      case 'warning':
        return <Warning />
      case 'info':
        return <Info />
    }
  }

  const getBackgroundColor = (severity: ToastSeverity) => {
    switch (severity) {
      case 'success':
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      case 'error':
        return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
      case 'warning':
        return 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
      case 'info':
        return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    }
  }

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
      {children}
      {currentToast && (
        <Snackbar
          open={!!currentToast}
          autoHideDuration={currentToast.duration}
          onClose={handleClose}
          TransitionComponent={SlideTransition}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{
            '& .MuiSnackbarContent-root': {
              padding: 0,
              minWidth: 350,
              backgroundColor: 'transparent'
            }
          }}
        >
          <Alert
            severity={currentToast.severity}
            onClose={handleClose}
            icon={getIcon(currentToast.severity)}
            action={
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={handleClose}
              >
                <Close fontSize="small" />
              </IconButton>
            }
            sx={{
              width: '100%',
              background: getBackgroundColor(currentToast.severity),
              color: 'white',
              '& .MuiAlert-icon': {
                color: 'white'
              },
              '& .MuiAlert-message': {
                width: '100%'
              },
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              borderRadius: 2,
              animation: 'slideIn 0.3s ease-out',
              '@keyframes slideIn': {
                from: {
                  transform: 'translateX(100%)',
                  opacity: 0
                },
                to: {
                  transform: 'translateX(0)',
                  opacity: 1
                }
              }
            }}
          >
            {currentToast.title && (
              <AlertTitle sx={{ fontWeight: 600 }}>
                {currentToast.title}
              </AlertTitle>
            )}
            {currentToast.message}
            {currentToast.action && (
              <button
                onClick={currentToast.action.onClick}
                style={{
                  marginTop: 8,
                  padding: '4px 12px',
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 4,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                {currentToast.action.label}
              </button>
            )}
          </Alert>
        </Snackbar>
      )}
      
      {/* Toast sayacı */}
      {toasts.length > 1 && (
        <div
          style={{
            position: 'fixed',
            bottom: 100,
            right: 20,
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 12,
            fontSize: 12,
            zIndex: 9999
          }}
        >
          +{toasts.length - 1} bekleyen bildirim
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    // @ts-ignore - TypeScript false positive
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

// Global toast helper (alert() yerine)
let globalToast: ToastContextType | null = null

export function setGlobalToast(toast: ToastContextType) {
  globalToast = toast
}

export function toast(message: string, severity?: ToastSeverity, title?: string) {
  if (globalToast) {
    globalToast.showToast(message, severity, title)
  } else {
    // Fallback to console
    console.log(`[TOAST ${severity || 'info'}] ${title || ''}: ${message}`)
  }
}
