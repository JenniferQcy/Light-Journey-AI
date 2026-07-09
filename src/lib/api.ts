import { TravelPlanInput, ItineraryItem, ScenicReview, TravelImage } from '@/types'
import { supabase } from '@/lib/supabase'

const STORAGE_BUCKET = 'travel-images'

const getAnonymousId = (): string => {
  if (typeof window === 'undefined') return ''
  const key = 'qingtu_anonymous_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
    localStorage.setItem(key, id)
  }
  return id
}

const getHeaders = (): HeadersInit => {
  return {
    'Content-Type': 'application/json',
    'x-anonymous-id': getAnonymousId(),
  }
}

const parseJsonSafe = async (response: Response): Promise<any> => {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch (e) {
    console.error('API返回非JSON格式:', {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      bodyPreview: text.slice(0, 200),
    })
    if (response.status === 504) {
      throw new Error('请求超时，AI生成行程需要较长时间，请重试')
    }
    throw new Error(`服务器返回了非JSON格式的响应（${response.status}），请稍后重试`)
  }
}

export const generateTravelPlan = async (input: TravelPlanInput): Promise<{ items: ItineraryItem[]; remaining: number }> => {
  try {
    const createRes = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(input),
    })

    const createData = await parseJsonSafe(createRes)
    if (!createRes.ok) {
      throw new Error(createData.error || '创建任务失败')
    }

    const taskId = createData.taskId
    const startTime = Date.now()
    const maxWaitTime = 180000

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const statusRes = await fetch(`/api/generate-plan?taskId=${taskId}`, {
        method: 'GET',
        headers: getHeaders(),
      })

      const statusData = await parseJsonSafe(statusRes)
      if (!statusRes.ok) {
        throw new Error(statusData.error || '查询任务状态失败')
      }

      if (statusData.status === 'completed') {
        return {
          items: statusData.items || [],
          remaining: 5,
        }
      }

      if (statusData.status === 'failed') {
        throw new Error(statusData.error || '生成失败')
      }
    }

    throw new Error('请求超时，请重试')
  } catch (error: any) {
    if (error.message === 'Failed to fetch') {
      throw new Error('网络连接失败，请检查网络后重试')
    }
    throw error
  }
}

export const getScenicReview = async (scenicName: string, city?: string): Promise<ScenicReview> => {
  const response = await fetch('/api/scenic-review', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      scenicName,
      city,
    }),
  })

  const data = await parseJsonSafe(response)

  if (!response.ok) {
    throw new Error(data.error || '查询失败')
  }

  return data.data
}

export const uploadImage = async (
  file: Blob,
  fileName: string,
  planId?: string,
  isCompressed: boolean = true
): Promise<string> => {
  const anonymousId = getAnonymousId()
  const ext = fileName.split('.').pop() || 'jpg'
  const prefix = isCompressed ? 'compressed' : 'original'
  const path = `${anonymousId}/${planId || 'no-plan'}/${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',
    })

  if (error) {
    throw new Error(error.message || '上传失败')
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path)

  return urlData.publicUrl
}

export const getPublicImageUrl = (bucket: string, path: string): string => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`
}

export const getGeocode = async (address: string, city?: string): Promise<{
  latitude: number
  longitude: number
  formattedAddress: string
  level: string
}> => {
  const response = await fetch('/api/geocode', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      address,
      city,
    }),
  })

  const data = await parseJsonSafe(response)

  if (!response.ok) {
    throw new Error(data.error || '获取坐标失败')
  }

  return data.data
}
