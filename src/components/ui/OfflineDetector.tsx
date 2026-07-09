'use client'

import { useState, useEffect } from 'react'
import { useToast } from './Toast'

export default function OfflineDetector({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    if (typeof navigator === 'undefined') return

    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      showToast('网络已恢复', 'success')
    }

    const handleOffline = () => {
      setIsOnline(false)
      showToast('网络已断开，部分功能不可用', 'warning')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [showToast])

  return (
    <>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-warning text-white text-center py-2 text-sm z-50">
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656m-7.072 7.072a9 9 0 010-12.728m3.536 3.536a4 4 0 010 5.656" />
            </svg>
            网络已断开，仅可查看本地缓存数据
          </span>
        </div>
      )}
      {children}
    </>
  )
}
