// generate_travel_plan - AI行程生成Edge Function
// 接收用户表单参数，调用豆包大模型返回结构化行程JSON

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-anonymous-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PlanInput {
  destination: string
  days: number
  peopleCount: number
  budgetLevel: 'budget' | 'normal' | 'comfortable'
  preferences: string[]
  anonymousId: string
}

const DAILY_LIMIT = 10

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { destination, days, peopleCount, budgetLevel, preferences, anonymousId }: PlanInput = await req.json()

    if (!destination || !days || days < 1 || days > 15) {
      return new Response(
        JSON.stringify({ error: '参数无效：目的地和天数（1-15天）为必填' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const today = new Date().toISOString().split('T')[0]
    const { count, error: countError } = await supabase
      .from('travel_plans')
      .select('id', { count: 'exact', head: true })
      .eq('anonymous_id', anonymousId)
      .gte('created_at', `${today}T00:00:00Z`)

    if (countError) throw countError

    if ((count || 0) >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ error: '今日生成次数已用完，请明天再来~', code: 'RATE_LIMITED' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const doubaoApiKey = Deno.env.get('DOUBAO_API_KEY')
    const doubaoEndpoint = Deno.env.get('DOUBAO_API_ENDPOINT') || 'https://ark.cn-beijing.volces.com/api/v3'
    const doubaoModel = Deno.env.get('DOUBAO_MODEL') || 'doubao-pro-32k'

    if (!doubaoApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI服务暂未配置，请稍后再试' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const budgetText = {
      budget: '穷游（极致省钱，青旅/快餐/公共交通为主）',
      normal: '平价（经济酒店/普通餐厅/公共交通+打车混合）',
      comfortable: '舒适（中高端酒店/特色餐厅/打车为主）',
    }[budgetLevel]

    const prefText = preferences.length > 0 ? preferences.join('、') : '综合均衡'

    const prompt = `
你是一个专业的旅行规划师。请根据以下信息生成一份结构化的旅行行程表。

【用户需求】
目的地城市：${destination}
出行天数：${days}天
出行人数：${peopleCount}人
预算档位：${budgetText}
出行偏好：${prefText}

【输出要求】
1. 只输出纯JSON格式，不要任何其他文字说明
2. 行程必须是真实存在的景点、餐厅、酒店，禁止虚构
3. 每天分为上午、下午、傍晚、晚上四个时段
4. 每个点位包含以下字段：
   - day: 天数（数字，从1开始）
   - period: 时段（morning/afternoon/evening/night）
   - type: 类型（attraction景点/food餐饮/transport交通/hotel住宿/other其他）
   - name: 名称
   - businessInfo: 营业/门票信息（真实价格和时间）
   - costEstimate: 消费标准（人均金额）
   - commuteFromPrev: 上一站通勤时长（如"步行10分钟"、"地铁20分钟"）
   - reviewSummary: 一句话口碑摘要（20字内）
   - address: 详细地址
   - latitude: 纬度（数字）
   - longitude: 经度（数字）
5. 行程安排要合理，时间衔接要自然，不要太赶
6. 包含餐饮、交通、住宿等必要安排
7. 严格基于真实数据，不要编造不存在的地点

【JSON格式示例】
{
  "items": [
    {
      "day": 1,
      "period": "morning",
      "type": "attraction",
      "name": "故宫博物院",
      "businessInfo": "旺季60元/人，8:30-17:00",
      "costEstimate": "60元/人",
      "commuteFromPrev": "起点",
      "reviewSummary": "必打卡，建议提前预约",
      "address": "北京市东城区景山前街4号",
      "latitude": 39.9163,
      "longitude": 116.3972
    }
  ]
}
`

    const aiResponse = await fetch(`${doubaoEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doubaoApiKey}`,
      },
      body: JSON.stringify({
        model: doubaoModel,
        messages: [
          { role: 'system', content: '你是专业的旅行规划师，输出严格的JSON格式，基于真实数据。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error('AI API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'AI生成失败，请稍后重试' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const aiData = await aiResponse.json()
    const content = aiData.choices?.[0]?.message?.content || ''

    let planData
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      planData = jsonMatch ? JSON.parse(jsonMatch[0]) : { items: [] }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      planData = generateFallbackPlan(destination, days, budgetLevel)
    }

    const itemsWithId = (planData.items || []).map((item: any, index: number) => ({
      id: `item_${Date.now()}_${index}`,
      ...item,
    }))

    return new Response(
      JSON.stringify({
        success: true,
        items: itemsWithId,
        remaining: DAILY_LIMIT - (count || 0) - 1,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: '服务器错误，请稍后重试' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generateFallbackPlan(destination: string, days: number, budgetLevel: string) {
  const items: any[] = []
  const budgetMultiplier = budgetLevel === 'budget' ? 0.6 : budgetLevel === 'comfortable' ? 1.5 : 1

  for (let day = 1; day <= days; day++) {
    items.push(
      {
        day,
        period: 'morning',
        type: 'attraction',
        name: `${destination}主要景点${day}A`,
        businessInfo: '约80元/人，9:00-17:00',
        costEstimate: `${Math.round(80 * budgetMultiplier)}元/人`,
        commuteFromPrev: day === 1 ? '起点' : '步行15分钟',
        reviewSummary: '人气景点，值得一去',
        address: `${destination}市区`,
        latitude: 39.9,
        longitude: 116.4,
      },
      {
        day,
        period: 'afternoon',
        type: 'food',
        name: `${destination}特色餐厅${day}`,
        businessInfo: '10:00-21:00',
        costEstimate: `${Math.round(80 * budgetMultiplier)}元/人`,
        commuteFromPrev: '步行10分钟',
        reviewSummary: '当地特色，口碑不错',
        address: `${destination}美食街`,
        latitude: 39.91,
        longitude: 116.41,
      },
      {
        day,
        period: 'evening',
        type: 'attraction',
        name: `${destination}主要景点${day}B`,
        businessInfo: '免费开放，全天',
        costEstimate: '免费',
        commuteFromPrev: '打车15分钟',
        reviewSummary: '适合傍晚散步',
        address: `${destination}滨江路`,
        latitude: 39.92,
        longitude: 116.42,
      },
      {
        day,
        period: 'night',
        type: 'hotel',
        name: `${destination}市区酒店`,
        businessInfo: `${budgetLevel === 'budget' ? '青旅' : budgetLevel === 'comfortable' ? '四星酒店' : '快捷酒店'}`,
        costEstimate: `${Math.round((budgetLevel === 'budget' ? 80 : budgetLevel === 'comfortable' ? 500 : 250) * budgetMultiplier)}元/晚`,
        commuteFromPrev: '步行5分钟',
        reviewSummary: '交通便利，干净整洁',
        address: `${destination}市中心`,
        latitude: 39.905,
        longitude: 116.405,
      }
    )
  }

  return { items }
}
