'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { startDailyProductionScheduler, startAutoSaveScheduler } from '@/services/dailyProductionService'
import { Menu, X, Plus, LogOut, User, BarChart3, Building2, Settings, TrendingUp, Users, Bell } from 'lucide-react'
import SolarVeyoLogo from './SolarVeyoLogo'
import NotificationCenter from './NotificationCenter'
import { Link, useLocation } from 'react-router-dom'

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Santrallar', href: '/sites', icon: Building2 },
  { name: 'Raporlar', href: '/reports', icon: TrendingUp },
  { name: 'Tahminler', href: '/estimates', icon: TrendingUp },
  { name: 'Ekip', href: '/team', icon: Users },
  { name: 'Santral Ekle', href: '/add-site', icon: Plus },
  { name: '🔔 Bildirimler', href: '/notifications', icon: Bell },
  { name: 'Ayarlar', href: '/settings', icon: Settings },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout, isAdmin, isManager } = useAuth()
  const location = useLocation()
  const pathname = location.pathname

  // Role-based navigation filtering
  const getFilteredNavigation = () => {
    const filtered = navigation.filter(item => {
      // Dashboard, Sites, Reports - herkese açık
      if (['/', '/sites', '/reports'].includes(item.href)) {
        return true
      }
      
      // Team sayfası - sadece admin'e açık (izleyici görmemeli)
      if (item.href === '/team') {
        return isAdmin
      }
      
      // Site ekleme - manager ve admin'e açık
      if (item.href === '/add-site') {
        return isManager
      }
      
      // Notifications - SADECE ADMIN/MANAGER ERİŞEBİLİR
      if (item.href === '/notifications') {
        console.log('Checking notifications access:', { isManager, isAdmin, userRole: user?.role });
        return isManager; // Sadece manager/admin
      }
      
      // Settings - admin'e açık
      if (item.href === '/settings') {
        return isAdmin
      }
      
      return true
    });
    
    console.log('Navigation items:', navigation.map(n => n.name));
    console.log('Filtered navigation:', filtered.map(n => n.name));
    console.log('User role:', user?.role, 'isAdmin:', isAdmin, 'isManager:', isManager);
    
    return filtered;
  }

  // Otomatik veri kaydetme scheduler'larını başlat
  useEffect(() => {
    const cleanupDaily = startDailyProductionScheduler()
    const cleanupAutoSave = startAutoSaveScheduler()
    console.log('Production schedulers started: Daily (23:30) + Auto-save (every 10 min)')
    
    return () => {
      cleanupDaily()
      cleanupAutoSave()
    }
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 flex z-40 md:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <SidebarContent navigation={getFilteredNavigation()} pathname={pathname} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex-1 flex flex-col min-h-0 bg-white shadow-lg">
          <SidebarContent navigation={getFilteredNavigation()} pathname={pathname} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top navigation */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex-1 px-4 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-900">
              SolarVeyo - SCADA Monitoring
            </h1>
            
            <div className="flex items-center space-x-4">
              <NotificationCenter />
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-700">{user?.displayName || user?.email}</div>
                  <div className="text-xs text-gray-500">
                    {user?.role === 'admin' ? 'Sistem Yöneticisi' : 
                     user?.role === 'manager' ? 'Yönetici' : 
                     user?.role === 'viewer' ? 'İzleyici' : 'Kullanıcı'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Çıkış</span>
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function SidebarContent({ navigation, pathname }: { navigation: any[], pathname: string }) {
  return (
    <>
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <SolarVeyoLogo />
        </div>
        
        <nav className="mt-8 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-indigo-100 text-indigo-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon
                  className={`mr-3 h-5 w-5 ${
                    isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
