import React, { useState, useEffect } from 'react'
import { fetchAllTodos } from '../lib/db'

interface TodoRow { id: string; project_id: string; task: string; owner: string; due_date: string | null; done: boolean; project_name: string }

export default function TodosPage({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const [todos, setTodos] = useState<TodoRow[]>([])
  const [filter, setFilter] = useState<'all' | 'open' | 'overdue' | 'done'>('open')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const data = await fetchAllTodos()
      setTodos(data as TodoRow[])
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = (t: TodoRow) => !t.done && t.due_date && t.due_date < today
  const visible = todos.filter(t => {
    if (filter === 'all') return true
    if (filter === 'done') return t.done
    if (filter === 'overdue') return isOverdue(t)
    if (filter === 'open') return !t.done
    return true
  })
  const openCount = todos.filter(t => !t.done).length
  const overdueCount = todos.filter(isOverdue).length

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>我的待办</h2>
        <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#6b6b65' }}>
          <span style={{ padding: '3px 10px', borderRadius: 12, background: '#f2f1ec' }}>进行中 {openCount}</span>
          <span style={{ padding: '3px 10px', borderRadius: 12, background: '#fdf3f3', color: '#b54545' }}>逾期 {overdueCount}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['open', '进行中'], ['overdue', '逾期'], ['all', '全部'], ['done', '已完成']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', background: filter === k ? '#3b5b9b' : '#fff', color: filter === k ? '#fff' : '#6b6b65', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>{label}</button>
        ))}
      </div>

      {loading ? <p style={{ color: '#6b6b65' }}>加载中...</p> :
        visible.length === 0 ? <p style={{ color: '#6b6b65', fontSize: 13 }}>暂无待办</p> :
          visible.map(t => {
            const overdue = isOverdue(t)
            return (
              <div key={t.id} onClick={() => onOpenProject(t.project_id)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 8, padding: '10px 14px', marginBottom: 8, border: '1px solid #e8e5df', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.done ? '#4a7c59' : overdue ? '#b54545' : '#9a6b2e', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? '#9a978f' : '#1a1a18' }}>{t.task}</div>
                  <div style={{ fontSize: 12, color: '#9a978f', marginTop: 2 }}>📁 {t.project_name}</div>
                </div>
                {t.owner && <span style={{ fontSize: 12, color: '#6b6b65' }}>{t.owner}</span>}
                {t.due_date && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: t.done ? '#eef5f0' : overdue ? '#fdf3f3' : t.due_date === today ? '#fdf8f0' : '#f2f1ec', color: t.done ? '#4a7c59' : overdue ? '#b54545' : t.due_date === today ? '#9a6b2e' : '#6b6b65', fontWeight: overdue || t.due_date === today ? 600 : 400 }}>{t.due_date}{overdue ? ' 逾期' : t.due_date === today ? ' 今日' : ''}</span>}
              </div>
            )
          })
      }
    </div>
  )
}
