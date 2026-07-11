'use client'

import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import Card from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { getCurrentPlanId, getPlanById, savePlanToLocal } from '@/lib/storage'
import { getGeocode } from '@/lib/api'
import type { ItineraryItem, TravelPlan } from '@/types'

declare global {
  interface Window {
    AMap: any
    _amapInit: () => void
  }
}

const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || ''

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
  const cleaned = city.replace(/[省市]$/, '')
  if (cityCenters[cleaned]) return cleaned
  if (cityCenters[city]) return city
  return undefined
}

const generateMockCoords = (address: string, city?: string) => {
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

  const latOffset = ((hash % 1000) / 1000 - 0.5) * 0.02
  const lngOffset = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.02

  return {
    latitude: Number((baseLat + latOffset).toFixed(6)),
    longitude: Number((baseLng + lngOffset).toFixed(6)),
    formattedAddress: address,
    level: '兴趣点',
  }
}

function MapContent() {
  const searchParams = useSearchParams()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<TravelPlan | null>(null)
  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const markersRef = useRef<any[]>([])
  const [geocodingItem, setGeocodingItem] = useState<string | null>(null)
  const isGeocodingRef = useRef(false)
  const currentPlanRef = useRef<TravelPlan | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    const planId = getCurrentPlanId()
    if (planId) {
      const plan = getPlanById(planId)
      if (plan) {
        setCurrentPlan(plan)
        currentPlanRef.current = plan
      }
    }
  }, [])

  useEffect(() => {
    if (!AMAP_KEY) {
      setMapError(true)
      return
    }

    if (typeof window !== 'undefined' && window.AMap) {
      initMap()
      return
    }

    // 防止 StrictMode 重复加载：检查是否已有同名脚本
    const existingScript = document.querySelector(
      'script[src*="webapi.amap.com/maps"]'
    )
    if (existingScript) {
      // 脚本已在加载中，只设置 callback
      window._amapInit = () => {
        initMap()
      }
      return
    }

    window._amapInit = () => {
      initMap()
    }

    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&callback=_amapInit`
    script.async = true
    script.onerror = () => {
      setMapError(true)
    }
    document.head.appendChild(script)

    // 兜底：8秒后如果还没加载成功，显示错误
    const timeout = setTimeout(() => {
      if (!mapInstance.current) {
        setMapError(true)
      }
    }, 8000)

    return () => {
      clearTimeout(timeout)
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  const geocodeAddress = useCallback(async (address: string, city?: string): Promise<{
    latitude: number
    longitude: number
    formattedAddress: string
  }> => {
    try {
      const result = await getGeocode(address, city)
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        formattedAddress: result.formattedAddress,
      }
    } catch (e) {
      console.warn('API获取坐标失败，使用本地模拟数据:', e)
      return generateMockCoords(address, city)
    }
  }, [])

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.AMap) return

    mapInstance.current = new window.AMap.Map(mapRef.current, {
      zoom: 12,
      center: [116.4, 39.9],
      viewMode: '2D',
    })

    setMapLoaded(true)

    setTimeout(() => {
      if (mapInstance.current) {
        mapInstance.current.resize()
      }
    }, 100)
  }, [])

  const addMarkers = useCallback(() => {
    if (!mapInstance.current || !window.AMap || !currentPlan) return

    markersRef.current.forEach((marker) => marker.setMap(null))
    const newMarkers: any[] = []

    const validItems = currentPlan.items.filter(
      (item) => item.latitude && item.longitude
    )

    validItems.forEach((item, index) => {
      const color = getTypeColor(item.type)
      const marker = new window.AMap.Marker({
        position: [item.longitude, item.latitude],
        title: item.name,
        content: `
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: ${color};
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          ">
            ${index + 1}
          </div>
        `,
        offset: new window.AMap.Pixel(-16, -32),
      })

      marker.on('click', () => {
        setSelectedItem(item)
      })

      marker.setMap(mapInstance.current)
      newMarkers.push(marker)
    })

    markersRef.current = newMarkers
    setMarkers(newMarkers)

    if (validItems.length > 0) {
      const positions = validItems.map((item) => [item.longitude, item.latitude])
      mapInstance.current.setFitView(newMarkers, false, [50, 50, 50, 50])
    }
  }, [currentPlan])

  useEffect(() => {
    if (mapLoaded && mapInstance.current && currentPlan) {
      addMarkers()
    }
  }, [mapLoaded, currentPlan, addMarkers])

  useEffect(() => {
    if (!currentPlan || !mapLoaded) return
    if (isGeocodingRef.current) return

    isGeocodingRef.current = true

    const geocodeAll = async () => {
      const plan = currentPlanRef.current
      if (!plan) {
        isGeocodingRef.current = false
        return
      }

      const updatedItems = [...plan.items]
      let hasUpdates = false

      for (let i = 0; i < plan.items.length; i++) {
        const item = plan.items[i]
        try {
          setGeocodingItem(item.name)
          const result = await geocodeAddress(item.name, plan.destination)

          const itemIndex = updatedItems.findIndex((it) => it.id === item.id)
          if (itemIndex >= 0) {
            if (
              updatedItems[itemIndex].latitude !== result.latitude ||
              updatedItems[itemIndex].longitude !== result.longitude
            ) {
              updatedItems[itemIndex] = {
                ...updatedItems[itemIndex],
                latitude: result.latitude,
                longitude: result.longitude,
              }
              hasUpdates = true
            }
          }
        } catch (e: any) {
          console.error(`获取坐标失败: ${item.name}`, e)
        }

        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      setGeocodingItem(null)

      if (hasUpdates) {
        const updatedPlan = { ...plan, items: updatedItems }
        currentPlanRef.current = updatedPlan
        setCurrentPlan(updatedPlan)
        savePlanToLocal(updatedPlan)
      }

      isGeocodingRef.current = false
    }

    geocodeAll()
  }, [currentPlan, mapLoaded, geocodeAddress, showToast])

  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return

    const name = searchParams.get('name')
    const city = searchParams.get('city')
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    if (name) {
      if (lat && lng) {
        mapInstance.current.setZoomAndCenter(16, [parseFloat(lng), parseFloat(lat)])
        const plan = currentPlanRef.current
        const existingItem = plan?.items.find((item) => item.name === name)
        if (existingItem) {
          setSelectedItem(existingItem)
        }
      } else {
        setGeocodingItem(name)
        geocodeAddress(name, city || undefined)
          .then((result) => {
            if (!mapInstance.current) return
            mapInstance.current.setZoomAndCenter(16, [result.longitude, result.latitude])
            
            const plan = currentPlanRef.current
            if (plan) {
              const updatedItems = plan.items.map((item) =>
                item.name === name
                  ? { ...item, latitude: result.latitude, longitude: result.longitude }
                  : item
              )
              const updatedPlan = { ...plan, items: updatedItems }
              currentPlanRef.current = updatedPlan
              setCurrentPlan(updatedPlan)
              savePlanToLocal(updatedPlan)
              
              const locatedItem = updatedItems.find((item) => item.name === name)
              if (locatedItem) {
                setSelectedItem(locatedItem)
              }
            }
          })
          .catch((error) => {
            showToast(error.message || '定位失败', 'error')
          })
          .finally(() => {
            setGeocodingItem(null)
          })
      }
    }
  }, [mapLoaded, searchParams, geocodeAddress, showToast])

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      attraction: '#007AFF',
      food: '#FF9500',
      transport: '#34C759',
      hotel: '#AF52DE',
      other: '#8E8E93',
    }
    return colors[type] || '#007AFF'
  }

  const handleNavigate = (item: ItineraryItem) => {
    if (!item.latitude || !item.longitude) {
      showToast('正在获取坐标，请稍候...', 'warning')
      return
    }

    const url = `https://uri.amap.com/navigation?to=${item.longitude},${item.latitude},${encodeURIComponent(item.name)}&mode=car&src=qingtuai&coordinate=gaode`
    window.open(url, '_blank')
  }

  const handleCenterOnItem = (item: ItineraryItem) => {
    if (!mapInstance.current) return

    if (item.latitude && item.longitude) {
      mapInstance.current.setZoomAndCenter(15, [item.longitude, item.latitude])
      setSelectedItem(item)
    } else {
      showToast('正在获取坐标，请稍候...', 'warning')
    }
  }

  const days = currentPlan
    ? Array.from(new Set(currentPlan.items.map((i) => i.day))).sort((a, b) => a - b)
    : []

  const itemsWithCoords = currentPlan?.items.filter((i) => i.latitude && i.longitude).length || 0
  const totalItems = currentPlan?.items.length || 0

  return (
    <AppLayout>
      <div className="h-screen flex flex-col">
        <div className="flex-1 relative min-h-[300px] bg-surface-tertiary">
          <div ref={mapRef} className="absolute inset-0" />

          {mapError && currentPlan && (
            <div className="absolute inset-0 bg-surface-secondary">
              <svg className="w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5E7EB" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="400" height="300" fill="url(#grid)" />
                {currentPlan.items
                  .filter((item) => item.latitude && item.longitude)
                  .map((item, index) => {
                    const validItems = currentPlan.items.filter((i) => i.latitude && i.longitude)
                    const lats = validItems.map((i) => i.latitude!)
                    const lngs = validItems.map((i) => i.longitude!)
                    const minLat = Math.min(...lats)
                    const maxLat = Math.max(...lats)
                    const minLng = Math.min(...lngs)
                    const maxLng = Math.max(...lngs)
                    const latRange = maxLat - minLat || 0.1
                    const lngRange = maxLng - minLng || 0.1
                    const x = 40 + ((item.longitude! - minLng) / lngRange) * 320
                    const y = 260 - ((item.latitude! - minLat) / latRange) * 220
                    const color = getTypeColor(item.type)
                    return (
                      <g key={item.id} style={{ cursor: 'pointer' }} onClick={() => handleCenterOnItem(item)}>
                        <circle cx={x} cy={y} r="16" fill={color} stroke="white" strokeWidth="3" />
                        <text x={x} y={y + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                          {index + 1}
                        </text>
                        <text x={x} y={y - 22} textAnchor="middle" fill="#374151" fontSize="10">
                          {item.name.length > 8 ? item.name.slice(0, 8) + '...' : item.name}
                        </text>
                      </g>
                    )
                  })}
              </svg>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 rounded-lg px-3 py-2 text-xs text-text-tertiary">
                地图加载失败，显示点位示意图
              </div>
            </div>
          )}

          {mapError && !currentPlan && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-secondary">
              <div className="text-center px-8">
                <div className="w-16 h-16 bg-surface-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-text-primary font-medium mb-1">地图加载失败</p>
                <p className="text-sm text-text-tertiary">请检查网络或稍后重试</p>
              </div>
            </div>
          )}

          {!mapLoaded && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-secondary">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-surface-tertiary border-t-primary-500 rounded-full animate-spin mx-auto" />
                <p className="mt-3 text-sm text-text-secondary">地图加载中...</p>
              </div>
            </div>
          )}

          {geocodingItem && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 z-20">
              <div className="w-4 h-4 border-2 border-surface-tertiary border-t-primary-500 rounded-full animate-spin" />
              <span className="text-sm text-text-secondary">正在定位: {geocodingItem}</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-t-3xl shadow-lg -mt-6 relative z-10 flex-1 overflow-hidden flex flex-col">
          <div className="w-12 h-1 bg-surface-tertiary rounded-full mx-auto mt-3 mb-2" />
          
          <div className="px-5 pb-3">
            <h2 className="text-lg font-bold text-text-primary">
              {currentPlan ? `${currentPlan.destination} · 行程点位` : '暂无行程'}
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              {currentPlan 
                ? `已定位 ${itemsWithCoords}/${totalItems} 个点位${geocodingItem ? '（正在获取坐标...）' : ''}`
                : '先去生成行程吧'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6">
            {!currentPlan ? (
              <div className="text-center py-12">
                <p className="text-text-tertiary">暂无行程数据</p>
              </div>
            ) : (
              <div className="space-y-4">
                {days.map((day) => (
                  <div key={day}>
                    <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                      <span className="w-6 h-6 bg-primary-500 text-white rounded-md flex items-center justify-center text-xs">
                        D{day}
                      </span>
                      第 {day} 天
                    </h3>
                    <div className="space-y-2">
                      {currentPlan.items
                        .filter((item) => item.day === day)
                        .map((item, index) => (
                          <Card
                            key={item.id}
                            padding="sm"
                            hover
                            onClick={() => handleCenterOnItem(item)}
                            className={`transition-all duration-200 ${selectedItem?.id === item.id ? 'ring-2 ring-primary-500' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ backgroundColor: getTypeColor(item.type) }}
                              >
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-text-primary truncate">{item.name}</p>
                                <p className="text-xs text-text-tertiary truncate">
                                  {item.commuteFromPrev || '--'}
                                </p>
                              </div>
                              {item.latitude && item.longitude ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleNavigate(item)
                                  }}
                                  className="px-3 py-1.5 bg-primary-50 text-primary-500 text-xs font-medium rounded-lg active:bg-primary-100"
                                >
                                  导航
                                </button>
                              ) : (
                                <span className="px-2 py-1 bg-surface-tertiary text-text-tertiary text-xs rounded-md">
                                  定位中
                                </span>
                              )}
                            </div>
                          </Card>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">加载中...</div>}>
      <MapContent />
    </Suspense>
  )
}