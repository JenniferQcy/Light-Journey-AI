// upload_image_auth - 图片上传鉴权Edge Function
// 生成Supabase存储上传签名，限制文件大小和每日额度

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-anonymous-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface AuthInput {
  anonymousId: string
  fileName: string
  fileSize: number
  planId?: string
  mode: 'compressed_only' | 'both'
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const DAILY_LIMIT_MB = 100 // 每天100MB

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { anonymousId, fileName, fileSize, planId, mode }: AuthInput = await req.json()

    if (!anonymousId || !fileName || !fileSize) {
      return new Response(
        JSON.stringify({ error: '参数不完整' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (fileSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: '文件过大，单张图片不能超过20MB' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const today = new Date().toISOString().split('T')[0]
    const { data: todayImages } = await supabase
      .from('travel_images')
      .select('compressed_size, file_size')
      .eq('anonymous_id', anonymousId)
      .gte('uploaded_at', `${today}T00:00:00Z`)

    const dailyUsedBytes = (todayImages || []).reduce((sum: number, img: any) => {
      return sum + (img.compressed_size || 0) + (img.file_size || 0)
    }, 0)

    const dailyLimitBytes = DAILY_LIMIT_MB * 1024 * 1024
    const estimatedTotal = mode === 'both' ? fileSize * 1.2 : fileSize * 0.5

    if (dailyUsedBytes + estimatedTotal > dailyLimitBytes) {
      const remainingMB = Math.max(0, (dailyLimitBytes - dailyUsedBytes) / (1024 * 1024)).toFixed(1)
      return new Response(
        JSON.stringify({ 
          error: `今日上传额度不足，剩余${remainingMB}MB`,
          code: 'QUOTA_EXCEEDED'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const bucket = Deno.env.get('STORAGE_BUCKET') || 'travel-photos'
    const timestamp = Date.now()
    const randomId = crypto.randomUUID().slice(0, 8)
    const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg'

    const compressedPath = `${anonymousId}/${planId || 'uncategorized'}/${timestamp}_${randomId}_compressed.${ext}`

    const { data: signedCompressed, error: signError1 } = await supabase
      .storage
      .from(bucket)
      .createSignedUploadUrl(compressedPath)

    if (signError1) throw signError1

    let originalSignedUrl = null
    let originalPath = null

    if (mode === 'both') {
      originalPath = `${anonymousId}/${planId || 'uncategorized'}/${timestamp}_${randomId}_original.${ext}`
      const { data: signedOriginal, error: signError2 } = await supabase
        .storage
        .from(bucket)
        .createSignedUploadUrl(originalPath)

      if (signError2) {
        console.warn('Original signed URL error:', signError2)
      } else {
        originalSignedUrl = signedOriginal.signedUrl
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        compressed: {
          path: compressedPath,
          signedUrl: signedCompressed.signedUrl,
        },
        original: originalSignedUrl ? {
          path: originalPath,
          signedUrl: originalSignedUrl,
        } : null,
        bucket,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: '鉴权失败，请稍后重试' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
