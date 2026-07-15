import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Project, BLANK_PROJECT, Downstream, DownstreamContract, Memo, Todo, Contract } from '../lib/types'
import {
  fetchProject, saveProject, fetchDownstreams, saveDownstream, deleteDownstream,
  fetchMemos, addMemo, deleteMemo, fetchTodos, addTodo, updateTodo, deleteTodo,
  fetchChangeLog, fetchContracts, saveContract, deleteContract,
  fetchDownstreamContracts, fetchAllDownstreamContracts, saveDownstreamContract, deleteDownstreamContract
} from '../lib/db'
import { FIELDS, SECTIONS, getFieldsBySection, getFieldByKey, FieldDef, SectionDef, displaySeq } from '../lib/fieldConfig'
import { exportProjectWord, exportProjectExcel, ProjectExportData, ExportGroup, ExportField, DownstreamExport } from '../lib/exporters'

interface Props { projectId: string; onBack: () => void; onUpdate: () => void; readOnly?: boolean }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', border: '1px solid #e8e5df', borderRadius: 6,
  fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fafaf9',
  transition: 'border-color .15s'
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 110, resize: 'both', lineHeight: 1.65, textIndent: '2em', padding: '12px 14px', overflow: 'hidden' }
// 长文本（如「审核意见/争议焦点」）专用：更宽更高，独占整行
const textareaLargeStyle: React.CSSProperties = { ...textareaStyle, minHeight: 150 }
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#6b6b65', marginBottom: 3, fontWeight: 500 }
const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
  background: 'transparent', color: '#2C2C2A', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', borderRadius: 4
}

function Section({ section, children }: { section: SectionDef; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, paddingBottom: 6, borderBottom: `1.5px solid #e8e5df` }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: section.dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: section.color }}>{section.title}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '0 16px' }}>
        {children}
      </div>
    </div>
  )
}

// 多行文本框：随内容自动向下延伸（输入时实时撑高），同时允许手动拖拽调整宽高
function AutoTextarea({ value, onChange, style }: {
  value: string
  onChange: (v: string) => void
  style: React.CSSProperties
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const grow = useCallback(() => {
    const el = ref.current
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
  }, [])
  useEffect(() => { grow() }, [value, grow])  // 初始 + 值变化（如从接口加载长文本）时自动撑高
  return (
    <textarea
      ref={ref}
      style={style}
      value={value || ''}
      onChange={e => { onChange(e.target.value); grow() }}
    />
  )
}

function ValChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ padding: '4px 10px', borderRadius: 6, background: '#f2f1ec', color: '#4a4a44', fontSize: 12 }}>
      <span style={{ color: '#6b6b65' }}>{label}：</span>
      <b style={{ fontFamily: '"SF Mono","Consolas",monospace' }}>{value}</b>
    </span>
  )
}

// 金额字段：数据库存「元」，UI 显示「万元」。yuan=true 时读写自动换算。
function renderField(field: FieldDef, value: any, onChange: (v: any) => void) {
  const label = <div style={labelStyle}>{field.label}</div>
  const wrap = (el: React.ReactNode) => <div style={{ marginBottom: 10 }}>{label}{el}</div>

  switch (field.type) {
    case 'text':
      return wrap(<input style={inputStyle} value={value || ''} onChange={e => onChange(e.target.value)} />)
    case 'number': {
      const display = field.yuan ? (value ? value / 10000 : '') : (value ?? '')
      return wrap(
        <input
          style={inputStyle} type="number"
          value={display}
          onChange={e => {
            const raw = e.target.value === '' ? null : Number(e.target.value)
            onChange(field.yuan && raw !== null ? raw * 10000 : raw)
          }}
        />
      )
    }
    case 'textarea':
      return <div style={{ gridColumn: '1/-1', marginBottom: 12 }}>{label}<AutoTextarea style={textareaStyle} value={value} onChange={onChange} /></div>
    case 'date':
      return wrap(<input style={inputStyle} type="date" value={value || ''} onChange={e => onChange(e.target.value)} />)
    case 'select':
      return wrap(
        <select style={selectStyle} value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">—</option>
          {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    case 'boolean':
      return wrap(
        <select style={selectStyle} value={value ? '是' : ''} onChange={e => onChange(e.target.value === '是')}>
          <option value="">—</option>
          <option value="是">是</option>
          <option value="否">否</option>
        </select>
      )
    default:
      return null
  }
}

function renderFieldByKey(key: string, project: Project, update: (patch: Partial<Project>) => void) {
  const field = getFieldByKey(key)
  if (!field) return null
  if (field.showWhen && !field.showWhen(project)) return null
  return <React.Fragment key={key}>{renderField(field, (project as any)[key], (v) => update({ [key]: v } as any))}</React.Fragment>
}

// 下游分包卡片字段（含债权审核下沉字段）
const DS_FIELDS: { key: keyof Downstream; label: string; type: 'text' | 'number' | 'select' | 'textarea'; yuan?: boolean; options?: string[] }[] = [
  { key: 'name', label: '单位名称', type: 'text' },
  { key: 'contact', label: '联系人', type: 'text' },
  { key: 'phone', label: '联系电话', type: 'text' },
  { key: 'paid', label: '对下已付(万元)', type: 'number', yuan: true },
  { key: 'unpaid', label: '对下未付(万元)', type: 'number', yuan: true },
  { key: 'settled', label: '结算状态', type: 'select', options: ['未结算', '办理中', '已结算'] },
  { key: 'settle_est', label: '预计结算金额(万元)', type: 'number', yuan: true },
  { key: 'claim_amt', label: '对方申报债权(万元)', type: 'number', yuan: true },
  { key: 'review_amt', label: '管理人认定金额(万元)', type: 'number', yuan: true },
  { key: 'claim_dispute', label: '审核意见/争议焦点', type: 'textarea' },
  { key: 'negotiation_note', label: '交涉情况', type: 'text' },
]

export default function ProjectDetail({ projectId, onBack, onUpdate, readOnly }: Props) {
  const [project, setProject] = useState<Project>(BLANK_PROJECT)
  const [downstreams, setDownstreams] = useState<Downstream[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [downstreamContracts, setDownstreamContracts] = useState<DownstreamContract[]>([])
  const [memos, setMemos] = useState<Memo[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [newMemo, setNewMemo] = useState('')
  const [newTodo, setNewTodo] = useState({ task: '', owner: '', due_date: '' as string | null })
  const [changes, setChanges] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [saved, setSaved] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    (async () => {
      const p = await fetchProject(projectId)
      if (p) setProject(p)
      setDownstreams(await fetchDownstreams(projectId))
      try { setContracts(await fetchContracts(projectId)) } catch { setContracts([]) }
      try { setDownstreamContracts(await fetchAllDownstreamContracts()) } catch { setDownstreamContracts([]) }
      try { setMemos(await fetchMemos(projectId)) } catch { setMemos([]) }
      try { setTodos(await fetchTodos(projectId)) } catch { setTodos([]) }
      try { setChanges(await fetchChangeLog(projectId)) } catch { setChanges([]) }
    })()
  }, [projectId])

  const update = useCallback((patch: Partial<Project>) => {
    setProject(p => ({ ...p, ...patch }))
    setSaved(false)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave({ ...project, ...patch }), 2000)
  }, [project, downstreams])

  const doSave = async (p: Project) => {
    if (readOnly) return  // 只读模式不落库
    setSaving(true)
    try { await saveProject(p); setSaved(true); onUpdate() }
    catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleManualSave = () => { clearTimeout(saveTimer.current); doSave(project) }

  // ── 导出数据构建 ──
  const fmtField = (f: FieldDef, v: any): string => {
    if (v == null || v === '') return '—'
    if (f.type === 'boolean') return v ? '是' : '否'
    if (f.yuan && typeof v === 'number') return (v / 10000).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' 万元'
    if (typeof v === 'number') return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return String(v)
  }
  const fmtDs = (f: typeof DS_FIELDS[number], v: any): string => {
    if (v == null || v === '') return '—'
    if (f.yuan && typeof v === 'number') return (v / 10000).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' 万元'
    if (f.type === 'number' && typeof v === 'number') return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return String(v)
  }
  const buildExport = (): ProjectExportData => {
    const groups: ExportGroup[] = SECTIONS.map(section => {
      if (section.showWhen && !section.showWhen(project)) return null as any
      const fields = getFieldsBySection(section.key)
      const rows: ExportField[] = fields
        .filter(f => !f.showWhen || f.showWhen(project))
        .map(f => ({ label: f.label, value: fmtField(f, (project as any)[f.key]) }))
      return { title: section.title, rows }
    }).filter(Boolean) as ExportGroup[]
    const fmtYuan = (v: number) => (v / 10000).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' 万元'

    // 对甲合同信息（多份合同 + 金额总计）
    const gcContracts = contracts.filter(c => c.party === 'gc')
    const ownerContracts = contracts.filter(c => c.party === 'owner')
    const contractRows: ExportField[] = []
    if (gcContracts.length) {
      contractRows.push({ label: '对甲合同（与总包）', value: `共 ${gcContracts.length} 份，总计 ${fmtYuan(gcContractTotal)}` })
      gcContracts.forEach((c, i) => contractRows.push({ label: `合同${i + 1}${c.name ? '（' + c.name + '）' : ''}`, value: c.amt != null ? fmtYuan(c.amt) : '—' }))
    }
    if (ownerContracts.length) {
      contractRows.push({ label: '对甲合同（与业主）', value: `共 ${ownerContracts.length} 份，总计 ${fmtYuan(ownerContractTotal)}` })
      ownerContracts.forEach((c, i) => contractRows.push({ label: `合同${i + 1}${c.name ? '（' + c.name + '）' : ''}`, value: c.amt != null ? fmtYuan(c.amt) : '—' }))
    }
    if (contractRows.length) {
      const idx = groups.findIndex(g => g.title === '下游信息')
      groups.splice(idx >= 0 ? idx : groups.length, 0, { title: '对甲合同信息', rows: contractRows })
    }

    const downContractRows = (ds: Downstream): ExportField[] => {
      const list = downstreamContracts.filter(c => c.downstream_id === ds.id)
      if (!list.length) return []
      const total = list.reduce((a, c) => a + (c.amt || 0), 0)
      const rows: ExportField[] = [{ label: '对下合同金额总计', value: fmtYuan(total) }]
      list.forEach((c, i) => rows.push({ label: `对下合同${i + 1}${c.name ? '（' + c.name + '）' : ''}`, value: c.amt != null ? fmtYuan(c.amt) : '—' }))
      return rows
    }
    const downExports: DownstreamExport[] = downstreams.map((ds, i) => ({
      name: ds.name || `下游 ${i + 1}`,
      rows: [...DS_FIELDS.map(f => ({ label: f.label, value: fmtDs(f, (ds as any)[f.key]) })), ...downContractRows(ds)]
    }))
    if (downstreams.length) {
      downExports.push({
        name: '下游合计',
        rows: [
          { label: '合同金额合计', value: downContractTotal ? fmtYuan(downContractTotal) : '0.00 万元' },
          { label: '对下已付总计', value: downSum.paid ? fmtYuan(downSum.paid) : '0.00 万元' },
          { label: '对下未付总计', value: downSum.unpaid ? fmtYuan(downSum.unpaid) : '0.00 万元' },
          { label: '申报债权合计', value: downSum.claim ? fmtYuan(downSum.claim) : '0.00 万元' },
          { label: '认定金额合计', value: downSum.review ? fmtYuan(downSum.review) : '0.00 万元' },
        ]
      })
    }
    return {
      projectName: project.name || '未命名项目',
      groups,
      downstreams: downExports,
      memos: memos.map(m => ({ author: m.author, created_at: new Date(m.created_at).toLocaleString('zh-CN'), content: m.content })),
      todos: todos.map(t => ({ task: t.task, owner: t.owner || '', due_date: t.due_date || '', done: t.done })),
      changes: changes.map(c => ({ at: new Date(c.at).toLocaleString('zh-CN'), by: c.by, label: getFieldByKey(c.field)?.label || c.field, old_value: c.old_value || '', new_value: c.new_value || '' }))
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleManualSave() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [project, downstreams])

  // ── 分包管理 ──
  const addDownstream = async () => {
    try {
      const ds = await saveDownstream({ project_id: projectId, name: '新分包单位', contact: '', phone: '', settled: null as any, negotiation_note: '', sort_order: downstreams.length })
      setDownstreams(prev => [...prev, ds])
    } catch (e) {
      console.error('添加分包失败:', e)
      alert('添加分包失败: ' + (e as any)?.message || '未知错误')
    }
  }

  const updateDownstream = async (id: string, patch: Partial<Downstream>) => {
    const cleanPatch: Partial<Downstream> = { ...patch }
    if ('settled' in cleanPatch && (cleanPatch.settled as any) === '') (cleanPatch as any).settled = null
    setDownstreams(prev => prev.map(d => d.id === id ? { ...d, ...cleanPatch } : d))
    setSaved(false)
    try { const ds = downstreams.find(d => d.id === id); if (ds) await saveDownstream({ ...ds, ...cleanPatch, project_id: projectId }); setSaved(true) }
    catch (e) { console.error(e) }
  }

  const removeDownstream = async (id: string) => {
    setDownstreams(prev => prev.filter(d => d.id !== id))
    setDownstreamContracts(prev => prev.filter(c => c.downstream_id !== id))
    await deleteDownstream(id)
  }

  // ── 对甲合同（与总包 gc / 与业主 owner，支持多份）──
  const addContract = async (party: 'gc' | 'owner') => {
    try {
      const order = contracts.filter(c => c.party === party).length
      const c = await saveContract({ project_id: projectId, party, name: '新合同', amt: null, sort_order: order })
      setContracts(prev => [...prev, c])
    } catch (e) {
      console.error('添加合同失败:', e)
      alert('添加合同失败: ' + ((e as any)?.message || '未知错误'))
    }
  }
  const updateContract = async (id: string, patch: Partial<Contract>) => {
    setContracts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    try {
      const c = contracts.find(x => x.id === id)
      if (c) await saveContract({ ...c, ...patch, project_id: projectId })
    } catch (e) { console.error(e) }
  }
  const removeContract = async (id: string) => {
    setContracts(prev => prev.filter(c => c.id !== id))
    await deleteContract(id)
  }
  const renderContractBlock = (party: 'gc' | 'owner', title: string, color: string) => {
    const list = contracts.filter(c => c.party === party)
    const total = list.reduce((a, c) => a + (c.amt || 0), 0)
    return (
      <div style={{ gridColumn: '1/-1', marginTop: 4, padding: '10px 12px', background: '#f6f8fb', borderRadius: 6, border: '1px solid #e3e9f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color }}>{title}</span>
          <ValChip label="合同金额总计" value={total ? `${(total / 10000).toFixed(2)} 万` : '0.00 万'} />
        </div>
        {list.length === 0 && <p style={{ color: '#6b6b65', fontSize: 13, marginBottom: 8 }}>暂无合同</p>}
        {list.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#6b6b65', width: 30, flexShrink: 0 }}>合同{i + 1}</span>
            <input style={{ ...inputStyle, flex: 2, minWidth: 140 }} placeholder="合同名称" value={c.name || ''} onChange={e => updateContract(c.id, { name: e.target.value })} />
            <input
              style={{ ...inputStyle, flex: 1, minWidth: 120 }} type="number" placeholder="金额(万元)"
              value={c.amt ? c.amt / 10000 : ''}
              onChange={e => { const v = e.target.value === '' ? null : Number(e.target.value); updateContract(c.id, { amt: v !== null ? v * 10000 : null }) }}
            />
            <button onClick={() => removeContract(c.id)} style={{ border: 'none', background: 'none', color: '#b54545', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>删除</button>
          </div>
        ))}
        <button onClick={() => addContract(party)} style={{ padding: '5px 12px', border: '1px dashed #b0ada0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b6b65', fontFamily: 'inherit', marginTop: 2 }}>+ 增加合同</button>
      </div>
    )
  }

  // ── 对下合同（每个下游分包可签多份）──
  const addDownstreamContract = async (dsId: string) => {
    try {
      const order = downstreamContracts.filter(c => c.downstream_id === dsId).length
      const c = await saveDownstreamContract({ downstream_id: dsId, name: '新合同', amt: null, sort_order: order })
      setDownstreamContracts(prev => [...prev, c])
    } catch (e) {
      console.error('添加对下合同失败:', e)
      alert('添加对下合同失败: ' + ((e as any)?.message || '未知错误'))
    }
  }
  const updateDownstreamContract = async (id: string, patch: Partial<DownstreamContract>) => {
    setDownstreamContracts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    try {
      const c = downstreamContracts.find(x => x.id === id)
      if (c) await saveDownstreamContract({ ...c, ...patch })
    } catch (e) { console.error(e) }
  }
  const removeDownstreamContract = async (id: string) => {
    setDownstreamContracts(prev => prev.filter(c => c.id !== id))
    await deleteDownstreamContract(id)
  }
  const renderDownstreamContractBlock = (dsId: string, color: string) => {
    const list = downstreamContracts.filter(c => c.downstream_id === dsId)
    const total = list.reduce((a, c) => a + (c.amt || 0), 0)
    return (
      <div style={{ gridColumn: '1/-1', marginTop: 4, padding: '10px 12px', background: '#f6f8fb', borderRadius: 6, border: '1px solid #e3e9f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color }}>对下合同</span>
          <ValChip label="合同金额总计" value={total ? `${(total / 10000).toFixed(2)} 万` : '0.00 万'} />
        </div>
        {list.length === 0 && <p style={{ color: '#6b6b65', fontSize: 13, marginBottom: 8 }}>暂无合同</p>}
        {list.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#6b6b65', width: 30, flexShrink: 0 }}>合同{i + 1}</span>
            <input style={{ ...inputStyle, flex: 2, minWidth: 140 }} placeholder="合同名称" value={c.name || ''} onChange={e => updateDownstreamContract(c.id, { name: e.target.value })} />
            <input
              style={{ ...inputStyle, flex: 1, minWidth: 120 }} type="number" placeholder="金额(万元)"
              value={c.amt ? c.amt / 10000 : ''}
              onChange={e => { const v = e.target.value === '' ? null : Number(e.target.value); updateDownstreamContract(c.id, { amt: v !== null ? v * 10000 : null }) }}
            />
            <button onClick={() => removeDownstreamContract(c.id)} style={{ border: 'none', background: 'none', color: '#b54545', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>删除</button>
          </div>
        ))}
        <button onClick={() => addDownstreamContract(dsId)} style={{ padding: '5px 12px', border: '1px dashed #b0ada0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b6b65', fontFamily: 'inherit', marginTop: 2 }}>+ 增加合同</button>
      </div>
    )
  }

  // ── Memo（管理人备忘）──
  const handleAddMemo = async () => {
    const c = newMemo.trim()
    if (!c) return
    try {
      await addMemo(projectId, c)
      setMemos(await fetchMemos(projectId))
      setNewMemo('')
    } catch (e) { console.error(e); alert('添加备忘失败: ' + (e as any)?.message) }
  }
  const handleDeleteMemo = async (id: string) => {
    await deleteMemo(id)
    setMemos(prev => prev.filter(m => m.id !== id))
  }

  // ── Todo（待办 / 事项提醒）──
  const handleAddTodo = async () => {
    const t = newTodo.task.trim()
    if (!t) return
    try {
      await addTodo(projectId, t, newTodo.owner.trim(), newTodo.due_date || null)
      setTodos(await fetchTodos(projectId))
      setNewTodo({ task: '', owner: '', due_date: '' })
    } catch (e) { console.error(e); alert('添加待办失败: ' + (e as any)?.message) }
  }
  const handleToggleTodo = async (id: string, done: boolean) => {
    await updateTodo(id, { done })
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done } : t))
  }
  const handleDeleteTodo = async (id: string) => {
    await deleteTodo(id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  // ── 对上/对下自动校验 ──
  const received = project.ld_role === '分包' ? project.gc_received : project.owner_received
  const upstreamAmt = project.upstream_contract_amt
  const computedExposure = (upstreamAmt != null && received != null) ? (upstreamAmt - received) : null  // 元
  const remaining = project.ld_role === '分包' ? null : project.owner_remaining
  const exposureMismatch = (computedExposure != null && remaining != null)
    ? Math.abs(computedExposure - remaining) > 1
    : false
  const downSum = downstreams.reduce((a, d) => ({
    claim: a.claim + (d.claim_amt || 0),
    review: a.review + (d.review_amt || 0),
    paid: a.paid + (d.paid || 0),
    unpaid: a.unpaid + (d.unpaid || 0),
  }), { claim: 0, review: 0, paid: 0, unpaid: 0 })
  // 对下合同金额总计：由各下游分包的多份对下合同求和
  const downContractTotal = downstreams.reduce((s, d) => {
    const list = downstreamContracts.filter(c => c.downstream_id === d.id)
    return s + list.reduce((a, c) => a + (c.amt || 0), 0)
  }, 0)

  const gcContractTotal = contracts.filter(c => c.party === 'gc').reduce((a, c) => a + (c.amt || 0), 0)
  const ownerContractTotal = contracts.filter(c => c.party === 'owner').reduce((a, c) => a + (c.amt || 0), 0)
  const upstreamContractTotal = project.ld_role === '分包' ? gcContractTotal : (project.ld_role === '总包' ? ownerContractTotal : 0)

  const saveStatus = saving ? '保存中...' : saved ? '已保存' : '未保存'
  const saveColor = saving ? '#6b6b65' : saved ? '#4a7c59' : '#b86e3a'

  const renderDownstreamField = (ds: Downstream, f: typeof DS_FIELDS[number]) => {
    const raw = (ds as any)[f.key]
    const display = f.type === 'number' ? (f.yuan ? (raw ? raw / 10000 : '') : (raw ?? '')) : (raw ?? '')
    const isTextarea = f.type === 'textarea'
    return (
      <div key={f.key} style={{ marginBottom: 12, ...(isTextarea ? { gridColumn: '1/-1' } : {}) }}>
        <div style={labelStyle}>{f.label}</div>
        {f.type === 'select' ? (
          <select style={selectStyle} value={raw || ''} onChange={e => updateDownstream(ds.id, { [f.key]: e.target.value } as any)}>
            <option value="">—</option>
            {f.options!.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : f.type === 'textarea' ? (
          <AutoTextarea style={textareaLargeStyle} value={display} onChange={(v) => updateDownstream(ds.id, { [f.key]: v } as any)} />
        ) : f.type === 'number' ? (
          <input style={inputStyle} type="number" value={display}
            onChange={e => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              updateDownstream(ds.id, { [f.key]: f.yuan && v !== null ? v * 10000 : v } as any)
            }} />
        ) : (
          <input style={inputStyle} value={display} onChange={e => updateDownstream(ds.id, { [f.key]: e.target.value } as any)} />
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px' }}>
      {/* 保存 UI 投射到顶部标题栏 */}
      {createPortal(
        readOnly ? (
          <span style={{ fontSize: 12, color: '#9a978f', padding: '6px 10px', borderRadius: 6, background: '#f2f1ec' }}>只读模式 · 不可编辑</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: saveColor }}>{saveStatus}</span>
            <button onClick={handleManualSave} style={{ padding: '6px 18px', background: '#3b5b9b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>保存</button>
          </div>
        ),
        document.getElementById('header-detail-actions')!
      )}

      <div style={{ background: '#fff', borderRadius: 8, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...(readOnly ? { pointerEvents: 'none', opacity: 0.72 } : {}) }}>
        {readOnly && (
          <div style={{ fontSize: 12, color: '#9a978f', background: '#f2f1ec', borderRadius: 6, padding: '8px 12px', marginBottom: 14 }}>
            🔒 只读模式：当前为只读身份，仅可浏览，编辑请切换为「填报」角色
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{(project.seq != null ? displaySeq(project) + '　' : '') + (project.name || '未命名项目')}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 导出下拉：Word / Excel */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowExportMenu(v => !v)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #E3E3E0', background: '#fff', color: '#5F5E5A', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                导出 ▾
              </button>
              {showExportMenu && (
                <>
                  <div onClick={() => setShowExportMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 6, zIndex: 200, minWidth: 160 }}>
                    <button onClick={() => { setShowExportMenu(false); exportProjectWord(buildExport()) }} style={menuItemStyle}>导出为 Word (.doc)</button>
                    <button onClick={() => { setShowExportMenu(false); exportProjectExcel(buildExport()) }} style={menuItemStyle}>导出为 Excel (.xls)</button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => update({ archived: !project.archived } as any)}
              style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${project.archived ? '#b54545' : '#e8e5df'}`, background: project.archived ? '#fdf3f3' : '#fff', color: project.archived ? '#b54545' : '#6b6b65', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
            >
              {project.archived ? '取消归档' : '归档项目'}
            </button>
          </div>
        </div>

        {/* 对上/对下自动校验条 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          <ValChip label="上游应收敞口" value={computedExposure != null ? `${(computedExposure / 10000).toFixed(2)} 万` : '待查'} />
          {exposureMismatch && (
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#fdf3f3', color: '#b54545', fontSize: 12, fontWeight: 600 }}>
              ⚠ 与「应收余额」不一致（系统算 {((computedExposure || 0) / 10000).toFixed(2)} 万 / 填 {(remaining || 0) / 10000} 万）
            </span>
          )}
          <ValChip label="对甲合同总计" value={upstreamContractTotal ? `${(upstreamContractTotal / 10000).toFixed(2)} 万` : '待查'} />
          <ValChip label="下游合同合计" value={downContractTotal ? `${(downContractTotal / 10000).toFixed(2)} 万` : '待查'} />
          <ValChip label="对下已付总计" value={downSum.paid ? `${(downSum.paid / 10000).toFixed(2)} 万` : '0.00 万'} />
          <ValChip label="对下未付总计" value={downSum.unpaid ? `${(downSum.unpaid / 10000).toFixed(2)} 万` : '0.00 万'} />
          <ValChip label="下游申报合计" value={downSum.claim ? `${(downSum.claim / 10000).toFixed(2)} 万` : '待查'} />
          <ValChip label="下游认定合计" value={downSum.review ? `${(downSum.review / 10000).toFixed(2)} 万` : '待查'} />
        </div>

        {/* ── 管理人备忘（Memo）── */}
        <Section section={{ key: 'memo', title: '管理人备忘', color: '#3b5b9b', dotColor: '#3b5b9b', bgColor: '#eef2f8' } as any}>
          <div style={{ gridColumn: '1/-1' }}>
            {memos.length === 0 && <p style={{ color: '#6b6b65', fontSize: 13, marginBottom: 8 }}>暂无备忘</p>}
            {memos.map(m => (
              <div key={m.id} style={{ background: '#fafaf9', borderRadius: 6, padding: '8px 12px', marginBottom: 6, border: '1px solid #e8e5df' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', flex: 1 }}>{m.content}</div>
                  <button onClick={() => handleDeleteMemo(m.id)} style={{ border: 'none', background: 'none', color: '#b54545', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>删除</button>
                </div>
                <div style={{ fontSize: 11, color: '#9a978f', marginTop: 4 }}>{m.author} · {new Date(m.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <textarea style={{ ...textareaStyle, flex: 1 }} placeholder="记录一条备忘（动态追踪，时间倒序）" value={newMemo} onChange={e => setNewMemo(e.target.value)} />
              <button onClick={handleAddMemo} style={{ padding: '6px 16px', background: '#3b5b9b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', alignSelf: 'flex-start' }}>+ 添加</button>
            </div>
          </div>
        </Section>

        {/* ── 待办 / 事项提醒 ── */}
        <Section section={{ key: 'todo', title: '待办 / 事项提醒', color: '#9a6b2e', dotColor: '#9a6b2e', bgColor: '#fdf8f0' } as any}>
          <div style={{ gridColumn: '1/-1' }}>
            {todos.length === 0 && <p style={{ color: '#6b6b65', fontSize: 13, marginBottom: 8 }}>暂无待办</p>}
            {todos.map(t => {
              const overdue = !t.done && t.due_date && new Date(t.due_date) < new Date(new Date().toDateString())
              const dueToday = !t.done && t.due_date === new Date().toISOString().slice(0, 10)
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fafaf9', borderRadius: 6, padding: '8px 12px', marginBottom: 6, border: '1px solid #e8e5df' }}>
                  <input type="checkbox" checked={t.done} onChange={e => handleToggleTodo(t.id, e.target.checked)} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? '#9a978f' : '#1a1a18' }}>{t.task}</div>
                  {t.owner && <span style={{ fontSize: 12, color: '#6b6b65' }}>{t.owner}</span>}
                  {t.due_date && (
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: t.done ? '#eef5f0' : overdue ? '#fdf3f3' : dueToday ? '#fdf8f0' : '#f2f1ec', color: t.done ? '#4a7c59' : overdue ? '#b54545' : dueToday ? '#9a6b2e' : '#6b6b65', fontWeight: overdue || dueToday ? 600 : 400 }}>
                      {t.due_date}{overdue ? ' 逾期' : dueToday ? ' 今日' : ''}
                    </span>
                  )}
                  <button onClick={() => handleDeleteTodo(t.id)} style={{ border: 'none', background: 'none', color: '#b54545', cursor: 'pointer', fontSize: 12 }}>删除</button>
                </div>
              )
            })}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, flex: 2, minWidth: 160 }} placeholder="待办事项" value={newTodo.task} onChange={e => setNewTodo(p => ({ ...p, task: e.target.value }))} />
              <input style={{ ...inputStyle, flex: 1, minWidth: 90 }} placeholder="责任人" value={newTodo.owner} onChange={e => setNewTodo(p => ({ ...p, owner: e.target.value }))} />
              <input style={{ ...inputStyle, flex: 1, minWidth: 130 }} type="date" value={newTodo.due_date || ''} onChange={e => setNewTodo(p => ({ ...p, due_date: e.target.value || null }))} />
              <button onClick={handleAddTodo} style={{ padding: '6px 16px', background: '#9a6b2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>+ 添加</button>
            </div>
          </div>
        </Section>

        {/* 所有模块按 SECTIONS 顺序渲染；下游分包内联，置于诉讼仲裁之前 */}
        {SECTIONS.map(section => {
          if (section.showWhen && !section.showWhen(project)) return null
          if (section.key === 'downstream') {
            return (
              <Section key={section.key} section={section}>
                <div style={{ gridColumn: '1/-1', marginBottom: 12 }}>
                  {/* 下游分包开头：对下合同金额总计 / 对下已付总计 / 对下未付总计（自动求和） */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <ValChip label="对下合同金额总计" value={downContractTotal ? `${(downContractTotal / 10000).toFixed(2)} 万` : '0.00 万'} />
                    <ValChip label="对下已付总计" value={downSum.paid ? `${(downSum.paid / 10000).toFixed(2)} 万` : '0.00 万'} />
                    <ValChip label="对下未付总计" value={downSum.unpaid ? `${(downSum.unpaid / 10000).toFixed(2)} 万` : '0.00 万'} />
                  </div>
                  {downstreams.length === 0 && <p style={{ color: '#6b6b65', fontSize: 13, marginBottom: 8 }}>暂无下游分包信息</p>}
                  {downstreams.map((ds, i) => (
                    <div key={ds.id} style={{ background: '#fafaf9', borderRadius: 8, padding: '16px 18px', marginBottom: 14, border: '1px solid #e8e5df' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#4a7c59' }}>下游 {i + 1}</span>
                        <button onClick={() => removeDownstream(ds.id)} style={{ border: 'none', background: 'none', color: '#b54545', cursor: 'pointer', fontSize: 12 }}>删除</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '14px 18px' }}>
                        {DS_FIELDS.map(f => renderDownstreamField(ds, f))}
                      </div>
                      {renderDownstreamContractBlock(ds.id, '#3b5b9b')}
                    </div>
                  ))}
                  <button onClick={addDownstream} style={{ padding: '6px 14px', border: '1px dashed #b0ada0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b6b65', fontFamily: 'inherit' }}>+ 添加下游分包</button>
                </div>
              </Section>
            )
          }
          const fields = getFieldsBySection(section.key)
          const isLitigation = section.key === 'litigation'
          const isWorker = section.key === 'worker'

          if (isLitigation && !project.litigation) {
            const toggleField = fields.find(f => f.key === 'litigation')
            if (toggleField) {
              return (
                <Section key={section.key} section={section}>
                  {renderField(toggleField, project[toggleField.key as keyof Project], (v) => update({ [toggleField.key]: v } as any))}
                </Section>
              )
            }
            return null
          }
          if (isWorker && !project.worker_issue) {
            const toggleField = fields.find(f => f.key === 'worker_issue')
            if (toggleField) {
              return (
                <Section key={section.key} section={section}>
                  {renderField(toggleField, project[toggleField.key as keyof Project], (v) => update({ [toggleField.key]: v } as any))}
                </Section>
              )
            }
            return null
          }

          return (
            <Section key={section.key} section={section}>
              {fields.map(field => {
                if (field.showWhen && !field.showWhen(project)) return null
                const value = (project as any)[field.key]
                return <React.Fragment key={field.key}>{renderField(field, value, (v) => update({ [field.key]: v } as any))}</React.Fragment>
              })}
              {section.key === 'gc' && renderContractBlock('gc', '对甲合同（与总包）', '#3b5b9b')}
              {section.key === 'owner' && project.ld_role === '总包' && renderContractBlock('owner', '对甲合同（与业主）', '#b86e3a')}
            </Section>
          )
        })}

        {/* ── 变更记录（项目活动流）── */}
        <Section section={{ key: 'activity', title: '变更记录', color: '#6b6b65', dotColor: '#9a978f', bgColor: '#f2f1ec' } as any}>
          <div style={{ gridColumn: '1/-1' }}>
            {changes.length === 0 && <p style={{ color: '#6b6b65', fontSize: 13, margin: 0 }}>暂无变更记录</p>}
            {changes.map((c, i) => (
              <div key={c.id || i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, padding: '6px 0', borderBottom: i < changes.length - 1 ? '1px solid #f0eee9' : 'none', color: '#4a4a44' }}>
                <span style={{ color: '#b5b0a6', flexShrink: 0, fontFamily: '"SF Mono","Consolas",monospace' }}>{new Date(c.at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span style={{ color: '#6b6b65', flexShrink: 0 }}>{c.by}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{getFieldByKey(c.field)?.label || c.field}</b>
                  <span style={{ color: '#9a978f' }}>：{c.old_value || '空'} → {c.new_value || '空'}</span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}
