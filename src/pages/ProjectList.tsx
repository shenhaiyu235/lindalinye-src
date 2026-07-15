import React, { useState, useMemo, useEffect } from 'react'
import { Project } from '../lib/types'
import { fetchAllTodos, fetchAllMemos, fetchAllActivities } from '../lib/db'
import { displaySeq, phaseRank } from '../lib/fieldConfig'

interface TodoRow { id: string; project_id: string; task: string; owner: string; due_date: string | null; done: boolean; project_name: string }
interface MemoRow { id: string; project_id: string; content: string; author: string; created_at: string; project_name: string }
interface ActivityRow { id: string; project_id: string; field: string; old_value: string; new_value: string; by: string; at: string }

interface Props {
  projects: Project[]
  onSelect: (id: string) => void
  onRefresh: () => void
  onOpenTodos?: () => void
  onOpenHistory?: () => void
}

// 方向 A 配色令牌
const PRIMARY = '#185FA5'
const TEXT1 = '#2C2C2A'
const TEXT2 = '#5F5E5A'
const TEXT3 = '#888780'
const BORDER = '#E3E3E0'
const CARD_SHADOW = '0 1px 2px rgba(16,24,40,0.06)'
const RISK: Record<string, string> = { 高: '#A32D2D', 中: '#BA7517', 低: '#3B6D11' }

const amount = (v: number | null) => v ? v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''

// 数据完整度：统计一组核心字段的填写情况（全部非必填，仅作质量抓手）
const CORE_KEYS = [
  'type', 'location', 'ld_role', 'owner_unit', 'owner_contact', 'owner_phone',
  'owner_received', 'owner_remaining', 'owner_settle_status', 'upstream_contract_amt',
  'litigation', 'case_type', 'case_no', 'court', 'case_stage', 'dispute_amt',
  'worker_issue', 'data_missing_note', 'doc_storage_status', 'risk_level', 'priority', 'fact_summary'
]
const isFilled = (v: any) => v === true || v === false ? true : (v !== null && v !== undefined && v !== '')
const completeness = (p: Project) => {
  const filled = CORE_KEYS.filter(k => isFilled((p as any)[k])).length
  return { filled, total: CORE_KEYS.length, pct: Math.round((filled / CORE_KEYS.length) * 100) }
}

// 相对时间（"3分钟前"）
const relTime = (at: string) => {
  const t = new Date(at).getTime()
  if (isNaN(t)) return (at || '').slice(0, 10)
  const diff = Date.now() - t
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}天前`
  return at.slice(0, 10)
}

export default function ProjectList({ projects, onSelect, onRefresh, onOpenTodos, onOpenHistory }: Props) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string | null>>({})

  // 工作台：待办 + 备忘 + 近期动态（首页置顶）
  const [todos, setTodos] = useState<TodoRow[]>([])
  const [memos, setMemos] = useState<MemoRow[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [wbLoading, setWbLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [td, mm, act] = await Promise.all([fetchAllTodos(), fetchAllMemos(), fetchAllActivities(10)])
        if (alive) {
          setTodos(td as TodoRow[])
          setMemos(mm as MemoRow[])
          setActivities(act as ActivityRow[])
        }
      } catch (e) {
        console.warn('工作台数据加载失败（memos/todos/change_log 表可能尚未创建）：', e)
      } finally {
        if (alive) setWbLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const toggleFilter = (key: string, val: string) => {
    setFilters(f => f[key] === val ? { ...f, [key]: null } : { ...f, [key]: val })
  }

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (search) {
        const s = search.toLowerCase()
        // 跨项目全局搜索：聚合项目全部字段（名称/业主/案号/风险/备注…）为可检索字符串
        const hay = Object.values(p)
          .map(v => (v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v))))
          .join(' ')
          .toLowerCase()
        if (!hay.includes(s)) return false
      }
      if (filters.type && p.type !== filters.type) return false
      if (filters.risk && p.risk_level !== filters.risk) return false
      if (filters.phase && p.phase !== filters.phase) return false
      if (filters.ld_role && p.ld_role !== filters.ld_role) return false
      if (filters.litigation && !p.litigation) return false
      if (filters.data_missing && !p.data_missing) return false
      if (filters.priority && p.priority !== filters.priority) return false
      if (filters.archived === '是' && !p.archived) return false
      if (filters.archived === '否' && p.archived) return false
      return true
    })
  }, [projects, search, filters])

  // 目录默认排序：并购后(A) 整体在前、并购前(B) 整体在后，组内按原序号升序
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const ra = phaseRank(a.phase), rb = phaseRank(b.phase)
    if (ra !== rb) return ra - rb
    return (a.seq ?? 0) - (b.seq ?? 0)
  }), [filtered])

  const stats = useMemo(() => ({
    total: projects.length,
    litigation: projects.filter(p => p.litigation).length,
    highRisk: projects.filter(p => p.risk_level === '高').length,
    worker: projects.filter(p => p.worker_issue).length,
    unpaid: projects.reduce((s, p) => s + (Number(p.owner_remaining) || 0) + (Number(p.gc_remaining) || 0), 0),
  }), [projects])

  const chip = (label: string, key: string, val: string, count?: number, activeColor?: string) => (
    <button
      key={val}
      onClick={() => key === 'clear' ? setFilters({}) : toggleFilter(key, val)}
      style={{
        padding: '4px 12px', borderRadius: 20, border: `1px solid ${filters[key] === val ? 'transparent' : BORDER}`,
        background: filters[key] === val ? (activeColor || PRIMARY) : '#fff', color: filters[key] === val ? '#fff' : TEXT2,
        fontSize: 12, cursor: 'pointer', fontWeight: filters[key] === val ? 500 : 400,
        fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .12s'
      }}
    >
      {label}{count !== undefined ? ` ${count}` : ''}
    </button>
  )

  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = (t: TodoRow) => !t.done && !!t.due_date && t.due_date < today
  const openCount = todos.filter(t => !t.done).length
  const overdueCount = todos.filter(isOverdue).length
  const todoVisible = todos
    .filter(t => !t.done)
    .sort((a, b) => {
      const ao = isOverdue(a) ? 0 : 1, bo = isOverdue(b) ? 0 : 1
      if (ao !== bo) return ao - bo
      const ad = a.due_date || '9999-12-31', bd = b.due_date || '9999-12-31'
      return ad < bd ? -1 : ad > bd ? 1 : 0
    })

  const linkBtn: React.CSSProperties = {
    border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 12, color: PRIMARY, padding: '2px 4px', fontWeight: 500
  }
  const muted: React.CSSProperties = { fontSize: 13, color: TEXT3, padding: '8px 4px' }
  const rowHover = (e: React.MouseEvent<HTMLDivElement>, on: boolean) =>
    (e.currentTarget.style.background = on ? '#F4F5F7' : 'transparent')

  const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: CARD_SHADOW, border: `1px solid ${BORDER}` }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px' }}>
      {/* 工作台：待办 / 事项提醒 + 管理人备忘 + 近期动态（置顶） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 16 }}>
        {/* 模块一：待办 / 事项提醒 */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: TEXT1 }}>待办 / 事项提醒</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {(openCount > 0 || overdueCount > 0) && (
                <span style={{ fontSize: 11, color: TEXT3 }}>进行中 {openCount} · 逾期 {overdueCount}</span>
              )}
              {onOpenTodos && <button style={linkBtn} onClick={onOpenTodos}>全部 →</button>}
            </div>
          </div>
          {wbLoading ? <div style={muted}>加载中...</div> :
            todoVisible.length === 0 ? <div style={muted}>暂无待办</div> :
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {todoVisible.slice(0, 6).map(t => {
                const overdue = isOverdue(t)
                const isToday = !t.done && t.due_date === today
                return (
                  <div key={t.id} onClick={() => onSelect(t.project_id)} onMouseEnter={e => rowHover(e, true)} onMouseLeave={e => rowHover(e, false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: overdue ? '#A32D2D' : isToday ? '#BA7517' : '#9aa7b8', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: TEXT1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.task}</div>
                      <div style={{ fontSize: 11, color: TEXT3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.project_name}</div>
                    </div>
                    {t.due_date && (
                      <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, flexShrink: 0, background: overdue ? '#FCEBEB' : isToday ? '#FAEEDA' : '#F1EFE8', color: overdue ? '#A32D2D' : isToday ? '#BA7517' : TEXT2, fontWeight: overdue || isToday ? 500 : 400 }}>
                        {t.due_date}{overdue ? ' 逾期' : isToday ? ' 今日' : ''}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          }
        </section>

        {/* 模块二：管理人备忘 */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: TEXT1 }}>管理人备忘</h3>
            <span style={{ fontSize: 11, color: TEXT3 }}>最近 {memos.length} 条</span>
          </div>
          {wbLoading ? <div style={muted}>加载中...</div> :
            memos.length === 0 ? <div style={muted}>暂无备忘</div> :
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {memos.slice(0, 6).map(m => (
                <div key={m.id} onClick={() => onSelect(m.project_id)} onMouseEnter={e => rowHover(e, true)} onMouseLeave={e => rowHover(e, false)}
                  style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.project_name}</span>
                    <span style={{ fontSize: 10, color: TEXT3, flexShrink: 0 }}>{(m.author || '') + ' · ' + m.created_at.slice(0, 10)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: TEXT2, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>{m.content}</div>
                </div>
              ))}
            </div>
          }
        </section>

        {/* 模块三：近期动态（聚合 change_log） */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: TEXT1 }}>近期动态</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: TEXT3 }}>最近 {activities.length} 条</span>
              {onOpenHistory && <button style={linkBtn} onClick={onOpenHistory}>查看更多 →</button>}
            </div>
          </div>
          {wbLoading ? <div style={muted}>加载中...</div> :
            activities.length === 0 ? <div style={muted}>暂无动态</div> :
            <div style={{ borderLeft: '1.5px solid #EDEFF2', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activities.slice(0, 5).map(a => {
                const pname = projects.find(p => p.id === a.project_id)?.name || '未知项目'
                return (
                  <div key={a.id} onClick={() => onSelect(a.project_id)} onMouseEnter={e => rowHover(e, true)} onMouseLeave={e => rowHover(e, false)}
                    style={{ position: 'relative', padding: '2px 8px', borderRadius: 6, cursor: 'pointer' }}>
                    <span style={{ position: 'absolute', left: -16, top: 7, width: 6, height: 6, borderRadius: '50%', background: PRIMARY }} />
                    <div style={{ fontSize: 11, color: TEXT2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <b style={{ fontWeight: 500, color: TEXT1 }}>{a.by}</b> 更新了 <b style={{ fontWeight: 500, color: TEXT1 }}>{pname}</b> · {relTime(a.at)}
                    </div>
                  </div>
                )
              })}
            </div>
          }
        </section>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          ['项目总数', stats.total, PRIMARY],
          ['涉诉项目', stats.litigation, '#A32D2D'],
          ['高风险', stats.highRisk, '#A32D2D'],
          ['涉及农民工', stats.worker, '#534AB7'],
          ['对下未付款(万)', amount(stats.unpaid), '#BA7517'],
        ].map(([label, value, color]) => (
          <div key={label as string} style={{ ...cardStyle, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: TEXT2, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: color as string }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input
          type="text" placeholder="全局搜索：名称 / 业主 / 案号 / 风险 / 备注…（全字段）"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            padding: '7px 14px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13,
            width: 260, fontFamily: 'inherit', outline: 'none', background: '#fff', color: TEXT1
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {chip('高风险', 'risk', '高', stats.highRisk)}
          {chip('极高(维稳)', 'risk', '极高(维稳)', projects.filter(p => p.risk_level === '极高(维稳)').length, '#534AB7')}
          {chip('中风险', 'risk', '中')}
          {chip('涉诉', 'litigation', '是', stats.litigation)}
          {chip('资料缺失', 'data_missing', '是', projects.filter(p => p.data_missing).length, '#BA7517')}
          {chip('合作挂靠', 'type', '合作挂靠', projects.filter(p => p.type === '合作挂靠').length, PRIMARY)}
          {chip('P0', 'priority', 'P0', projects.filter(p => p.priority === 'P0').length, '#A32D2D')}
          {chip('总包', 'ld_role', '总包')}
          {chip('分包', 'ld_role', '分包')}
          {chip('并购前', 'phase', '并购前')}
          {chip('并购后', 'phase', '并购后')}
          {chip('已归档', 'archived', '是', projects.filter(p => p.archived).length, TEXT2)}
          {Object.values(filters).some(Boolean) && chip('清除', 'clear', '')}
        </div>
      </div>

      {/* Project Cards */}
      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: TEXT2 }}>没有匹配的项目</div>
        )}
        {sorted.map(p => {
          const comp = completeness(p)
          // 标签收敛：最多 3 个关键标签，优先 风险/涉诉/P0/维稳
          const tags: { label: string; bg: string; fg: string }[] = []
          if (p.risk_level === '高') tags.push({ label: '高风险', bg: '#FCEBEB', fg: '#A32D2D' })
          else if (p.risk_level === '中') tags.push({ label: '中风险', bg: '#FAEEDA', fg: '#BA7517' })
          if (p.litigation) tags.push({ label: '涉诉', bg: '#FCEBEB', fg: '#A32D2D' })
          if (p.priority === 'P0') tags.push({ label: 'P0', bg: '#FCEBEB', fg: '#A32D2D' })
          if (p.risk_level === '极高(维稳)') tags.push({ label: '维稳', bg: '#EEEDFE', fg: '#534AB7' })
          if (p.data_missing) tags.push({ label: '缺失', bg: '#FAEEDA', fg: '#BA7517' })
          if (p.type === '合作挂靠') tags.push({ label: '挂靠', bg: '#E6F1FB', fg: PRIMARY })
          if (p.ld_role) tags.push({ label: p.ld_role, bg: p.ld_role === '总包' ? '#E6F1FB' : '#EEEDFE', fg: p.ld_role === '总包' ? PRIMARY : '#534AB7' })
          if (p.archived) tags.push({ label: '已归档', bg: '#F1EFE8', fg: TEXT2 })
          const shown = tags.slice(0, 3)
          return (
          <div
            key={p.id}
            onClick={() => onSelect(p.id)}
            style={{
              ...cardStyle, padding: '12px 20px',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
              opacity: p.archived ? 0.6 : 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,24,40,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = CARD_SHADOW)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 12, color: TEXT2, minWidth: 28, fontWeight: 500 }}>{displaySeq(p)}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: TEXT1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <span style={{ fontSize: 12, color: TEXT2, minWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{p.owner_unit || ''}</span>
              <span style={{ fontFamily: '"SF Mono","Consolas",monospace', fontSize: 12, fontWeight: 500, minWidth: 90, textAlign: 'right', color: TEXT1 }}>{amount(p.owner_remaining)}</span>
              <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {shown.map(t => (
                  <span key={t.label} style={{ padding: '2px 8px', borderRadius: 4, background: t.bg, color: t.fg, fontSize: 10, fontWeight: 500 }}>{t.label}</span>
                ))}
              </span>
            </div>
            {/* 数据完整度仪表 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 44 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#EDEFF2', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${comp.pct}%`, background: comp.pct >= 70 ? '#9bb3a4' : comp.pct >= 40 ? '#c9bf9e' : '#d8c1a8' }} />
              </div>
              <span style={{ fontSize: 10, color: TEXT3, minWidth: 56, textAlign: 'right' }}>完整度 {comp.pct}%（缺 {comp.total - comp.filled}）</span>
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
