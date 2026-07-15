// 字段配置文件 —— 所有项目字段的集中定义
// 修改字段：改这里 + 数据库 ALTER TABLE，重新 npm run build 即可
// 金额字段统一：数据库底层存「元」，UI 显示「万元」，由 yuan:true 标记并在读写层自动换算

export type FieldType = 'text' | 'number' | 'select' | 'textarea' | 'date' | 'boolean'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  section: SectionKey
  options?: string[]
  yuan?: boolean          // 数据库存「元」，UI 显示「万元」，读写自动 ÷10000 / ×10000
  tableColumn?: {
    label: string
    width: number
    align?: 'left' | 'right'
    render?: 'amount' | 'tag-risk' | 'tag-litigation' | 'tag-status' | 'tag-role' | 'tag-missing' | 'plain'
    sortable?: boolean
  }
  hidden?: boolean
  showWhen?: (p: Record<string, any>) => boolean
}

export type SectionKey = 'basic' | 'gc' | 'owner' | 'downstream' | 'litigation' | 'worker' | 'docs' | 'management'

export interface SectionDef {
  key: SectionKey
  title: string
  color: string
  dotColor: string
  bgColor: string
  showWhen?: (p: Record<string, any>) => boolean
}

export const SECTIONS: SectionDef[] = [
  { key: 'basic',       title: '项目基本信息',   color: '#3b5b9b', dotColor: '#3b5b9b', bgColor: '#eef2f8' },
  { key: 'gc',          title: '总包信息',       color: '#6b4f8a', dotColor: '#6b4f8a', bgColor: '#f3effa', showWhen: p => p.ld_role === '分包' },
  { key: 'owner',       title: '业主信息',       color: '#b86e3a', dotColor: '#b86e3a', bgColor: '#fdf6f0' },
  { key: 'downstream',  title: '下游信息', color: '#4a7c59', dotColor: '#4a7c59', bgColor: '#eef5f0' },
  { key: 'litigation',  title: '诉讼/仲裁',       color: '#b54545', dotColor: '#b54545', bgColor: '#fdf3f3' },
  { key: 'worker',      title: '农民工工资与维稳', color: '#7b5ea7', dotColor: '#7b5ea7', bgColor: '#f5f1fa' },
  { key: 'docs',        title: '资料完整度',      color: '#3d7a7a', dotColor: '#3d7a7a', bgColor: '#eef5f5' },
  { key: 'management',  title: '管理与风险',      color: '#9a6b2e', dotColor: '#9a6b2e', bgColor: '#fdf8f0' },
]

const SETTLE_STATUS_OPTS = ['未结算', '办理中', '已结算']
const TYPE_OPTS = ['自营', '转包', '合作挂靠']
const RISK_OPTS = ['极高(维稳)', '高', '中', '低']
const PRIORITY_OPTS = ['P0', 'P1', 'P2']
const WORKER_STATUS_OPTS = ['待处理', '处理中', '已解决']
const CASE_STAGE_OPTS = ['未立案', '一审中', '二审中', '再审中', '已判决', '执行中', '已结案']

export const FIELDS: FieldDef[] = [
  // 项目基本信息
  { key: 'seq',             label: '序号',               type: 'number',  section: 'basic', tableColumn: { label: '序号', width: 56 } },
  { key: 'name',            label: '项目名称',            type: 'text',    section: 'basic', tableColumn: { label: '项目名称', width: 200 } },
  { key: 'type',            label: '项目模式',            type: 'select',  section: 'basic', options: TYPE_OPTS, tableColumn: { label: '模式', width: 80 } },
  { key: 'phase',           label: '并购阶段',            type: 'select',  section: 'basic', options: ['并购前', '并购后'], tableColumn: { label: '并购阶段', width: 80 } },
  { key: 'ld_role',         label: '林大林业角色',        type: 'select',  section: 'basic', options: ['总包', '分包'], tableColumn: { label: '角色', width: 70, render: 'tag-role' } },
  { key: 'location',        label: '项目所在地',          type: 'text',    section: 'basic' },

  // 总包信息（ld_role=分包时显示）
  { key: 'gc_unit',         label: '总包单位',            type: 'text',    section: 'gc', tableColumn: { label: '总包单位', width: 140 } },
  { key: 'gc_contact',      label: '总包联系人',          type: 'text',    section: 'gc' },
  { key: 'gc_phone',        label: '总包联系电话',        type: 'text',    section: 'gc' },
  { key: 'gc_received',     label: '对甲已回款(万元)',    type: 'number',  section: 'gc', yuan: true },
  { key: 'gc_remaining',    label: '对甲剩余回款(万元)',  type: 'number',  section: 'gc', yuan: true, tableColumn: { label: '对甲剩余(万)', width: 100, align: 'right', render: 'amount', sortable: true } },
  { key: 'gc_settle_status',label: '对甲结算情况',        type: 'select',  section: 'gc', options: SETTLE_STATUS_OPTS, tableColumn: { label: '对甲结算', width: 80 } },
  { key: 'gc_settle_note',  label: '结算进展说明',        type: 'textarea', section: 'gc' },

  // 业主信息
  { key: 'owner_unit',             label: '业主单位',            type: 'text',    section: 'owner', tableColumn: { label: '业主单位', width: 160 } },
  { key: 'owner_contact',          label: '业主联系人',          type: 'text',    section: 'owner', showWhen: p => p.ld_role === '总包' },
  { key: 'owner_phone',            label: '业主联系电话',        type: 'text',    section: 'owner' },
  { key: 'owner_received',         label: '对甲已回款(万元)',    type: 'number',  section: 'owner', yuan: true, showWhen: p => p.ld_role === '总包' },
  { key: 'owner_remaining',        label: '对甲剩余回款(万元)',  type: 'number',  section: 'owner', yuan: true, showWhen: p => p.ld_role === '总包', tableColumn: { label: '对甲剩余(万)', width: 100, align: 'right', render: 'amount', sortable: true } },
  { key: 'owner_settle_status',    label: '对业主结算情况',      type: 'select',  section: 'owner', options: SETTLE_STATUS_OPTS, tableColumn: { label: '对业主结算', width: 80 } },
  { key: 'owner_to_gc_settle',     label: '对总包结算情况',      type: 'select',  section: 'owner', options: SETTLE_STATUS_OPTS, showWhen: p => p.ld_role === '分包' },
  { key: 'owner_settle_note',      label: '结算进展说明',        type: 'textarea', section: 'owner' },

  // 诉讼
  { key: 'litigation',      label: '是否涉诉',           type: 'boolean', section: 'litigation', tableColumn: { label: '涉诉', width: 60, render: 'tag-litigation' } },
  { key: 'case_type',       label: '案件性质',           type: 'select',  section: 'litigation', options: ['主诉', '被诉', '仲裁'] },
  { key: 'litigant_role',   label: '诉讼地位',           type: 'select',  section: 'litigation', options: ['原告', '被告', '第三人', '申请执行人', '被执行人'] },
  { key: 'case_no',         label: '案号',               type: 'text',    section: 'litigation' },
  { key: 'court',           label: '受理法院',           type: 'text',    section: 'litigation' },
  { key: 'case_stage',      label: '诉讼阶段',           type: 'select',  section: 'litigation', options: CASE_STAGE_OPTS, tableColumn: { label: '诉讼阶段', width: 80 } },
  { key: 'dispute_amt',     label: '争议金额(万元)',     type: 'number',  section: 'litigation', yuan: true },
  { key: 'judgment',        label: '判决结果摘要',       type: 'textarea', section: 'litigation' },
  { key: 'execution',       label: '执行情况',           type: 'textarea', section: 'litigation' },

  // 农民工工资与维稳
  { key: 'worker_issue',    label: '是否涉及农民工工资问题', type: 'boolean', section: 'worker', tableColumn: { label: '涉农', width: 60, render: 'tag-missing' } },
  { key: 'worker_count',    label: '涉及人数',           type: 'number',  section: 'worker' },
  { key: 'worker_amt',      label: '涉及金额(万元)',     type: 'number',  section: 'worker', yuan: true },
  { key: 'worker_status',   label: '处理状态',           type: 'select',  section: 'worker', options: WORKER_STATUS_OPTS },
  { key: 'worker_note',     label: '事实描述',           type: 'textarea', section: 'worker' },

  // 资料完整度（项目级：先选是否缺失，再填说明；资料存放情况开放文本）
  { key: 'data_missing',        label: '资料是否缺失',   type: 'boolean', section: 'docs', tableColumn: { label: '资料缺失', width: 70, render: 'tag-missing' } },
  { key: 'data_missing_note',   label: '缺失情况说明',   type: 'textarea', section: 'docs' },
  { key: 'doc_storage_status',  label: '资料存放情况',   type: 'text',    section: 'docs' },

  // 管理
  { key: 'risk_level',      label: '风险等级',     type: 'select',  section: 'management', options: RISK_OPTS, tableColumn: { label: '风险', width: 80, render: 'tag-risk' } },
  { key: 'priority',        label: '优先级',       type: 'select',  section: 'management', options: PRIORITY_OPTS, tableColumn: { label: '优先级', width: 60 } },
  { key: 'fact_summary',    label: '核心事实确认摘要', type: 'textarea', section: 'management' },
  { key: 'next_steps',      label: '下一步工作',   type: 'textarea', section: 'management' },
  { key: 'remark',          label: '备注',         type: 'textarea', section: 'management', tableColumn: { label: '备注', width: 160 } },
]

// 辅助函数
export function getFieldByKey(key: string): FieldDef | undefined {
  return FIELDS.find(f => f.key === key)
}

export function getFieldsBySection(section: SectionKey): FieldDef[] {
  return FIELDS.filter(f => f.section === section && !f.hidden)
}

export function getTableColumns(): FieldDef[] {
  return FIELDS.filter(f => f.tableColumn && !f.hidden)
}

// 序号显示：并购后 → A-数字，并购前 → B-数字（数字沿用原 seq 值，不重排）
export function displaySeq(p: { seq: number | null; phase: string }): string {
  if (p.seq == null) return '—'
  if (p.phase === '并购后') return `A-${p.seq}`
  if (p.phase === '并购前') return `B-${p.seq}`
  return String(p.seq)
}

// 阶段排序权重：并购后(0) < 并购前(1) < 未设置(2)
// 用于目录页 / 大表默认排序：并购后(A) 整体在前，并购前(B) 整体在后
export function phaseRank(phase: string): number {
  if (phase === '并购后') return 0
  if (phase === '并购前') return 1
  return 2
}
