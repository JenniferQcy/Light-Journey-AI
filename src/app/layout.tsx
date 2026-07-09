import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import OfflineDetector from '@/components/ui/OfflineDetector'

export const metadata: Metadata = {
  title: '轻途AI - 一键生成旅行攻略',
  description: '告别小红书手动做功，AI一键生成可直接照着走的旅行攻略',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ErrorBoundary>
          <ToastProvider>
            <OfflineDetector>
              {children}
            </OfflineDetector>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
