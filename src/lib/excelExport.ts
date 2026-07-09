import * as XLSX from 'xlsx'
import type { ItineraryItem } from '@/types'

export const exportToExcel = (items: ItineraryItem[], filename: string = '行程表.xlsx'): void => {
  const data = items.map((item) => ({
    '日期': `第${item.day}天`,
    '时段': getPeriodText(item.period),
    '类型': getTypeText(item.type),
    '名称': item.name,
    '营业/门票信息': item.businessInfo,
    '消费标准': item.costEstimate,
    '上一站通勤时长': item.commuteFromPrev,
    '小红书口碑摘要': item.reviewSummary,
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '行程表')

  const colWidths = [
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 25 },
    { wch: 25 },
    { wch: 15 },
    { wch: 18 },
    { wch: 40 },
  ]
  worksheet['!cols'] = colWidths

  XLSX.writeFile(workbook, filename)
}

export const copyItineraryToClipboard = async (items: ItineraryItem[]): Promise<void> => {
  const text = items
    .map((item) => {
      return `第${item.day}天 ${getPeriodText(item.period)} | ${getTypeText(item.type)}: ${item.name}\n` +
        `  营业/门票: ${item.businessInfo}\n` +
        `  消费: ${item.costEstimate}\n` +
        `  通勤: ${item.commuteFromPrev}\n` +
        `  口碑: ${item.reviewSummary}`
    })
    .join('\n\n')

  await navigator.clipboard.writeText(text)
}

const getPeriodText = (period: string): string => {
  const map: Record<string, string> = {
    morning: '上午',
    afternoon: '下午',
    evening: '傍晚',
    night: '晚上',
  }
  return map[period] || period
}

const getTypeText = (type: string): string => {
  const map: Record<string, string> = {
    attraction: '景点',
    food: '餐饮',
    transport: '交通',
    hotel: '住宿',
    other: '其他',
  }
  return map[type] || type
}
