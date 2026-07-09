import type { ItineraryItem } from '@/types'

interface GenerateTask {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  items?: ItineraryItem[]
  error?: string
  createdAt: number
}

const globalKey = Symbol.for('qingtu_task_store')

function getTasks(): Map<string, GenerateTask> {
  const g = globalThis as any
  if (!g[globalKey]) {
    g[globalKey] = new Map<string, GenerateTask>()

    setInterval(() => {
      const now = Date.now()
      const TASK_TTL = 10 * 60 * 1000
      for (const [id, task] of g[globalKey]) {
        if (now - task.createdAt > TASK_TTL) {
          g[globalKey].delete(id)
        }
      }
    }, 60 * 1000)
  }
  return g[globalKey]
}

export function createTask(): string {
  const tasks = getTasks()
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  tasks.set(id, {
    id,
    status: 'pending',
    createdAt: Date.now(),
  })
  return id
}

export function getTask(id: string): GenerateTask | undefined {
  return getTasks().get(id)
}

export function updateTask(id: string, updates: Partial<GenerateTask>) {
  const tasks = getTasks()
  const task = tasks.get(id)
  if (task) {
    tasks.set(id, { ...task, ...updates })
  }
}
