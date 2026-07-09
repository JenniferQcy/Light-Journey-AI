// get_scenic_review - 小红书口碑AI汇总Edge Function
// 接收景点名称，调用豆包联网搜索，AI总结真实口碑

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-anonymous-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReviewInput {
  scenicName: string
  city?: string
  anonymousId: string
}

const DAILY_LIMIT_PER_SCENIC = 3
const CACHE_HOURS = 24

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { scenicName, city, anonymousId }: ReviewInput = await req.json()

    if (!scenicName) {
      return new Response(
        JSON.stringify({ error: '景点名称为必填' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const cacheCutoff = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString()
    const { data: cachedReview } = await supabase
      .from('scenic_reviews')
      .select('*')
      .eq('scenic_name', scenicName)
      .eq('city', city || '')
      .gte('created_at', cacheCutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cachedReview) {
      return new Response(
        JSON.stringify({
          success: true,
          data: cachedReview,
          fromCache: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const today = new Date().toISOString().split('T')[0]
    const rateLimitKey = `${anonymousId}_${scenicName}_${today}`

    const { data: rateCheck } = await supabase
      .from('scenic_reviews')
      .select('id')
      .gte('created_at', `${today}T00:00:00Z`)
      .limit(100)

    const userTodayCount = (rateCheck || []).filter(
      (_: any, i: number) => i < DAILY_LIMIT_PER_SCENIC
    ).length

    if (userTodayCount >= DAILY_LIMIT_PER_SCENIC) {
      return new Response(
        JSON.stringify({ 
          error: '该景点今日查询次数已达上限，请明天再来~',
          code: 'RATE_LIMITED'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const doubaoApiKey = Deno.env.get('DOUBAO_API_KEY')
    const doubaoEndpoint = Deno.env.get('DOUBAO_API_ENDPOINT') || 'https://ark.cn-beijing.volces.com/api/v3'
    const doubaoModel = Deno.env.get('DOUBAO_MODEL') || 'doubao-pro-32k'

    if (!doubaoApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI服务暂未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const locationContext = city ? `${city}的` : ''

    const prompt = `
请帮我搜索小红书上关于${locationContext}"${scenicName}"的真实游客评价，
然后客观汇总成一份口碑报告。

【要求】
1. 仅基于公开可查的真实用户评价
2. 过滤掉明显的广告和虚假种草内容
3. 客观中立，不夸大优点也不回避缺点
4. 总字数控制在200字以内
5. 只输出JSON格式，不要其他文字

【JSON格式】
{
  "summary": "一句话总体评价（30字内）",
  "pros": ["优点1", "优点2", "优点3"],
  "cons": ["缺点1", "缺点2"],
  "tips": ["避雷/建议1", "建议2"],
  "sourceCount": 5
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
          { role: 'system', content: '你是客观的旅游口碑分析师，善于从大量评价中提炼真实体验。输出严格JSON格式。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 1000,
        stream: false,
      }),
    })

    if (!aiResponse.ok) {
      return new Response(
        JSON.stringify({ error: '口碑查询失败，请稍后重试' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const aiData = await aiResponse.json()
    const content = aiData.choices?.[0]?.message?.content || ''

    let reviewData
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      reviewData = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      reviewData = null
    }

    if (!reviewData || !reviewData.summary) {
      reviewData = {
        summary: '该景点口碑数据暂不完整，建议多渠道了解',
        pros: ['暂无详细优点数据'],
        cons: ['暂无详细缺点数据'],
        tips: ['出行前建议查询官方信息'],
        sourceCount: 0,
      }
    }

    const { data: savedReview, error: saveError } = await supabase
      .from('scenic_reviews')
      .insert({
        scenic_name: scenicName,
        city: city || '',
        summary: reviewData.summary,
        pros: reviewData.pros || [],
        cons: reviewData.cons || [],
        tips: reviewData.tips || [],
        source_count: reviewData.sourceCount || 0,
      })
      .select()
      .single()

    if (saveError) console.error('Save review cache error:', saveError)

    return new Response(
      JSON.stringify({
        success: true,
        data: savedReview || reviewData,
        fromCache: false,
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
