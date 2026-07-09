import { NextRequest, NextResponse } from 'next/server'
import type { ScenicReview } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 120

const VOLC_API_KEY = process.env.VOLC_API_KEY || ''
const VOLC_MODEL = process.env.VOLC_MODEL || 'ep-m-20260708223320-f9chg'
const VOLC_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'

const TIMEOUT_MS = 60000

function buildPrompt(scenicName: string, city?: string, type?: string): string {
  const typeText = type === 'food' ? '餐厅/美食' : type === 'hotel' ? '酒店/住宿' : '景点'
  const cityText = city ? `（${city}）` : ''

  return `你是一位专业的旅行点评分析师。请为以下${typeText}生成一份基于真实游客评价的口碑汇总。

${typeText}名称：${scenicName}${cityText}

请从多个维度分析游客的真实评价，包括优点、不足和实用建议。内容要真实可信，符合该地点的实际情况。

请严格按照以下JSON格式返回，不要有任何额外文字：
{
  "summary": "一句话总体评价（30-50字）",
  "pros": ["优点1", "优点2", "优点3", "优点4"],
  "cons": ["不足1", "不足2", "不足3"],
  "tips": ["建议1", "建议2", "建议3", "建议4"],
  "sourceCount": 128
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
          { role: 'system', content: '你是一位专业的旅行点评分析师，擅长汇总游客真实评价。只返回JSON，不要任何额外文字。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
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

function parseAIResponse(content: string, scenicName: string): ScenicReview {
  let jsonStr = content.trim()

  jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim()

  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    jsonStr = jsonMatch[0]
  }

  try {
    const parsed = JSON.parse(jsonStr)
    return {
      id: `review_${Date.now()}`,
      scenicName,
      summary: parsed.summary || '',
      pros: Array.isArray(parsed.pros) ? parsed.pros : [],
      cons: Array.isArray(parsed.cons) ? parsed.cons : [],
      tips: Array.isArray(parsed.tips) ? parsed.tips : [],
      sourceCount: parsed.sourceCount || 100,
      createdAt: new Date().toISOString(),
    }
  } catch (e) {
    console.error('口碑JSON解析失败，原始内容:', content)
    
    const summaryMatch = content.match(/(总体评价|总结|简介)[：:]\s*([^\n。]+[。.])/) 
      || content.match(/^(.{20,80}[。.])/m)
    const summary = summaryMatch ? summaryMatch[2] || summaryMatch[1] : `${scenicName}整体体验不错，值得一去。`
    
    const pros: string[] = []
    const cons: string[] = []
    const tips: string[] = []
    
    const prosSection = content.match(/(优点|优势|亮点|好评)[：:][\s\S]*?(?=不足|缺点|劣势|建议|tips|$)/i)
    if (prosSection) {
      const proMatches = prosSection[0].match(/[•\-\*]\s*([^\n]+)/g) || prosSection[0].match(/\d+[.、]\s*([^\n]+)/g)
      if (proMatches) {
        proMatches.forEach(m => {
          const text = m.replace(/^[•\-\*\d\.\s、]+/, '').trim()
          if (text.length > 2) pros.push(text.slice(0, 50))
        })
      }
    }
    
    const consSection = content.match(/(不足|缺点|劣势|避雷|吐槽)[：:][\s\S]*?(?=优点|优势|建议|tips|$)/i)
    if (consSection) {
      const conMatches = consSection[0].match(/[•\-\*]\s*([^\n]+)/g) || consSection[0].match(/\d+[.、]\s*([^\n]+)/g)
      if (conMatches) {
        conMatches.forEach(m => {
          const text = m.replace(/^[•\-\*\d\.\s、]+/, '').trim()
          if (text.length > 2) cons.push(text.slice(0, 50))
        })
      }
    }
    
    const tipsSection = content.match(/(建议|贴士|提示|tips|实用信息)[：:][\s\S]*?$/i)
    if (tipsSection) {
      const tipMatches = tipsSection[0].match(/[•\-\*]\s*([^\n]+)/g) || tipsSection[0].match(/\d+[.、]\s*([^\n]+)/g)
      if (tipMatches) {
        tipMatches.forEach(m => {
          const text = m.replace(/^[•\-\*\d\.\s、]+/, '').trim()
          if (text.length > 2) tips.push(text.slice(0, 50))
        })
      }
    }
    
    if (pros.length > 0 || cons.length > 0 || tips.length > 0) {
      console.log(`从非结构化文本中提取口碑：优点${pros.length}条，不足${cons.length}条，建议${tips.length}条`)
      return {
        id: `review_${Date.now()}`,
        scenicName,
        summary: summary.trim(),
        pros: pros.length > 0 ? pros : ['整体体验不错'],
        cons: cons.length > 0 ? cons : ['有改进空间'],
        tips: tips.length > 0 ? tips : ['建议提前做好攻略'],
        sourceCount: 86,
        createdAt: new Date().toISOString(),
      }
    }
    
    throw new Error('AI返回格式解析失败')
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { scenicName, city, type } = body

  if (!scenicName) {
    return NextResponse.json(
      { error: '缺少景点名称' },
      { status: 400 }
    )
  }

  if (!VOLC_API_KEY) {
    return NextResponse.json(
      { error: 'API Key未配置' },
      { status: 500 }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false

      const keepAlive = setInterval(() => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(' '))
          } catch {
            // ignore
          }
        }
      }, 3000)

      try {
        const prompt = buildPrompt(scenicName, city, type)
        const aiResponse = await callDoubaoAPI(prompt)
        const review = parseAIResponse(aiResponse, scenicName)

        clearInterval(keepAlive)
        isClosed = true
        controller.enqueue(encoder.encode(JSON.stringify({ data: review })))
        controller.close()
      } catch (error: any) {
        console.error('查询口碑失败:', error)
        clearInterval(keepAlive)
        isClosed = true
        controller.enqueue(encoder.encode(JSON.stringify({
          error: error.message || '查询失败',
        })))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
