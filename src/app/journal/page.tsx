'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Input, TextArea } from '@/components/ui/Input'
import TagSelector from '@/components/ui/TagSelector'
import { useToast } from '@/components/ui/Toast'
import { getJournalsFromLocal, saveJournalToLocal, getImagesFromLocal } from '@/lib/storage'
import type { TravelJournal, TravelImage } from '@/types'
import { v4 as uuidv4 } from 'uuid'

const tagOptions = [
  { value: 'food', label: '美食' },
  { value: 'scenery', label: '风景' },
  { value: 'culture', label: '人文' },
  { value: 'memo', label: '随记' },
]

export default function JournalPage() {
  const [journals, setJournals] = useState<TravelJournal[]>([])
  const [images, setImages] = useState<TravelImage[]>([])
  const [showEditor, setShowEditor] = useState(false)
  const [editingJournal, setEditingJournal] = useState<TravelJournal | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [showImagePicker, setShowImagePicker] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    setJournals(getJournalsFromLocal())
    setImages(getImagesFromLocal())
  }, [])

  const handleNewJournal = () => {
    setEditingJournal(null)
    setTitle('')
    setContent('')
    setSelectedTags([])
    setSelectedImageIds([])
    setShowEditor(true)
  }

  const handleEditJournal = (journal: TravelJournal) => {
    setEditingJournal(journal)
    setTitle(journal.title)
    setContent(journal.content)
    setSelectedTags(journal.tags)
    setSelectedImageIds(journal.images)
    setShowEditor(true)
  }

  const handleSave = () => {
    if (!title.trim()) {
      showToast('请输入标题', 'warning')
      return
    }

    const now = new Date().toISOString()

    if (editingJournal) {
      const updated: TravelJournal = {
        ...editingJournal,
        title: title.trim(),
        content,
        tags: selectedTags,
        images: selectedImageIds,
        updatedAt: now,
      }
      const newJournals = journals.map((j) => (j.id === updated.id ? updated : j))
      setJournals(newJournals)
      saveJournalToLocal(updated)
      showToast('游记已更新', 'success')
    } else {
      const newJournal: TravelJournal = {
        id: uuidv4(),
        planId: '',
        title: title.trim(),
        content,
        images: selectedImageIds,
        tags: selectedTags,
        createdAt: now,
        updatedAt: now,
      }
      const newJournals = [newJournal, ...journals]
      setJournals(newJournals)
      saveJournalToLocal(newJournal)
      showToast('游记已保存', 'success')
    }

    setShowEditor(false)
  }

  const handleDelete = (id: string) => {
    if (!confirm('确定要删除这篇游记吗？')) return
    const newJournals = journals.filter((j) => j.id !== id)
    setJournals(newJournals)
    localStorage.setItem('qingtu_journals', JSON.stringify(newJournals))
    showToast('游记已删除', 'success')
  }

  const toggleImageSelect = (imageId: string) => {
    if (selectedImageIds.includes(imageId)) {
      setSelectedImageIds(selectedImageIds.filter((id) => id !== imageId))
    } else {
      setSelectedImageIds([...selectedImageIds, imageId])
    }
  }

  const getImageById = (id: string) => images.find((img) => img.id === id)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">旅行游记</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {journals.length > 0 ? `${journals.length} 篇游记` : '记录美好旅途回忆'}
            </p>
          </div>
          <Button size="sm" onClick={handleNewJournal}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建
          </Button>
        </div>

        {journals.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-surface-tertiary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <p className="text-text-secondary mb-2">还没有游记</p>
            <p className="text-sm text-text-tertiary mb-6">用文字和图片记录旅途故事</p>
            <Button onClick={handleNewJournal}>开始记录</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {journals.map((journal) => (
              <Card
                key={journal.id}
                hover
                onClick={() => handleEditJournal(journal)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-text-primary flex-1">{journal.title}</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(journal.id)
                    }}
                    className="p-1.5 text-text-tertiary hover:text-error active:bg-red-50 rounded-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {journal.content && (
                  <p className="text-sm text-text-secondary line-clamp-2 mb-3">
                    {journal.content}
                  </p>
                )}

                {journal.images.length > 0 && (
                  <div className="flex gap-1.5 mb-3">
                    {journal.images.slice(0, 4).map((imgId) => {
                      const img = getImageById(imgId)
                      return img ? (
                        <div
                          key={imgId}
                          className="w-16 h-16 rounded-lg overflow-hidden bg-surface-tertiary flex-shrink-0"
                        >
                          <img src={img.compressedUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : null
                    })}
                    {journal.images.length > 4 && (
                      <div className="w-16 h-16 rounded-lg bg-surface-tertiary flex items-center justify-center text-text-tertiary text-sm font-medium">
                        +{journal.images.length - 4}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5 flex-wrap">
                    {journal.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-surface-secondary text-text-secondary text-xs rounded-full"
                      >
                        {tagOptions.find((o) => o.value === tag)?.label || tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-text-tertiary">{formatDate(journal.createdAt)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal
          isOpen={showEditor}
          onClose={() => setShowEditor(false)}
          title={editingJournal ? '编辑游记' : '新建游记'}
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setShowEditor(false)}>
                取消
              </Button>
              <Button fullWidth onClick={handleSave}>
                保存
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input
              label="标题"
              placeholder="给这篇游记起个标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <TextArea
              label="内容"
              placeholder="记录旅途的故事和感受..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-secondary">
                  配图 ({selectedImageIds.length})
                </label>
                {images.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowImagePicker(true)}
                    className="text-sm text-primary-500 font-medium"
                  >
                    选择图片
                  </button>
                )}
              </div>
              {selectedImageIds.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {selectedImageIds.map((imgId) => {
                    const img = getImageById(imgId)
                    return img ? (
                      <div key={imgId} className="relative">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-tertiary">
                          <img src={img.compressedUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                        <button
                          onClick={() => toggleImageSelect(imgId)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ) : null
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary">暂未选择图片</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">标签</label>
              <TagSelector options={tagOptions} value={selectedTags} onChange={setSelectedTags} />
            </div>
          </div>
        </Modal>

        <Modal isOpen={showImagePicker} onClose={() => setShowImagePicker(false)} title="选择图片">
          <div className="grid grid-cols-3 gap-1.5 max-h-96 overflow-y-auto">
            {images.map((img) => (
              <div
                key={img.id}
                onClick={() => toggleImageSelect(img.id)}
                className={`aspect-square rounded-lg overflow-hidden cursor-pointer relative ${
                  selectedImageIds.includes(img.id) ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                <img src={img.compressedUrl} alt="" className="w-full h-full object-cover" />
                {selectedImageIds.includes(img.id) && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setShowImagePicker(false)}>
              完成选择
            </Button>
          </div>
        </Modal>
      </div>
    </AppLayout>
  )
}
