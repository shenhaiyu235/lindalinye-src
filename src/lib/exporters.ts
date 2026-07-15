// 导出工具：详情页 Word / Excel + 大表 Excel
// 无第三方依赖：以 HTML 文档 + BOM 生成 blob，浏览器下载为 .doc / .xls
// 优点：中文零乱码、构建稳定、Word/Excel 均可正常打开

export interface ExportField { label: string; value: string }
export interface ExportGroup { title: string; rows: ExportField[] }
export interface DownstreamExport { name: string; rows: ExportField[] }
export interface MemoExport { author: string; created_at: string; content: string }
export interface TodoExport { task: string; owner: string; due_date: string; done: boolean }
export interface ChangeExport { at: string; by: string; label: string; old_value: string; new_value: string }

export interface ProjectExportData {
  projectName: string
  groups: ExportGroup[]
  downstreams?: DownstreamExport[]
  memos?: MemoExport[]
  todos?: TodoExport[]
  changes?: ChangeExport[]
}

export interface SummaryCol { key: string; label: string; yuan?: boolean }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function nl2br(s: string): string {
  return esc(s).replace(/\n/g, '<br>')
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10)
}

// ───────────────────────── 详情页 → Word (.doc) ─────────────────────────
export function exportProjectWord(d: ProjectExportData) {
  const ts = stamp()
  const groupHtml = d.groups.filter(g => g.rows.length).map(g => `
    <h2>${esc(g.title)}</h2>
    <table>${g.rows.map(r => `<tr><td class="lbl">${esc(r.label)}</td><td>${nl2br(r.value || '—')}</td></tr>`).join('')}</table>`).join('')

  const dsHtml = (d.downstreams || []).map((ds, i) => `
    <h2>下游分包 ${i + 1} · ${esc(ds.name)}</h2>
    <table>${ds.rows.map(r => `<tr><td class="lbl">${esc(r.label)}</td><td>${nl2br(r.value || '—')}</td></tr>`).join('')}</table>`).join('')

  const memoHtml = (d.memos || []).length
    ? `<h2>管理人备忘</h2><table>${d.memos!.map(m => `<tr><td>${nl2br(m.content)}</td><td class="meta">${esc(m.author)} · ${esc(m.created_at)}</td></tr>`).join('')}</table>`
    : ''

  const todoHtml = (d.todos || []).length
    ? `<h2>待办 / 事项提醒</h2><table>${d.todos!.map(t => `<tr><td>${t.done ? '☑' : '☐'} ${nl2br(t.task)}</td><td class="meta">${esc([t.owner, t.due_date].filter(Boolean).join(' · '))}</td></tr>`).join('')}</table>`
    : ''

  const chgHtml = (d.changes || []).length
    ? `<h2>变更记录</h2><table>${d.changes!.map(c => `<tr><td class="meta">${esc(c.at)}　${esc(c.by)}</td><td>${esc(c.label)}：${esc(c.old_value || '空')} → ${esc(c.new_value || '空')}</td></tr>`).join('')}</table>`
    : ''

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>
    body{font-family:"Microsoft YaHei","SimSun",sans-serif;font-size:11pt;color:#222;line-height:1.65;margin:24px}
    h1{font-size:18pt;border-bottom:2px solid #185FA5;padding-bottom:6px;color:#185FA5;margin-bottom:14px}
    h2{font-size:13pt;color:#1f2329;margin:18px 0 6px;border-left:4px solid #185FA5;padding-left:8px}
    table{border-collapse:collapse;width:100%;margin:4px 0 6px}
    td,th{border:1px solid #ccc;padding:5px 9px;font-size:10.5pt;vertical-align:top}
    td.lbl{background:#f4f6f9;color:#5a6068;font-weight:600;width:24%}
    td.meta{color:#8a909a;font-size:9pt;white-space:nowrap}
  </style></head><body>
    <h1>${esc(d.projectName)}</h1>
    ${groupHtml}${dsHtml}${memoHtml}${todoHtml}${chgHtml}
    <p style="color:#9aa0aa;font-size:9pt;margin-top:22px">导出时间：${ts}</p>
  </body></html>`

  triggerDownload(new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' }), `${d.projectName}_全部信息_${ts}.doc`)
}

// ───────────────────────── 详情页 → Excel (.xls) ─────────────────────────
export function exportProjectExcel(d: ProjectExportData) {
  const ts = stamp()
  const block = (title: string, rows: { a: string; b: string }[]) => `
    <tr><td colspan="2" style="background:#185FA5;color:#fff;font-weight:bold;font-size:12px">${esc(title)}</td></tr>
    ${rows.map(r => `<tr><td style="background:#eef1f6;font-weight:bold;width:24%">${esc(r.a)}</td><td style="white-space:normal">${esc(r.b)}</td></tr>`).join('')}`

  const parts: string[] = []
  d.groups.filter(g => g.rows.length).forEach(g => parts.push(block(g.title, g.rows.map(r => ({ a: r.label, b: r.value || '—' })))))
  ;(d.downstreams || []).forEach((ds, i) => parts.push(block(`下游分包 ${i + 1} · ${ds.name}`, ds.rows.map(r => ({ a: r.label, b: r.value || '—' })))))
  ;(d.memos || []).forEach((m, i) => parts.push(block(`管理人备忘 ${i + 1}`, [{ a: `${m.author} · ${m.created_at}`, b: m.content }])))
  ;(d.todos || []).forEach((t, i) => parts.push(block(`待办 ${i + 1}`, [{ a: `${t.done ? '已完成' : '未完成'}${t.owner ? ' · ' + t.owner : ''}${t.due_date ? ' · ' + t.due_date : ''}`, b: t.task }])))
  ;(d.changes || []).forEach((c, i) => parts.push(block(`变更 ${i + 1} · ${c.at} · ${c.by}`, [{ a: c.label, b: `${c.old_value || '空'} → ${c.new_value || '空'}` }])))

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>
    td{border:1px solid #ccc;padding:4px 9px;font-size:12px;white-space:nowrap}
    td:nth-child(2){white-space:normal}
  </style></head><body><table>${parts.join('')}</table></body></html>`

  triggerDownload(new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' }), `${d.projectName}_全部信息_${ts}.xls`)
}

// ───────────────────────── 大表 → Excel (.xls) ─────────────────────────
export function exportSummaryExcel(data: Record<string, any>[], cols: SummaryCol[], filename: string) {
  const headers = cols.map(c => c.label)
  const rows = data.map(p => cols.map(c => {
    const v = p[c.key]
    if (v === null || v === undefined || v === '') return ''
    if (typeof v === 'number') {
      const out = c.yuan ? v / 10000 : v
      return out.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }))

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>
    td,th{border:1px solid #ccc;padding:4px 8px;font-size:12px;white-space:nowrap}
    th{background:#f0f0f0;font-weight:bold}
  </style></head><body><table><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></body></html>`

  triggerDownload(new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' }), filename)
}
