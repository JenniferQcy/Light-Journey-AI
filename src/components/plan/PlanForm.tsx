'use client'

import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import TagSelector from '@/components/ui/TagSelector'
import Card from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { checkPlanGenerationLimit, getRemainingPlanGenerations } from '@/lib/rateLimit'
import type { TravelPlanInput } from '@/types'

interface PlanFormProps {
  onGenerate: (input: TravelPlanInput) => void
  loading: boolean
}

const preferenceOptions = [
  { value: 'nature', label: '自然风光' },
  { value: 'culture', label: '人文历史' },
  { value: 'food', label: '美食探店' },
  { value: 'relax', label: '休闲度假' },
  { value: 'shopping', label: '购物逛街' },
  { value: 'photography', label: '摄影出片' },
]

const budgetOptions = [
  { value: 'budget', label: '穷游' },
  { value: 'normal', label: '平价' },
  { value: 'comfortable', label: '舒适' },
]

export default function PlanForm({ onGenerate, loading }: PlanFormProps) {
  const [destination, setDestination] = useState('')
  const [days, setDays] = useState('3')
  const [peopleCount, setPeopleCount] = useState('2')
  const [budgetLevel, setBudgetLevel] = useState<string[]>(['normal'])
  const [preferences, setPreferences] = useState<string[]>(['food', 'culture'])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { showToast } = useToast()
  const [remaining, setRemaining] = useState(10)

  useEffect(() => {
    setRemaining(getRemainingPlanGenerations())
  }, [])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!destination.trim()) {
      newErrors.destination = '请输入目的地城市'
    }

    const daysNum = parseInt(days, 10)
    if (!days || isNaN(daysNum) || daysNum < 1 || daysNum > 15) {
      newErrors.days = '天数需在1-15天之间'
    }

    const peopleNum = parseInt(peopleCount, 10)
    if (!peopleCount || isNaN(peopleNum) || peopleNum < 1) {
      newErrors.peopleCount = '人数至少1人'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return

    if (!checkPlanGenerationLimit()) {
      showToast('今日生成次数已用完，请明天再来~', 'warning')
      return
    }

    onGenerate({
      destination: destination.trim(),
      days: parseInt(days, 10),
      peopleCount: parseInt(peopleCount, 10),
      budgetLevel: (budgetLevel[0] || 'normal') as 'budget' | 'normal' | 'comfortable',
      preferences,
    })
  }

  return (
    <div className="space-y-5">
      <div className="text-center mb-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-50 rounded-full mb-3">
          <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-sm font-medium text-primary-600">AI智能规划</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-1">生成你的专属行程</h1>
        <p className="text-sm text-text-secondary">告别手动做攻略，一键生成可直接照着走的旅行计划</p>
      </div>

      <Card className="space-y-5">
        <Input
          label="目的地城市"
          placeholder="如：北京、上海、成都"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          error={errors.destination}
          leftIcon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="出行天数"
            type="number"
            min={1}
            max={15}
            placeholder="1-15天"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            error={errors.days}
          />
          <Input
            label="出行人数"
            type="number"
            min={1}
            placeholder="人数"
            value={peopleCount}
            onChange={(e) => setPeopleCount(e.target.value)}
            error={errors.peopleCount}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-3">预算档位</label>
          <TagSelector
            options={budgetOptions}
            value={budgetLevel}
            onChange={setBudgetLevel}
            multiple={false}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-3">
            出行偏好 <span className="text-text-tertiary font-normal">（可多选）</span>
          </label>
          <TagSelector
            options={preferenceOptions}
            value={preferences}
            onChange={setPreferences}
          />
        </div>
      </Card>

      <div className="space-y-3">
        <Button fullWidth size="lg" loading={loading} onClick={handleSubmit}>
          {loading ? 'AI正在生成行程...' : '✨ 一键生成行程'}
        </Button>
        <p className="text-center text-xs text-text-tertiary">
          今日剩余生成次数：{remaining} 次 · 免费额度保护
        </p>
      </div>
    </div>
  )
}
