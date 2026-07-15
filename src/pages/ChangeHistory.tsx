import React, { useState, useEffect, useCallback } from 'react'
import { fetchProjects, fetchAllActivities } from '../lib/db'
import { getFieldByKey } from '../lib/fieldConfig'

interface Props { onBack: () => void }

// 全部历史编辑记录：聚合 change_log，按时间倒序展示；分页加载（每次 50 条），编辑量持续增长无压力
export default function ChangeHistory({ onBack }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [limit, setLimit] = useState(50)
  const [loading, setLoading] = useState(true)
  const [projectNames, setProjectNames] = useState<Record<string, string>>({})

  const load = useCallback(async (lim: number) => {
    setLoading(true)
    try {
      const [projs, acts] = await Promise.all([fetchProjects(), fetchAllActivities(lim)])
      const map: Record<string, string> = {}
      ;(projs as any[]).forEach(p => { map[p.id] = p.name })
      setProjectNames(map)
      setRows(acts as any[])
    } catch (e) {
      console.warn('历史编辑记录加载失败（change_log 表可能尚未创建）：', e)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(limit) }, [limit, load])

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#2C2C2A' }}>全部历史编辑记录</h2>
        <button onClick={onBack}
          style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #E3E3E0', background: '#fff', color: '#5F5E5A', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
          ← 返回目录
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#888780', padding: 24, fontSize: 13 }}>加载中...</div>
      ) : rows.length === 0 ? (
        <div style={{ color: '#888780', padding: 24, fontSize: 13 }}>暂无编辑记录</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 2px rgba(16,24,40,0.06)', border: '1px solid #E3E3E0', overflow: 'hidden' }}>
          {rows.map((c, i) => (
            <div key={c.id || i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '10px 16px', borderBottom: i < rows.length - 1 ? '1px solid #F0EEE8' : 'none', fontSize: 13 }}>
              <span style={{ color: '#b5b0a6', flexShrink: 0, fontFamily: '"SF Mono","Consolas",monospace', fontSize: 12 }}>
                {new Date(c.at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ color: '#6b6b65', flexShrink: 0, minWidth: 48 }}>{c.by}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ color: '#2C2C2A' }}>{projectNames[c.project_id] || '未知项目'}</b>
                <span style={{ color: '#9a978f' }}> · {getFieldByKey(c.field)?.label || c.field}：{c.old_value || '空'} → {c.new_value || '空'}</span>
              </span>
            </div>
          ))}
          <div style={{ padding: 12, textAlign: 'center' }}>
            <button onClick={() => setLimit(l => l + 50)}
              style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E3E3E0', background: '#fff', color: '#185FA5', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
              加载更多
            </button>
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, color: '#9a978f', marginTop: 12, lineHeight: 1.6 }}>
        说明：所有字段修改均自动记录于此。Supabase 数据库可稳定承载大量记录，编辑量持续增长不存在存储或性能压力——本页仅按 50 条分页加载，不会一次性拉取全部数据。
      </p>
    </div>
  )
}
