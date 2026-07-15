import React, { useMemo } from 'react'
import { Project } from '../lib/types'

interface Props {
  projects: Project[]
  onSelect: (id: string) => void
}

const RISK_COLOR: Record<string, string> = {
  '极高(维稳)': '#7b5ea7', '高': '#b54545', '中': '#9a6b2e', '低': '#4a7c59', '': '#b5b0a6'
}
const wan = (v: number | null) => v ? (v / 10000).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'

function DistBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: '#4a4a44' }}>{label}</span>
        <span style={{ color: '#6b6b65' }}>{count}<span style={{ color: '#b5b0a6' }}>（{pct}%）</span></span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#f0eee9', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width .3s' }} />
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', marginBottom: 12, paddingBottom: 6, borderBottom: '1.5px solid #e8e5df' }}>{title}</div>
      {children}
    </div>
  )
}

export default function RiskBoard({ projects, onSelect }: Props) {
  const stats = useMemo(() => {
    const total = projects.length
    const byRisk: Record<string, number> = { '极高(维稳)': 0, '高': 0, '中': 0, '低': 0, '': 0 }
    const byType: Record<string, number> = { '自营': 0, '转包': 0, '合作挂靠': 0, '': 0 }
    const byPriority: Record<string, number> = { 'P0': 0, 'P1': 0, 'P2': 0, '': 0 }
    let litigation = 0, worker = 0, dataMissing = 0
    const caseType: Record<string, number> = { '主诉': 0, '被诉': 0, '仲裁': 0 }
    const caseStage: Record<string, number> = {}
    const workerStatus: Record<string, number> = {}
    const typeUnpaid: Record<string, number> = { '自营': 0, '转包': 0, '合作挂靠': 0, '': 0 }
    let unpaidTotal = 0

    for (const p of projects) {
      byRisk[p.risk_level] = (byRisk[p.risk_level] || 0) + 1
      byType[p.type] = (byType[p.type] || 0) + 1
      byPriority[p.priority] = (byPriority[p.priority] || 0) + 1
      if (p.litigation) {
        litigation++
        if (p.case_type) caseType[p.case_type] = (caseType[p.case_type] || 0) + 1
        if (p.case_stage) caseStage[p.case_stage] = (caseStage[p.case_stage] || 0) + 1
      }
      if (p.worker_issue) {
        worker++
        if (p.worker_status) workerStatus[p.worker_status] = (workerStatus[p.worker_status] || 0) + 1
      }
      if (p.data_missing) dataMissing++
      const up = (Number(p.owner_remaining) || 0) + (Number(p.gc_remaining) || 0)
      unpaidTotal += up
      typeUnpaid[p.type] = (typeUnpaid[p.type] || 0) + up
    }

    const topRisk = projects
      .filter(p => p.risk_level === '极高(维稳)' || p.risk_level === '高')
      .sort((a, b) => {
        const order = (r: string) => (r === '极高(维稳)' ? 0 : r === '高' ? 1 : 2)
        if (order(a.risk_level) !== order(b.risk_level)) return order(a.risk_level) - order(b.risk_level)
        const ua = (Number(a.owner_remaining) || 0) + (Number(a.gc_remaining) || 0)
        const ub = (Number(b.owner_remaining) || 0) + (Number(b.gc_remaining) || 0)
        return ub - ua
      })

    return { total, byRisk, byType, byPriority, litigation, worker, dataMissing, caseType, caseStage, workerStatus, typeUnpaid, unpaidTotal, topRisk }
  }, [projects])

  const statCard = (label: string, value: string, color: string) => (
    <div style={{ background: '#fff', borderRadius: 8, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11, color: '#6b6b65', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px' }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 14px' }}>风险看板</h2>

      {/* 概览 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
        {statCard('项目总数', String(stats.total), '#3b5b9b')}
        {statCard('极高(维稳)', String(stats.byRisk['极高(维稳)']), '#7b5ea7')}
        {statCard('高风险', String(stats.byRisk['高']), '#b54545')}
        {statCard('涉诉项目', String(stats.litigation), '#b54545')}
        {statCard('涉及农民工', String(stats.worker), '#7b5ea7')}
        {statCard('资料缺失', String(stats.dataMissing), '#b86e3a')}
        {statCard('对下未付款(万)', wan(stats.unpaidTotal), '#9a6b2e')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 16 }}>
        {/* 风险等级分布 */}
        <Panel title="风险等级分布">
          {(['极高(维稳)', '高', '中', '低', ''] as const).map(r => (
            <DistBar key={r} label={r || '未评级'} count={stats.byRisk[r]} total={stats.total} color={RISK_COLOR[r]} />
          ))}
        </Panel>

        {/* 业务模式分布 + 对下未付款 */}
        <Panel title="业务模式 · 对下未付款">
          {(['自营', '转包', '合作挂靠', ''] as const).map(t => (
            <DistBar key={t} label={(t || '未填') + ' · ' + wan(stats.typeUnpaid[t]) + ' 万'} count={stats.byType[t]} total={stats.total} color="#3b5b9b" />
          ))}
        </Panel>

        {/* 涉诉分布 */}
        <Panel title="涉诉分布">
          <DistBar label="涉诉项目" count={stats.litigation} total={stats.total} color="#b54545" />
          {Object.entries(stats.caseType).filter(([, c]) => c > 0).map(([k, c]) => (
            <DistBar key={k} label={'  └ ' + k} count={c} total={stats.litigation} color="#c97a7a" />
          ))}
          {Object.entries(stats.caseStage).filter(([, c]) => c > 0).map(([k, c]) => (
            <DistBar key={k} label={'  └ 阶段·' + k} count={c} total={stats.litigation} color="#c97a7a" />
          ))}
          {stats.litigation === 0 && <div style={{ fontSize: 12, color: '#9a978f' }}>暂无涉诉项目</div>}
        </Panel>

        {/* 农民工/维稳 */}
        <Panel title="农民工 / 维稳">
          <DistBar label="涉及农民工" count={stats.worker} total={stats.total} color="#7b5ea7" />
          {Object.entries(stats.workerStatus).filter(([, c]) => c > 0).map(([k, c]) => (
            <DistBar key={k} label={'  └ ' + k} count={c} total={stats.worker} color="#9b7eae" />
          ))}
          {stats.worker === 0 && <div style={{ fontSize: 12, color: '#9a978f' }}>暂无农民工工资事项</div>}
        </Panel>

        {/* 优先级分布 */}
        <Panel title="优先级分布">
          {(['P0', 'P1', 'P2', ''] as const).map(pr => (
            <DistBar key={pr} label={pr || '未定级'} count={stats.byPriority[pr]} total={stats.total} color={pr === 'P0' ? '#b54545' : pr === 'P1' ? '#9a6b2e' : '#4a7c59'} />
          ))}
        </Panel>
      </div>

      {/* Top 风险项目 */}
      <Panel title={`重点关注项目（极高维稳 / 高风险，共 ${stats.topRisk.length} 个）`}>
        {stats.topRisk.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9a978f' }}>暂无高风险项目</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats.topRisk.map(p => {
              const up = (Number(p.owner_remaining) || 0) + (Number(p.gc_remaining) || 0)
              return (
                <div key={p.id} onClick={() => onSelect(p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 6, background: '#fafaf9', border: '1px solid #e8e5df', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#c9c4ba')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8e5df')}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: RISK_COLOR[p.risk_level], flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: '#6b6b65', minWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{p.owner_unit || ''}</span>
                  {p.litigation && <span style={{ padding: '2px 8px', borderRadius: 4, background: '#fdf3f3', color: '#b54545', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>涉诉</span>}
                  {p.worker_issue && <span style={{ padding: '2px 8px', borderRadius: 4, background: '#f3effa', color: '#7b5ea7', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>维稳</span>}
                  <span style={{ fontFamily: '"SF Mono","Consolas",monospace', fontSize: 12, color: '#9a6b2e', flexShrink: 0 }}>{wan(up)} 万</span>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
