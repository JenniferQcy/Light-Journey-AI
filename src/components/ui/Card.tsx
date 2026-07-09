'use client'

import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  onClick?: () => void
}

export default function Card({ children, className = '', padding = 'md', hover = false, onClick }: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-sm ${paddingStyles[padding]} ${hover ? 'hover:shadow-md transition-shadow duration-200 cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
