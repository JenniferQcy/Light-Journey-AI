export interface TravelPlanInput {
  destination: string
  days: number
  peopleCount: number
  budgetLevel: 'budget' | 'normal' | 'comfortable'
  preferences: string[]
}

export interface ItineraryItem {
  id: string
  day: number
  period: 'morning' | 'afternoon' | 'evening' | 'night'
  type: 'attraction' | 'food' | 'transport' | 'hotel' | 'other'
  name: string
  businessInfo: string
  costEstimate: string
  commuteFromPrev: string
  reviewSummary: string
  latitude?: number
  longitude?: number
  address?: string
}

export interface TravelPlan {
  id: string
  createdAt: string
  destination: string
  days: number
  peopleCount: number
  budgetLevel: 'budget' | 'normal' | 'comfortable'
  preferences: string[]
  items: ItineraryItem[]
}

export interface ScenicReview {
  id: string
  scenicName: string
  summary: string
  pros: string[]
  cons: string[]
  tips: string[]
  sourceCount: number
  createdAt: string
}

export interface TravelImage {
  id: string
  planId: string
  fileName: string
  compressedUrl: string
  originalUrl?: string
  size: number
  compressedSize: number
  uploadedAt: string
  note?: string
  tags?: string[]
}

export interface TravelJournal {
  id: string
  planId: string
  title: string
  content: string
  images: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  duration?: number
}
