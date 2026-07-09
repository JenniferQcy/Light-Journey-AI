'use client'

import { ReactNode } from 'react'
import BottomNav from './BottomNav'

interface AppLayoutProps {
  children: ReactNode
  showNav?: boolean
}

export default function AppLayout({ children, showNav = true }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-secondary">
      <main className={`pb-20 ${showNav ? '' : 'pb-0'}`}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  )
}
