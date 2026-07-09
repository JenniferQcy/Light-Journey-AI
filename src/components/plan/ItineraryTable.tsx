'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Input, TextArea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { exportToExcel, copyItineraryToClipboard } from '@/lib/excelExport'
import type { ItineraryItem } from '@/types'

interface ItineraryTableProps {
  items: ItineraryItem[]
  onItemsChange: (items: ItineraryItem[]) => void
  onViewReview: (item: ItineraryItem) => void
  onLocateOnMap: (item: ItineraryItem) => void
  destination: string
}

const periodLabels: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '傍晚',
  night: '晚上',
}

const typeLabels: Record<string, string> = {
  attraction: '景点',
  food: '餐饮',
  transport: '交通',
  hotel: '住宿',
  other: '其他',
}

const typeColors: Record<string, string> = {
  attraction: 'bg-blue-100 text-blue-700',
  food: 'bg-orange-100 text-orange-700',
  transport: 'bg-green-100 text-green-700',
  hotel: 'bg-purple-100 text-purple-700',
  other: 'bg-gray-100 text-gray-700',
}

export default function ItineraryTable({
  items,
  onItemsChange,
  onViewReview,
  onLocateOnMap,
  destination,
}: ItineraryTableProps) {
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null)
  const [showActions, setShowActions] = useState(false)
  const { showToast } = useToast()

  const days = Array.from(new Set(items.map((item) => item.day))).sort((a, b) => a - b)

  const handleDelete = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id))
    showToast('已删除该点位', 'success')
  }

  const handleSaveEdit = () => {
    if (!editingItem) return
    onItemsChange(items.map((item) => (item.id === editingItem.id ? editingItem : item)))
    setEditingItem(null)
    showToast('修改已保存', 'success')
  }

  const handleAddItem = (day: number, period: string) => {
    const newItem: ItineraryItem = {
      id: `item_${Date.now()}`,
      day,
      period: period as ItineraryItem['period'],
      type: 'attraction',
      name: '新点位',
      businessInfo: '',
      costEstimate: '',
      commuteFromPrev: '',
      reviewSummary: '',
    }
    const newItems = [...items, newItem].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day
      const periodOrder = ['morning', 'afternoon', 'evening', 'night']
      return periodOrder.indexOf(a.period) - periodOrder.indexOf(b.period)
    })
    onItemsChange(newItems)
    setEditingItem(newItem)
  }

  const handleExportExcel = () => {
    try {
      exportToExcel(items, `${destination}行程表.xlsx`)
      showToast('Excel导出成功', 'success')
    } catch {
      showToast('导出失败，请重试', 'error')
    }
    setShowActions(false)
  }

  const handleCopy = async () => {
    try {
      await copyItineraryToClipboard(items)
      showToast('行程已复制到剪贴板', 'success')
    } catch {
      showToast('复制失败，请重试', 'error')
    }
    setShowActions(false)
  }

  const handleClear = () => {
    if (confirm('确定要清空所有行程吗？')) {
      onItemsChange([])
      showToast('行程已清空', 'success')
    }
    setShowActions(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">📋 {destination}行程</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            共 {items.length} 个点位 · {days.length} 天
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowActions(true)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </Button>
        </div>
      </div>

      {days.map((day) => (
        <div key={day} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500 text-white rounded-lg flex items-center justify-center text-sm font-bold">
              D{day}
            </div>
            <h3 className="font-semibold text-text-primary">第 {day} 天</h3>
          </div>

          <div className="space-y-2">
            {['morning', 'afternoon', 'evening', 'night'].map((period) => {
              const periodItems = items.filter((item) => item.day === day && item.period === period)
              return (
                <div key={period} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      {periodLabels[period]}
                    </span>
                    <button
                      onClick={() => handleAddItem(day, period)}
                      className="text-xs text-primary-500 font-medium active:text-primary-600"
                    >
                      + 添加
                    </button>
                  </div>

                  {periodItems.length === 0 ? (
                    <div className="text-center py-4 text-text-tertiary text-sm border border-dashed border-surface-tertiary rounded-xl">
                      暂无安排
                    </div>
                  ) : (
                    periodItems.map((item) => (
                      <Card key={item.id} padding="sm" className="relative group">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${typeColors[item.type]}`}>
                              {typeLabels[item.type]}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-text-primary truncate">{item.name}</h4>
                            {item.businessInfo && (
                              <p className="text-xs text-text-secondary mt-0.5 truncate">
                                {item.businessInfo}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              <span className="text-text-tertiary">💰 {item.costEstimate || '未知'}</span>
                              {item.commuteFromPrev && (
                                <span className="text-text-tertiary">🚶 {item.commuteFromPrev}</span>
                              )}
                            </div>
                            {item.reviewSummary && (
                              <p className="text-xs text-text-tertiary mt-2 line-clamp-2 italic">
                                "{item.reviewSummary}"
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-surface-tertiary">
                          <button
                            onClick={() => onViewReview(item)}
                            className="flex-1 py-1.5 text-xs font-medium text-primary-500 rounded-lg hover:bg-primary-50 transition-colors"
                          >
                            查看口碑
                          </button>
                          <button
                            onClick={() => onLocateOnMap(item)}
                            className="flex-1 py-1.5 text-xs font-medium text-text-secondary rounded-lg hover:bg-surface-secondary transition-colors"
                          >
                            地图定位
                          </button>
                          <button
                            onClick={() => setEditingItem(item)}
                            className="flex-1 py-1.5 text-xs font-medium text-text-secondary rounded-lg hover:bg-surface-secondary transition-colors"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="flex-1 py-1.5 text-xs font-medium text-error rounded-lg hover:bg-red-50 transition-colors"
                          >
                            删除
                          </button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="编辑点位"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setEditingItem(null)}>
              取消
            </Button>
            <Button fullWidth onClick={handleSaveEdit}>
              保存
            </Button>
          </div>
        }
      >
        {editingItem && (
          <div className="space-y-4">
            <Input
              label="名称"
              value={editingItem.name}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="类型"
                value={typeLabels[editingItem.type] || editingItem.type}
                onChange={(e) => {
                  const val = e.target.value
                  const typeKey = Object.keys(typeLabels).find((k) => typeLabels[k] === val) || val
                  setEditingItem({ ...editingItem, type: typeKey as ItineraryItem['type'] })
                }}
              />
              <Input
                label="消费标准"
                value={editingItem.costEstimate}
                onChange={(e) => setEditingItem({ ...editingItem, costEstimate: e.target.value })}
              />
            </div>
            <Input
              label="营业/门票信息"
              value={editingItem.businessInfo}
              onChange={(e) => setEditingItem({ ...editingItem, businessInfo: e.target.value })}
            />
            <Input
              label="上一站通勤时长"
              value={editingItem.commuteFromPrev}
              onChange={(e) => setEditingItem({ ...editingItem, commuteFromPrev: e.target.value })}
            />
            <TextArea
              label="口碑摘要"
              value={editingItem.reviewSummary}
              onChange={(e) => setEditingItem({ ...editingItem, reviewSummary: e.target.value })}
              rows={3}
            />
          </div>
        )}
      </Modal>

      <Modal isOpen={showActions} onClose={() => setShowActions(false)} title="行程操作">
        <div className="space-y-2">
          <button
            onClick={handleExportExcel}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-secondary transition-colors text-left"
          >
            <span className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <div>
              <p className="font-medium text-text-primary">导出Excel</p>
              <p className="text-sm text-text-secondary">保存为本地表格文件</p>
            </div>
          </button>

          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-secondary transition-colors text-left"
          >
            <span className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </span>
            <div>
              <p className="font-medium text-text-primary">复制行程</p>
              <p className="text-sm text-text-secondary">复制文字版本到剪贴板</p>
            </div>
          </button>

          <button
            onClick={handleClear}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 transition-colors text-left"
          >
            <span className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </span>
            <div>
              <p className="font-medium text-error">清空行程</p>
              <p className="text-sm text-text-secondary">删除所有点位</p>
            </div>
          </button>
        </div>
      </Modal>
    </div>
  )
}
