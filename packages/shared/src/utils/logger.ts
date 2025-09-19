// Production-safe logger utility
const isDevelopment = import.meta.env.DEV

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },
  
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args)
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args)
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args)
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args)
    }
  }
}

// Production'da console metodlarını devre dışı bırak
if (!isDevelopment) {
  console.log = () => {}
  console.warn = () => {}
  console.info = () => {}
  console.debug = () => {}
  // console.error'ı bırak - kritik hatalar için
}
