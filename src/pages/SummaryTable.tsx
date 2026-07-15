import React, { useState, useMemo, useEffect } from 'react'
import { Project } from '../lib/types'
import { FIELDS, SECTIONS, getTableColumns, FieldDef, displaySeq, phaseRank } from '../lib/fieldConfig'
import { exportSummaryExcel } from '../lib/exporters'
import { fetchAllDownstreams } from '../lib/db'

interface Props { projects: Project[]; onSelect: (id: string) => void }

const amount = (v: number | null) => v ? v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
const tableCols = getTableColumns()

// 自定义列：对下未付总计 / 对下已付总计（插入到「涉诉」列之前）
const downCustomCols: FieldDef[] = [
  { key: 'down_unpaid_total', label: '对下未付总计', type: 'number', section: 'downstream', yuan: true, tableColumn: { label: '对下未付总计(万)', width: 112, align: 'right', render: 'amount', sortable: true } },
  { key: 'down_paid_total', label: '对下已付总计', type: 'number', section: 'downstream', yuan: true, tableColumn: { label: '对下已付总计(万)', width: 112, align: 'right', render: 'amount', sortable: true } },
]

const btnStyle: React.CSSProperties = { padding: '5px 10px', border: '1px solid #E3E3E0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#5F5E5A' }
const btnSm: React.CSSProperties = { padding: '5px 12px', borderRadius: 6, border: '1px solid #E3E3E0', background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#5F5E5A' }

// 导出逻辑见 lib/exporters.ts（exportSummaryExcel）

// 下拉筛选器
function DropdownFilter({ label, options, value, onChange }: {
  label: string
  options: string[]
  value: string | boolean | null
  onChange: (v: string | null) => void
}) {
  return (
    <select
      value={value ? String(value) : ''}
      onChange={e => onChange(e.target.value || null)}
      style={{
        padding: '5px 10px', border: `1px solid ${value ? '#3b5b9b' : '#e8e5df'}`, borderRadius: 6,
        fontSize: 12, fontFamily: 'inherit', outline: 'none', background: value ? '#eef2f8' : '#fff',
        color: value ? '#3b5b9b' : '#6b6b65', cursor: 'pointer'
      }}
    >
      <option value="">{label}: 全部</option>
      {options.map(o => <option key={o} value={o}>{label}: {o}</option>)}
    </select>
  )
}

export default function SummaryTable({ projects, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string | boolean | null>>({})
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState(1)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const [showColMenu, setShowColMenu] = useState(false)
  const [showFieldPanel, setShowFieldPanel] = useState(false)

  // 列顺序：在「涉诉」列之前插入对下已付/未付总计两列
  const allCols = useMemo(() => {
    const idx = tableCols.findIndex(c => c.key === 'litigation')
    const cols = [...tableCols]
    if (idx >= 0) cols.splice(idx, 0, ...downCustomCols)
    else cols.push(...downCustomCols)
    return cols
  }, [])

  // 拉取全部下游分包，按项目汇总对下已付/未付
  const [downTotals, setDownTotals] = useState<Record<string, { paid: number; unpaid: number }>>({})
  useEffect(() => {
    (async () => {
      try {
        const ds = await fetchAllDownstreams()
        const map: Record<string, { paid: number; unpaid: number }> = {}
        ds.forEach(d => {
          const m = map[d.project_id] || (map[d.project_id] = { paid: 0, unpaid: 0 })
          m.paid += (d.paid || 0); m.unpaid += (d.unpaid || 0)
        })
        setDownTotals(map)
      } catch { /* 表可能尚未就绪 */ }
    })()
  }, [])

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(allCols.map(c => c.key)))

  const setFilter = (key: string, val: string | boolean | null) => setFilters(f => ({ ...f, [key]: val }))
  const toggleCol = (key: string) => setHiddenCols(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  const handleSort = (key: string) => { if (sortKey === key) setSortDir(d => -d); else { setSortKey(key); setSortDir(1) } }

  // 默认排序：并购后(A) 在前、并购前(B) 在后，组内按原序号升序
  const baseSort = (a: Project, b: Project) => {
    const ra = phaseRank(a.phase), rb = phaseRank(b.phase)
    if (ra !== rb) return ra - rb
    return (a.seq ?? 0) - (b.seq ?? 0)
  }
  const filtered = useMemo(() => {
    let result = projects.filter(p => {
      // 文本搜索：项目名称、业主单位、总包单位、项目所在地
      if (search) {
        const s = search.toLowerCase()
        const haystack = [p.name, p.owner_unit, p.gc_unit, p.location, p.case_no].join(' ').toLowerCase()
        if (!haystack.includes(s)) return false
      }
      // 下拉筛选
      for (const [key, val] of Object.entries(filters)) {
        if (!val) continue
        if (key === 'litigation') { if (!p.litigation) return false; continue }
        if (key === 'data_missing') { if (!p.data_missing) return false; continue }
        if ((p as any)[key] !== val) return false
      }
      return true
    })
    if (sortKey) {
      result = [...result].sort((a, b) => {
        if (sortKey === 'seq') return baseSort(a, b) * sortDir
        let va = (a as any)[sortKey], vb = (b as any)[sortKey]
        if (va == null && vb == null) return 0
        if (va == null) return 1; if (vb == null) return -1
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir
        return String(va).localeCompare(String(vb)) * sortDir
      })
    } else {
      result = [...result].sort(baseSort)
    }
    return result
  }, [projects, search, filters, sortKey, sortDir])

  const visibleCols = allCols.filter(c => !hiddenCols.has(c.key))

  // 把对下已付/未付总计注入每行，供渲染与导出使用
  const enriched = useMemo(() => filtered.map(p => ({
    ...p,
    down_unpaid_total: downTotals[p.id]?.unpaid ?? null,
    down_paid_total: downTotals[p.id]?.paid ?? null,
  })), [filtered, downTotals])

  const renderCell = (field: FieldDef, value: any) => {
    const render = field.tableColumn?.render
    if (render === 'amount') return <span style={{ fontFamily: '"SF Mono","Consolas",monospace', fontSize: 12 }}>{amount(field.yuan && value ? value / 10000 : value)}</span>
    if (render === 'tag-litigation') return value ? <span style={{ padding: '2px 6px', borderRadius: 4, background: '#fdf3f3', color: '#b54545', fontSize: 10, fontWeight: 600 }}>是</span> : null
    if (render === 'tag-missing') return value ? <span style={{ padding: '2px 6px', borderRadius: 4, background: '#fdf3f3', color: '#b54545', fontSize: 10, fontWeight: 600 }}>缺</span> : null
    if (render === 'tag-risk') {
      if (!value) return null
      const isHigh = value === '高' || value === '极高(维稳)'
      const isMid = value === '中'
      return <span style={{ padding: '2px 6px', borderRadius: 4, background: isHigh ? '#fdf3f3' : isMid ? '#fdf8f0' : '#eef5f0', color: isHigh ? '#b54545' : isMid ? '#9a6b2e' : '#4a7c59', fontSize: 10, fontWeight: 600 }}>{value}</span>
    }
    if (render === 'tag-role') return value ? <span style={{ padding: '2px 6px', borderRadius: 4, background: value === '总包' ? '#eef2f8' : '#f3effa', color: value === '总包' ? '#3b5b9b' : '#6b4f8a', fontSize: 10, fontWeight: 600 }}>{value}</span> : null
    if (render === 'tag-status') return value || ''
    return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: (field.tableColumn?.width || 120) }}>{value || ''}</span>
  }

  // 导出：字段选择面板
  const exportGroups = SECTIONS.map(s => ({ section: s, cols: allCols.filter(c => c.section === s.key) })).filter(g => g.cols.length)
  const toggleSection = (keys: string[], checked: boolean) => {
    setSelectedKeys(prev => { const n = new Set(prev); keys.forEach(k => checked ? n.add(k) : n.delete(k)); return n })
  }
  const handleExportSelected = () => {
    const cols = allCols.filter(c => selectedKeys.has(c.key))
    if (cols.length === 0) { alert('请至少选择一个字段'); return }
    const ts = new Date().toISOString().slice(0, 10)
    exportSummaryExcel(enriched.map(p => ({ ...p, seq: displaySeq(p) })), cols, `林大林业项目汇总_${ts}.xls`)
    setShowFieldPanel(false)
  }

  // 快捷筛选chips
  const chip = (label: string, key: string, val: string | boolean, count?: number) => (
    <button
      key={String(val)}
      onClick={() => setFilter(key, filters[key] === val ? null : val)}
      style={{
        padding: '4px 12px', borderRadius: 20, border: `1px solid ${filters[key] === val ? 'transparent' : '#e8e5df'}`,
        background: filters[key] === val ? '#3b5b9b' : '#fff', color: filters[key] === val ? '#fff' : '#6b6b65',
        fontSize: 12, cursor: 'pointer', fontWeight: filters[key] === val ? 500 : 400,
        fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .12s'
      }}
    >{label}{count !== undefined ? ` ${count}` : ''}</button>
  )

  const hasFilters = Object.values(filters).some(Boolean) || search

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: '16px 24px' }}>
      {/* 搜索栏 + 快捷筛选 */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <input type="text" placeholder="搜索项目名称/业主/总包/地点/案号..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '6px 12px', border: '1px solid #e8e5df', borderRadius: 8, fontSize: 13, width: 280, fontFamily: 'inherit', outline: 'none', background: '#fff' }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {chip('维稳风险', 'risk_level', '极高(维稳)')}
          {chip('高风险', 'risk_level', '高')}
          {chip('涉诉', 'litigation', '是')}
          {chip('资料缺失', 'data_missing', true)}
          {chip('总包', 'ld_role', '总包')}
          {chip('分包', 'ld_role', '分包')}
          {chip('并购前', 'phase', '并购前')}
          {chip('并购后', 'phase', '并购后')}
          {hasFilters && (
            <button onClick={() => { setFilters({}); setSearch('') }}
              style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid #e8e5df', background: '#fff', color: '#b54545', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>清除筛选</button>
          )}
        </div>
      </div>

      {/* 下拉筛选器 + 导出 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <DropdownFilter label="角色" options={['总包','分包']} value={filters.ld_role} onChange={v => setFilter('ld_role', v)} />
        <DropdownFilter label="模式" options={['自营','转包','合作挂靠']} value={filters.type} onChange={v => setFilter('type', v)} />
        <DropdownFilter label="阶段" options={['并购前','并购后']} value={filters.phase} onChange={v => setFilter('phase', v)} />
        <DropdownFilter label="风险" options={['极高(维稳)','高','中','低']} value={filters.risk_level} onChange={v => setFilter('risk_level', v)} />
        <DropdownFilter label="优先级" options={['P0','P1','P2']} value={filters.priority} onChange={v => setFilter('priority', v)} />
        <DropdownFilter label="对业主结算" options={['未结算','办理中','已结算']} value={filters.owner_settle_status} onChange={v => setFilter('owner_settle_status', v)} />
        <DropdownFilter label="对甲结算" options={['未结算','办理中','已结算']} value={filters.gc_settle_status} onChange={v => setFilter('gc_settle_status', v)} />
        <DropdownFilter label="资料缺失" options={['是']} value={filters.data_missing ? '是' : null} onChange={v => setFilter('data_missing', v ? true : null)} />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b6b65' }}>共 {filtered.length} 条</span>
          {/* 导出字段选择面板 */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowFieldPanel(v => !v)} style={btnStyle}>导出字段 ▾</button>
            {showFieldPanel && (
              <>
                <div onClick={() => setShowFieldPanel(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: '#fff', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.14)', padding: 12, zIndex: 200, width: 360, maxHeight: 460, overflowY: 'auto' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2A', marginBottom: 8 }}>选择导出字段</div>
                  {exportGroups.map(g => (
                    <div key={g.section.key} style={{ marginBottom: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: g.section.color, cursor: 'pointer', marginBottom: 4 }}>
                        <input type="checkbox" checked={g.cols.every(c => selectedKeys.has(c.key))} onChange={e => toggleSection(g.cols.map(c => c.key), e.target.checked)} style={{ margin: 0 }} />
                        {g.section.title}
                        <span style={{ color: '#8a909a', fontWeight: 400, fontSize: 11 }}>（{g.cols.filter(c => selectedKeys.has(c.key)).length}/{g.cols.length}）</span>
                      </label>
                      <div style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {g.cols.map(c => (
                          <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5a6068', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedKeys.has(c.key)} onChange={e => { const n = new Set(selectedKeys); e.target.checked ? n.add(c.key) : n.delete(c.key); setSelectedKeys(n) }} style={{ margin: 0 }} />
                            {c.tableColumn!.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setSelectedKeys(new Set(tableCols.map(c => c.key)))} style={btnSm}>全选</button>
                    <button onClick={() => setSelectedKeys(new Set())} style={btnSm}>清空</button>
                    <button onClick={handleExportSelected} style={{ ...btnSm, background: '#185FA5', color: '#fff', border: 'none' }}>导出 Excel（{allCols.filter(c => selectedKeys.has(c.key)).length}）</button>
                  </div>
                </div>
              </>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowColMenu(!showColMenu)} style={{ padding: '5px 10px', border: '1px solid #e8e5df', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>显示/隐藏列</button>
            {showColMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 8, zIndex: 200, minWidth: 160, maxHeight: 400, overflowY: 'auto' }}>
                {allCols.map(c => (
                  <label key={c.key} style={{ display: 'block', padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!hiddenCols.has(c.key)} onChange={() => toggleCol(c.key)} style={{ marginRight: 6 }} />
                    {c.tableColumn!.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {visibleCols.map(c => (
                <th key={c.key} onClick={() => c.tableColumn?.sortable !== false && handleSort(c.key)}
                  style={{ padding: '9px 10px', textAlign: c.tableColumn?.align === 'right' ? 'right' : 'left', fontWeight: 600, borderBottom: '2px solid #e8e5df', color: '#1a1a18', cursor: c.tableColumn?.sortable !== false ? 'pointer' : 'default', whiteSpace: 'nowrap', userSelect: 'none', fontSize: 11, background: '#f8f7f5', minWidth: c.tableColumn?.width || 80 }}>
                  {c.tableColumn?.label || c.label}
                  {sortKey === c.key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {enriched.map(p => (
              <tr key={p.id} onClick={() => onSelect(p.id)}
                style={{ cursor: 'pointer', borderBottom: '1px solid #f0eee8', background: p.risk_level === '高' ? '#fdf3f3' : p.risk_level === '中' ? '#fdf8f0' : undefined }}
                onMouseEnter={e => { if (!p.risk_level) e.currentTarget.style.background = '#fafaf8' }}
                onMouseLeave={e => { if (!p.risk_level) e.currentTarget.style.background = '' }}>
                {visibleCols.map(c => (
                  <td key={c.key} style={{ padding: '7px 10px', fontSize: 12, textAlign: c.tableColumn?.align === 'right' ? 'right' : 'left' }}>
                    {c.key === 'seq'
                      ? <span style={{ fontFamily: '"SF Mono","Consolas",monospace', fontSize: 12, fontWeight: 500 }}>{displaySeq(p)}</span>
                      : renderCell(c, (p as any)[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 48, color: '#6b6b65', fontSize: 14 }}>没有匹配的项目</div>}
      </div>
    </div>
  )
}
