'use client'

import { useState, useRef, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import TagSelector from '@/components/ui/TagSelector'
import { useToast } from '@/components/ui/Toast'
import { compressImage, formatFileSize } from '@/lib/imageCompress'
import { uploadImage } from '@/lib/api'
import { getImagesFromLocal, saveImagesToLocal, getCurrentPlanId } from '@/lib/storage'
import type { TravelImage } from '@/types'
import { v4 as uuidv4 } from 'uuid'

const tagOptions = [
  { value: 'food', label: '美食' },
  { value: 'scenery', label: '风景' },
  { value: 'culture', label: '人文' },
  { value: 'people', label: '人像' },
]

export default function PhotosPage() {
  const [images, setImages] = useState<TravelImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadMode, setUploadMode] = useState<'compressed_only' | 'both'>('compressed_only')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<TravelImage | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [originalSize, setOriginalSize] = useState(0)
  const [compressedSize, setCompressedSize] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  useEffect(() => {
    const savedImages = getImagesFromLocal()
    setImages(savedImages)
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]

    if (file.size > 20 * 1024 * 1024) {
      showToast('单张图片不能超过20MB', 'error')
      return
    }

    setOriginalSize(file.size)
    setPreviewUrl(URL.createObjectURL(file))
    setShowUploadModal(true)

    try {
      const compressedBlob = await compressImage(file)
      setCompressedSize(compressedBlob.size)
    } catch (error) {
      showToast('图片压缩失败', 'error')
    }
  }

  const handleUpload = async () => {
    if (!fileInputRef.current?.files?.[0]) return

    const file = fileInputRef.current.files[0]
    const planId = getCurrentPlanId() || undefined

    setUploading(true)
    try {
      const compressedBlob = await compressImage(file)

      const compressedUrl = await uploadImage(compressedBlob, file.name, planId, true)

      let originalUrl = undefined
      if (uploadMode === 'both') {
        try {
          originalUrl = await uploadImage(file, file.name, planId, false)
        } catch (err) {
          console.warn('原图上传失败，仅保存压缩图')
        }
      }

      const newImage: TravelImage = {
        id: uuidv4(),
        planId: planId || '',
        fileName: file.name,
        compressedUrl,
        originalUrl,
        size: file.size,
        compressedSize: compressedBlob.size,
        uploadedAt: new Date().toISOString(),
        tags: [],
      }

      const newImages = [newImage, ...images]
      setImages(newImages)
      saveImagesToLocal(newImages)

      const savedPercent = Math.round((1 - compressedBlob.size / file.size) * 100)
      showToast(`上传成功！节省了 ${savedPercent}% 空间`, 'success')

      setShowUploadModal(false)
      setPreviewUrl('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: any) {
      showToast(error.message || '上传失败，请重试', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = (id: string) => {
    if (!confirm('确定要删除这张图片吗？')) return
    const newImages = images.filter((img) => img.id !== id)
    setImages(newImages)
    saveImagesToLocal(newImages)
    showToast('图片已删除', 'success')
    setSelectedImage(null)
  }

  const handleDeleteOriginal = (id: string) => {
    if (!confirm('确定要删除手机原图释放内存吗？')) return
    showToast('已从相册删除原图（演示）', 'success')
  }

  const groupedImages = images.reduce((acc, img) => {
    const date = new Date(img.uploadedAt).toLocaleDateString('zh-CN')
    if (!acc[date]) acc[date] = []
    acc[date].push(img)
    return acc
  }, {} as Record<string, TravelImage[]>)

  const totalSaved = images.reduce((sum, img) => sum + (img.size - img.compressedSize), 0)

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">旅行素材</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {images.length > 0 ? `共 ${images.length} 张 · 已节省 ${formatFileSize(totalSaved)}` : '压缩图片，释放手机内存'}
            </p>
          </div>
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            上传
          </Button>
        </div>

        <Card className="mb-6 ai-gradient-bg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-text-primary">智能压缩存储</p>
              <p className="text-xs text-text-secondary mt-0.5">
                本地Canvas压缩 · 画质75% · 体积减少60%-80%
              </p>
            </div>
          </div>
        </Card>

        {images.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-surface-tertiary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-text-secondary mb-2">还没有上传图片</p>
            <p className="text-sm text-text-tertiary mb-6">上传旅行照片，智能压缩节省空间</p>
            <Button onClick={() => fileInputRef.current?.click()}>
              开始上传
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedImages).map(([date, imgs]) => (
              <div key={date}>
                <p className="text-sm font-medium text-text-secondary mb-3">{date}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {imgs.map((img) => (
                    <div
                      key={img.id}
                      className="aspect-square rounded-xl overflow-hidden bg-surface-tertiary cursor-pointer active:opacity-80 transition-opacity"
                      onClick={() => setSelectedImage(img)}
                    >
                      <img
                        src={img.compressedUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        <Modal
          isOpen={showUploadModal}
          onClose={() => !uploading && setShowUploadModal(false)}
          title="上传图片"
          footer={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
              >
                取消
              </Button>
              <Button fullWidth loading={uploading} onClick={handleUpload}>
                确认上传
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {previewUrl && (
              <div className="aspect-video rounded-xl overflow-hidden bg-surface-tertiary">
                <img src={previewUrl} alt="" className="w-full h-full object-contain" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-surface-secondary rounded-xl">
                <p className="text-xs text-text-tertiary">原图大小</p>
                <p className="font-semibold text-text-primary mt-1">{formatFileSize(originalSize)}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <p className="text-xs text-text-tertiary">压缩后</p>
                <p className="font-semibold text-success mt-1">
                  {compressedSize > 0 ? formatFileSize(compressedSize) : '--'}
                </p>
              </div>
            </div>

            {originalSize > 0 && compressedSize > 0 && (
              <p className="text-center text-sm text-text-secondary">
                预计节省 <span className="text-success font-medium">
                  {Math.round((1 - compressedSize / originalSize) * 100)}%
                </span> 存储空间
              </p>
            )}

            <div>
              <p className="text-sm font-medium text-text-secondary mb-2">存储模式</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-surface-tertiary rounded-xl cursor-pointer active:bg-surface-secondary">
                  <input
                    type="radio"
                    name="mode"
                    checked={uploadMode === 'compressed_only'}
                    onChange={() => setUploadMode('compressed_only')}
                    className="w-4 h-4 text-primary-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-text-primary text-sm">仅存压缩图</p>
                    <p className="text-xs text-text-tertiary">最大程度节省空间</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-surface-tertiary rounded-xl cursor-pointer active:bg-surface-secondary">
                  <input
                    type="radio"
                    name="mode"
                    checked={uploadMode === 'both'}
                    onChange={() => setUploadMode('both')}
                    className="w-4 h-4 text-primary-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-text-primary text-sm">原图+压缩图双备份</p>
                    <p className="text-xs text-text-tertiary">保留原图质量</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          title="图片详情"
        >
          {selectedImage && (
            <div className="space-y-4">
              <div className="aspect-square rounded-xl overflow-hidden bg-black">
                <img
                  src={selectedImage.compressedUrl}
                  alt=""
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-surface-secondary rounded-xl">
                  <p className="text-xs text-text-tertiary">原图</p>
                  <p className="font-medium text-text-primary mt-1 text-sm">
                    {formatFileSize(selectedImage.size)}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl">
                  <p className="text-xs text-text-tertiary">压缩后</p>
                  <p className="font-medium text-success mt-1 text-sm">
                    {formatFileSize(selectedImage.compressedSize)}
                  </p>
                </div>
              </div>

              <p className="text-center text-sm text-text-secondary">
                已节省 <span className="text-success font-medium">
                  {Math.round((1 - selectedImage.compressedSize / selectedImage.size) * 100)}%
                </span> 空间
              </p>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleDeleteOriginal(selectedImage.id)}
                  className="w-full py-3 text-primary-500 font-medium text-sm bg-primary-50 rounded-xl active:bg-primary-100"
                >
                  🗑️ 删除手机原图释放内存
                </button>
                <button
                  onClick={() => handleDelete(selectedImage.id)}
                  className="w-full py-3 text-error font-medium text-sm bg-red-50 rounded-xl active:bg-red-100"
                >
                  删除云端图片
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppLayout>
  )
}
