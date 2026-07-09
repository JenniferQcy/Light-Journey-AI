const RATE_LIMIT_KEYS = {
  PLAN_GENERATION: 'qingtu_plan_gen_count',
  SCENIC_REVIEW: 'qingtu_scenic_review_count',
}

const RATE_LIMITS = {
  PLAN_GENERATION: 10,
  SCENIC_REVIEW_PER_SCENIC: 3,
}

const getTodayKey = (prefix: string): string => {
  const today = new Date().toISOString().split('T')[0]
  return `${prefix}_${today}`
}

export const checkPlanGenerationLimit = (): boolean => {
  const key = getTodayKey(RATE_LIMIT_KEYS.PLAN_GENERATION)
  const count = parseInt(localStorage.getItem(key) || '0', 10)
  return count < RATE_LIMITS.PLAN_GENERATION
}

export const incrementPlanGeneration = (): void => {
  const key = getTodayKey(RATE_LIMIT_KEYS.PLAN_GENERATION)
  const count = parseInt(localStorage.getItem(key) || '0', 10)
  localStorage.setItem(key, String(count + 1))
}

export const getRemainingPlanGenerations = (): number => {
  const key = getTodayKey(RATE_LIMIT_KEYS.PLAN_GENERATION)
  const count = parseInt(localStorage.getItem(key) || '0', 10)
  return Math.max(0, RATE_LIMITS.PLAN_GENERATION - count)
}

export const checkScenicReviewLimit = (scenicName: string): boolean => {
  const key = getTodayKey(`${RATE_LIMIT_KEYS.SCENIC_REVIEW}_${scenicName}`)
  const count = parseInt(localStorage.getItem(key) || '0', 10)
  return count < RATE_LIMITS.SCENIC_REVIEW_PER_SCENIC
}

export const incrementScenicReview = (scenicName: string): void => {
  const key = getTodayKey(`${RATE_LIMIT_KEYS.SCENIC_REVIEW}_${scenicName}`)
  const count = parseInt(localStorage.getItem(key) || '0', 10)
  localStorage.setItem(key, String(count + 1))
}

export const getRemainingScenicReviews = (scenicName: string): number => {
  const key = getTodayKey(`${RATE_LIMIT_KEYS.SCENIC_REVIEW}_${scenicName}`)
  const count = parseInt(localStorage.getItem(key) || '0', 10)
  return Math.max(0, RATE_LIMITS.SCENIC_REVIEW_PER_SCENIC - count)
}
