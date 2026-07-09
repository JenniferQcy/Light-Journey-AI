import type { TravelPlan, TravelImage, TravelJournal } from '@/types'

const STORAGE_KEYS = {
  PLANS: 'qingtu_plans',
  CURRENT_PLAN: 'qingtu_current_plan',
  IMAGES: 'qingtu_images',
  JOURNALS: 'qingtu_journals',
}

export const savePlanToLocal = (plan: TravelPlan): void => {
  const plans = getPlansFromLocal()
  const index = plans.findIndex((p) => p.id === plan.id)
  if (index >= 0) {
    plans[index] = plan
  } else {
    plans.unshift(plan)
  }
  localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans))
  localStorage.setItem(STORAGE_KEYS.CURRENT_PLAN, plan.id)
}

export const getPlansFromLocal = (): TravelPlan[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PLANS)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export const getPlanById = (id: string): TravelPlan | null => {
  const plans = getPlansFromLocal()
  return plans.find((p) => p.id === id) || null
}

export const deletePlanFromLocal = (id: string): void => {
  const plans = getPlansFromLocal().filter((p) => p.id !== id)
  localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans))
  
  const current = localStorage.getItem(STORAGE_KEYS.CURRENT_PLAN)
  if (current === id) {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_PLAN)
  }
}

export const getCurrentPlanId = (): string | null => {
  return localStorage.getItem(STORAGE_KEYS.CURRENT_PLAN)
}

export const setCurrentPlanId = (id: string): void => {
  localStorage.setItem(STORAGE_KEYS.CURRENT_PLAN, id)
}

export const saveImagesToLocal = (images: TravelImage[]): void => {
  localStorage.setItem(STORAGE_KEYS.IMAGES, JSON.stringify(images))
}

export const getImagesFromLocal = (): TravelImage[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.IMAGES)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export const saveJournalToLocal = (journal: TravelJournal): void => {
  const journals = getJournalsFromLocal()
  const index = journals.findIndex((j) => j.id === journal.id)
  if (index >= 0) {
    journals[index] = journal
  } else {
    journals.unshift(journal)
  }
  localStorage.setItem(STORAGE_KEYS.JOURNALS, JSON.stringify(journals))
}

export const getJournalsFromLocal = (): TravelJournal[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.JOURNALS)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export const isOnline = (): boolean => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}
