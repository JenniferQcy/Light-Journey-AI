import { NextRequest, NextResponse } from 'next/server'
import type { TravelPlanInput, ItineraryItem } from '@/types'
import { createTask, getTask, updateTask } from '@/lib/taskStore'

export const runtime = 'nodejs'
export const maxDuration = 120

const VOLC_API_KEY = process.env.VOLC_API_KEY || ''
const VOLC_MODEL = process.env.VOLC_MODEL || 'deepseek-v3-250324'
const VOLC_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'

const TIMEOUT_MS = 120000

function buildPrompt(input: TravelPlanInput): string {
  const budgetText = {
    budget: '穷游/经济',
    normal: '适中/常规',
    comfortable: '舒适/高品质',
  }[input.budgetLevel]

  const prefText = input.preferences.length > 0
    ? `偏好：${input.preferences.join('、')}`
    : '无特殊偏好'

  return `你是一位专业的旅行规划师。请根据以下信息为用户生成一份详细的旅行行程。

目的地：${input.destination}
天数：${input.days} 天
人数：${input.peopleCount} 人
预算：${budgetText}
${prefText}

请按以下要求生成：
1. 每天分为上午(morning)、下午(afternoon)、傍晚(evening)、晚上(night)四个时段
2. 每个时段安排一个点位，类型包括：景点(attraction)、餐饮(food)、交通(transport)、住宿(hotel)、其他(other)
3. 每晚最后一个点位必须是住宿(hotel)
4. 请包含具体的地点名称、营业时间/类型说明、人均费用估算、从上一个点的交通方式、简短口碑评价
5. 地点要真实存在，符合当地特色
6. 每天 4-6 个点位

请严格按照以下JSON格式返回，不要有任何额外文字：
{
  "items": [
    {
      "day": 1,
      "period": "morning",
      "type": "attraction",
      "name": "景点名称",
      "businessInfo": "营业时间或说明",
      "costEstimate": "人均费用",
      "commuteFromPrev": "从上一点过来的方式",
      "reviewSummary": "一句话评价"
    }
  ]
}`
}

async function callDoubaoAPI(prompt: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(VOLC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VOLC_API_KEY}`,
      },
      body: JSON.stringify({
        model: VOLC_MODEL,
        messages: [
          { role: 'system', content: '你是一位专业的旅行规划师，擅长根据用户需求生成详细的旅行行程。只返回JSON，不要任何额外文字。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API调用失败: ${response.status} ${errorText.slice(0, 200)}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取流式响应')
    }

    const decoder = new TextDecoder()
    let fullContent = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content || ''
          fullContent += delta
        } catch {
          // 忽略解析错误的行
        }
      }
    }

    if (!fullContent) {
      throw new Error('API返回内容为空')
    }

    return fullContent
  } finally {
    clearTimeout(timeoutId)
  }
}

function parseAIResponse(content: string): ItineraryItem[] {
  let jsonStr = content.trim()

  jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim()

  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    jsonStr = jsonMatch[0]
  }

  try {
    const parsed = JSON.parse(jsonStr)
    if (parsed.items && Array.isArray(parsed.items)) {
      return parsed.items.map((item: any, index: number) => ({
        id: `ai_${Date.now()}_${index}`,
        day: item.day || 1,
        period: item.period || 'morning',
        type: item.type || 'other',
        name: item.name || '未命名点位',
        businessInfo: item.businessInfo || '',
        costEstimate: item.costEstimate || '',
        commuteFromPrev: item.commuteFromPrev || '',
        reviewSummary: item.reviewSummary || '',
      }))
    }
    if (Array.isArray(parsed)) {
      return parsed.map((item: any, index: number) => ({
        id: `ai_${Date.now()}_${index}`,
        day: item.day || 1,
        period: item.period || 'morning',
        type: item.type || 'other',
        name: item.name || '未命名点位',
        businessInfo: item.businessInfo || '',
        costEstimate: item.costEstimate || '',
        commuteFromPrev: item.commuteFromPrev || '',
        reviewSummary: item.reviewSummary || '',
      }))
    }
    throw new Error('返回格式不正确')
  } catch (e) {
    console.error('JSON解析失败，原始内容:', content)
    
    const items: ItineraryItem[] = []
    const dayRegex = /第\s*(\d+)\s*天/g
    const periodRegex = /(上午|下午|傍晚|晚上)/g
    const nameRegex = /【([^】]+)】|\[([^\]]+)\]|名称[：:]\s*([^\n，。,]+)/g
    
    let lastDay = 1
    let lastPeriod: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning'
    let match
    
    const lines = content.split('\n').filter(line => line.trim().length > 0)
    for (const line of lines) {
      const dayMatch = line.match(/第\s*(\d+)\s*天/)
      if (dayMatch) {
        lastDay = parseInt(dayMatch[1])
        continue
      }
      
      if (line.includes('上午') || line.includes('早晨') || line.includes('早上')) {
        lastPeriod = 'morning'
      } else if (line.includes('下午')) {
        lastPeriod = 'afternoon'
      } else if (line.includes('傍晚') || line.includes('黄昏')) {
        lastPeriod = 'evening'
      } else if (line.includes('晚上') || line.includes('夜晚') || line.includes('夜间')) {
        lastPeriod = 'night'
      }
      
      const nameMatch = line.match(/【([^】]+)】/) || line.match(/〖([^〗]+)〗/) || line.match(/「([^」]+)」/)
      if (nameMatch && nameMatch[1].length > 1) {
        const type = line.includes('酒店') || line.includes('住宿') ? 'hotel' 
          : line.includes('餐') || line.includes('吃') || line.includes('美食') ? 'food'
          : line.includes('交通') || line.includes('车') ? 'transport'
          : 'attraction'
        
        items.push({
          id: `ai_${Date.now()}_${items.length}`,
          day: lastDay,
          period: lastPeriod,
          type,
          name: nameMatch[1].trim(),
          businessInfo: line.replace(/【[^】]*】/g, '').trim().slice(0, 50) || '',
          costEstimate: '',
          commuteFromPrev: '',
          reviewSummary: '',
        })
      }
    }
    
    if (items.length > 0) {
      console.log(`从非结构化文本中提取到 ${items.length} 个点位`)
      return items
    }
    
    throw new Error('AI返回格式解析失败')
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json(
      { error: '缺少taskId参数' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const task = getTask(taskId)
  if (!task) {
    return NextResponse.json(
      { error: '任务不存在' },
      { status: 404, headers: CORS_HEADERS }
    )
  }

  return NextResponse.json(task, { headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const input: TravelPlanInput = body

  if (!input.destination || !input.days) {
    return NextResponse.json(
      { error: '缺少必要参数' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  if (!VOLC_API_KEY) {
    return NextResponse.json(
      { error: 'API Key未配置' },
      { status: 500, headers: CORS_HEADERS }
    )
  }

  const taskId = createTask()
  updateTask(taskId, { status: 'processing' })

  setTimeout(async () => {
    try {
      const prompt = buildPrompt(input)
      const aiResponse = await callDoubaoAPI(prompt)
      const items = parseAIResponse(aiResponse)
      updateTask(taskId, { status: 'completed', items })
    } catch (error: any) {
      console.error('生成行程失败:', error)
      updateTask(taskId, { status: 'failed', error: error.message || '生成失败' })
    }
  }, 10)

  return NextResponse.json({ taskId }, { headers: CORS_HEADERS })
}
