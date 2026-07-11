import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || ''
const AMAP_GEOCODE_URL = 'https://restapi.amap.com/v3/geocode/geo'
const AMAP_POI_URL = 'https://restapi.amap.com/v3/place/text'

const cityCenters: Record<string, { lat: number; lng: number }> = {
  '北京': { lat: 39.9042, lng: 116.4074 },
  '上海': { lat: 31.2304, lng: 121.4737 },
  '广州': { lat: 23.1291, lng: 113.2644 },
  '深圳': { lat: 22.5431, lng: 114.0579 },
  '杭州': { lat: 30.2741, lng: 120.1551 },
  '成都': { lat: 30.5728, lng: 104.0668 },
  '西安': { lat: 34.3416, lng: 108.9398 },
  '南京': { lat: 32.0603, lng: 118.7969 },
  '武汉': { lat: 30.5928, lng: 114.3055 },
  '重庆': { lat: 29.4316, lng: 106.9123 },
  '天津': { lat: 39.0842, lng: 117.2009 },
  '苏州': { lat: 31.2989, lng: 120.5853 },
  '厦门': { lat: 24.4798, lng: 118.0894 },
  '青岛': { lat: 36.0671, lng: 120.3826 },
  '大连': { lat: 38.9140, lng: 121.6147 },
  '长沙': { lat: 28.2282, lng: 112.9388 },
  '三亚': { lat: 18.2528, lng: 109.5120 },
  '昆明': { lat: 25.0389, lng: 102.7183 },
  '桂林': { lat: 25.2738, lng: 110.2901 },
  '丽江': { lat: 26.8552, lng: 100.2270 },
}

const normalizeCity = (city?: string): string | undefined => {
  if (!city) return undefined
  // 去掉"市"后缀进行匹配
  const cleaned = city.replace(/[省市]$/, '')
  if (cityCenters[cleaned]) return cleaned
  if (cityCenters[city]) return city
  return undefined
}

const generateMockCoords = (address: string, city?: string) => {
  // 默认北京，与前端 mock 保持一致
  let baseLat = 39.9042
  let baseLng = 116.4074

  const matchedCity = normalizeCity(city)
  if (matchedCity) {
    baseLat = cityCenters[matchedCity].lat
    baseLng = cityCenters[matchedCity].lng
  }

  let hash = 0
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) - hash) + address.charCodeAt(i)
    hash = hash & hash
  }

  // 缩小偏移范围：±0.01° ≈ ±1km，模拟数据更合理
  const latOffset = ((hash % 1000) / 1000 - 0.5) * 0.02
  const lngOffset = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.02

  return {
    latitude: Number((baseLat + latOffset).toFixed(6)),
    longitude: Number((baseLng + lngOffset).toFixed(6)),
  }
}

function cleanAddress(address: string): string {
  return address
    .replace(/[（(]([^）)]*)[）)]/g, ' $1 ')  // 中文括号转空格分隔纯文本
    .replace(/\s+/g, ' ')                       // 合并多余空格
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, city } = body

    if (!address) {
      return NextResponse.json(
        { error: '缺少地址参数' },
        { status: 400 }
      )
    }

    if (!AMAP_KEY) {
      console.warn('[Geocode] 未配置 AMAP_KEY，使用模拟坐标')
      const mockCoords = generateMockCoords(address, city)
      return NextResponse.json({
        data: {
          latitude: mockCoords.latitude,
          longitude: mockCoords.longitude,
          formattedAddress: address,
          level: '兴趣点',
        }
      })
    }

    // 清理地址：括号内容展开为纯文本，提高搜索准确率
    const searchedAddress = cleanAddress(address)

    let result: {
      latitude: number
      longitude: number
      formattedAddress: string
      level: string
    } | null = null

    try {
      // 策略1：POI 搜索 — 更适合查酒店、餐厅、景点等具体商户
      const poiParams = new URLSearchParams({
        keywords: searchedAddress,
        key: AMAP_KEY,
        offset: '1',
      })
      if (city) {
        poiParams.append('city', city)
      }

      const poiResponse = await fetch(`${AMAP_POI_URL}?${poiParams.toString()}`, {
        signal: AbortSignal.timeout(5000),
      })
      const poiData = await poiResponse.json()

      if (poiData.status === '1' && poiData.pois && poiData.pois.length > 0) {
        const poi = poiData.pois[0]
        const [longitude, latitude] = poi.location.split(',').map(Number)
        result = {
          latitude,
          longitude,
          formattedAddress: poi.name,
          level: poi.type || '兴趣点',
        }
        console.log(`[POI] ✅ 成功: "${searchedAddress}" → "${poi.name}" [${longitude}, ${latitude}]`)
      }
    } catch (e) {
      console.warn(`[POI] 搜索异常: "${searchedAddress}"`, e)
    }

    // 策略2：POI 没找到则降级到地理编码
    if (!result) {
      try {
        const geocodeParams = new URLSearchParams({
          address: searchedAddress,
          key: AMAP_KEY,
        })
        if (city) {
          geocodeParams.append('city', city)
        }

        const geoResponse = await fetch(`${AMAP_GEOCODE_URL}?${geocodeParams.toString()}`, {
          signal: AbortSignal.timeout(5000),
        })
        const geoData = await geoResponse.json()

        if (geoData.status === '1' && geoData.geocodes && geoData.geocodes.length > 0) {
          const location = geoData.geocodes[0].location
          const [longitude, latitude] = location.split(',').map(Number)
          result = {
            latitude,
            longitude,
            formattedAddress: geoData.geocodes[0].formatted_address,
            level: geoData.geocodes[0].level,
          }
          console.log(`[Geocode] ✅ 成功: "${searchedAddress}" → [${longitude}, ${latitude}] (${result.formattedAddress})`)
        } else {
          console.warn(`[Geocode] ⚠️ 返回异常 (status=${geoData.status}, info=${geoData.info}), 地址="${searchedAddress}"`)
        }
      } catch (e) {
        console.warn(`[Geocode] ❌ 网络错误, 地址="${searchedAddress}":`, e)
      }
    }

    // 策略3：两路都没结果，降级为模拟坐标
    if (!result) {
      const mockCoords = generateMockCoords(address, city)
      result = {
        latitude: mockCoords.latitude,
        longitude: mockCoords.longitude,
        formattedAddress: address,
        level: '兴趣点',
      }
      console.warn(`[Mock] 降级为模拟坐标: "${address}"`)
    }

    return NextResponse.json({ data: result })
  } catch (error: any) {
    console.error('地理编码失败:', error)
    return NextResponse.json(
      { error: error.message || '地理编码失败' },
      { status: 500 }
    )
  }
}
