/**
 * Firebase Subscription Manager
 * Memory leak'leri önlemek için merkezi subscription yönetimi
 */

import { Unsubscribe } from 'firebase/firestore'
import { logger } from './productionLogger'

export class SubscriptionManager {
  private subscriptions: Map<string, Unsubscribe> = new Map()
  private subscriptionGroups: Map<string, Set<string>> = new Map()

  /**
   * Subscription ekle
   */
  add(key: string, unsubscribe: Unsubscribe, group?: string): void {
    // Eski subscription varsa önce temizle
    if (this.subscriptions.has(key)) {
      this.remove(key)
    }

    this.subscriptions.set(key, unsubscribe)
    
    // Grup varsa gruba ekle
    if (group) {
      if (!this.subscriptionGroups.has(group)) {
        this.subscriptionGroups.set(group, new Set())
      }
      this.subscriptionGroups.get(group)!.add(key)
    }

    logger.debug(`Subscription added: ${key}${group ? ` (group: ${group})` : ''}`)
  }

  /**
   * Subscription kaldır
   */
  remove(key: string): void {
    const unsubscribe = this.subscriptions.get(key)
    if (unsubscribe) {
      unsubscribe()
      this.subscriptions.delete(key)
      
      // Gruplardan da kaldır
      this.subscriptionGroups.forEach(group => {
        group.delete(key)
      })
      
      logger.debug(`Subscription removed: ${key}`)
    }
  }

  /**
   * Bir gruptaki tüm subscription'ları temizle
   */
  removeGroup(group: string): void {
    const groupSubs = this.subscriptionGroups.get(group)
    if (groupSubs) {
      groupSubs.forEach(key => {
        this.remove(key)
      })
      this.subscriptionGroups.delete(group)
      logger.debug(`Subscription group removed: ${group} (${groupSubs.size} subscriptions)`)
    }
  }

  /**
   * Tüm subscription'ları temizle
   */
  removeAll(): void {
    const count = this.subscriptions.size
    this.subscriptions.forEach((unsubscribe, key) => {
      unsubscribe()
      logger.debug(`Cleaning subscription: ${key}`)
    })
    this.subscriptions.clear()
    this.subscriptionGroups.clear()
    logger.info(`All subscriptions cleaned (${count} total)`)
  }

  /**
   * Aktif subscription sayısı
   */
  getActiveCount(): number {
    return this.subscriptions.size
  }

  /**
   * Grup bazlı subscription sayısı
   */
  getGroupCount(group: string): number {
    return this.subscriptionGroups.get(group)?.size || 0
  }

  /**
   * Debug için subscription listesi
   */
  getDebugInfo(): { total: number; groups: Record<string, number> } {
    const groups: Record<string, number> = {}
    this.subscriptionGroups.forEach((subs, groupName) => {
      groups[groupName] = subs.size
    })
    return {
      total: this.subscriptions.size,
      groups
    }
  }
}

// Global subscription manager instance
export const subscriptionManager = new SubscriptionManager()

// Sayfa kapatılırken tüm subscription'ları temizle
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    subscriptionManager.removeAll()
  })
}

/**
 * React Hook için helper
 */
export function useSubscriptionManager(componentName: string) {
  const groupName = `component_${componentName}_${Date.now()}`

  const addSubscription = (key: string, unsubscribe: Unsubscribe) => {
    subscriptionManager.add(`${groupName}_${key}`, unsubscribe, groupName)
  }

  const cleanup = () => {
    subscriptionManager.removeGroup(groupName)
  }

  return { addSubscription, cleanup }
}
