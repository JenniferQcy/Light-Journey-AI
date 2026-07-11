'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PlanForm from '@/components/plan/PlanForm'
import ItineraryTable from '@/components/plan/ItineraryTable'
import ReviewModal from '@/components/plan/ReviewModal'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'
import { generateTravelPlan } from '@/lib/api'
import { incrementPlanGeneration } from '@/lib/rateLimit'
import { savePlanToLocal, getCurrentPlanId, getPlanById } from '@/lib/storage'
import type { TravelPlanInput, ItineraryItem, TravelPlan } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export default function HomePage() {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ItineraryItem[]>([])
  const [destination, setDestination] = useState('')
  const [planInput, setPlanInput] = useState<TravelPlanInput | null>(null)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null)
  const [isGenerated, setIsGenerated] = useState(false)

  const { showToast } = useToast()

  useEffect(() => {
    const currentPlanId = getCurrentPlanId()
    if (currentPlanId) {
      const plan = getPlanById(currentPlanId)
      if (plan && plan.items.length > 0) {
        setItems(plan.items)
        setDestination(plan.destination)
        setPlanInput({
          destination: plan.destination,
          days: plan.days,
          peopleCount: plan.peopleCount,
          budgetLevel: plan.budgetLevel,
          preferences: plan.preferences,
        })
        setIsGenerated(true)
      }
    }
  }, [])

  const handleGenerate = async (input: TravelPlanInput) => {
    setLoading(true)
    setPlanInput(input)
    setDestination(input.destination)

    try {
      const result = await generateTravelPlan(input)
      setItems(result.items)
      setIsGenerated(true)
      incrementPlanGeneration()

      const plan: TravelPlan = {
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        destination: input.destination,
        days: input.days,
        peopleCount: input.peopleCount,
        budgetLevel: input.budgetLevel,
        preferences: input.preferences,
        items: result.items,
      }
      savePlanToLocal(plan)
      setLoading(false)

      showToast(`行程生成成功！剩余 ${result.remaining} 次`, 'success')
    } catch (error: any) {
      setLoading(false)
      showToast(error.message || '生成失败，请重试', 'error')
    }
  }

  const handleItemsChange = (newItems: ItineraryItem[]) => {
    setItems(newItems)
    
    if (planInput) {
      const currentPlanId = getCurrentPlanId()
      if (currentPlanId) {
        const plan = getPlanById(currentPlanId)
        if (plan) {
          savePlanToLocal({
            ...plan,
            items: newItems,
          })
        }
      }
    }
  }

  const handleViewReview = (item: ItineraryItem) => {
    setSelectedItem(item)
    setReviewModalOpen(true)
  }

  const handleLocateOnMap = (item: ItineraryItem) => {
    const params = new URLSearchParams({
      name: item.name,
    })
    if (destination) {
      params.append('city', destination)
    }
    if (item.latitude && item.longitude) {
      params.append('lat', String(item.latitude))
      params.append('lng', String(item.longitude))
    }
    window.location.href = `/map?${params.toString()}`
  }

  const handleReset = () => {
    setItems([])
    setIsGenerated(false)
    setPlanInput(null)
    setDestination('')
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6">
        {!isGenerated ? (
          <PlanForm onGenerate={handleGenerate} loading={loading} />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <button
                onClick={handleReset}
                className="text-sm text-primary-500 font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                重新生成
              </button>
            </div>

            <ItineraryTable
              items={items}
              onItemsChange={handleItemsChange}
              onViewReview={handleViewReview}
              onLocateOnMap={handleLocateOnMap}
              destination={destination}
            />
          </div>
        )}

        {loading && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <Loading size="lg" />
              <p className="mt-4 text-text-secondary font-medium">AI正在为你规划行程...</p>
              <p className="mt-2 text-sm text-text-tertiary">通常需要30-90秒，请耐心等待</p>
            </div>
          </div>
        )}
      </div>

      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        item={selectedItem}
        city={destination}
      />
    </AppLayout>
  )
}
