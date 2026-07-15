import { supabase } from './supabase'
import type { Project, Downstream, DownstreamContract, Memo, Todo, Contract } from './types'

// 当前身份缓存：由 App 在 Supabase Auth 登录/切换时写入，供数据层同步署名使用
let _cachedUser: { name: string; role: string } | null = null

export function setCurrentUser(u: { name: string; role: string }): void {
  _cachedUser = u
  try { localStorage.setItem('ldly_user', JSON.stringify(u)) } catch {}
}

export function getCurrentUser(): { name: string; role: string } {
  if (_cachedUser && _cachedUser.name) return _cachedUser
  try {
    const raw = localStorage.getItem('ldly_user')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { name: '', role: '' }
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('seq', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data || []) as Project[]
}

export async function fetchProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Project
}

// 保存项目：自动写入操作人，并将变更字段记入 change_log
export async function saveProject(project: Partial<Project> & { id: string }): Promise<void> {
  const user = getCurrentUser()
  const by = user.name || '未登录'
  // 先取旧值以比对变更
  const prev = await fetchProject(project.id)
  const { error } = await supabase
    .from('projects')
    .upsert({ ...project, updated_by: by }, { onConflict: 'id' })
  if (error) throw error
  if (prev) {
    const changed: { field: string; old_value: any; new_value: any }[] = []
    for (const k of Object.keys(project)) {
      if (k === 'id' || k === 'updated_at' || k === 'created_at' || k === 'updated_by') continue
      const o = (prev as any)[k]
      const n = (project as any)[k]
      if (JSON.stringify(o ?? null) !== JSON.stringify(n ?? null)) {
        changed.push({ field: k, old_value: o ?? null, new_value: n ?? null })
      }
    }
    if (changed.length) {
      try {
        await supabase.from('change_log').insert(
          changed.map(c => ({ project_id: project.id, field: c.field, old_value: String(c.old_value), new_value: String(c.new_value), by }))
        )
      } catch (e) {
        console.warn('change_log 写入失败（表可能尚未创建）：', e)
      }
    }
  }
}

export async function createProject(name: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({ name })
    .select()
    .single()
  if (error) throw error
  return data as Project
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}

export async function fetchDownstreams(projectId: string): Promise<Downstream[]> {
  const { data, error } = await supabase
    .from('downstreams')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order')
  if (error) throw error
  return (data || []) as Downstream[]
}

export async function saveDownstream(ds: Partial<Downstream> & { project_id: string }): Promise<Downstream> {
  const { data, error } = await supabase
    .from('downstreams')
    .upsert(ds, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data as Downstream
}

export async function deleteDownstream(id: string): Promise<void> {
  const { error } = await supabase.from('downstreams').delete().eq('id', id)
  if (error) throw error
}

// 拉取某项目全部下游分包（汇总大表计算对下已付/未付总计用）
export async function fetchAllDownstreams(): Promise<Downstream[]> {
  const { data, error } = await supabase
    .from('downstreams')
    .select('*')
  if (error) throw error
  return (data || []) as Downstream[]
}

// ── Contracts（对甲合同：与总包 gc / 与业主 owner，支持多份）──
export async function fetchContracts(projectId: string): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order')
  if (error) throw error
  return (data || []) as Contract[]
}

export async function saveContract(c: Partial<Contract> & { project_id: string }): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .upsert(c, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data as Contract
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) throw error
}

// ── Downstream Contracts（对下合同：每个下游分包可签多份）──
export async function fetchDownstreamContracts(downstreamId: string): Promise<DownstreamContract[]> {
  const { data, error } = await supabase
    .from('downstream_contracts')
    .select('*')
    .eq('downstream_id', downstreamId)
    .order('sort_order')
  if (error) throw error
  return (data || []) as DownstreamContract[]
}

export async function fetchAllDownstreamContracts(): Promise<DownstreamContract[]> {
  const { data, error } = await supabase
    .from('downstream_contracts')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return (data || []) as DownstreamContract[]
}

export async function saveDownstreamContract(c: Partial<DownstreamContract> & { downstream_id: string }): Promise<DownstreamContract> {
  const { data, error } = await supabase
    .from('downstream_contracts')
    .upsert(c, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data as DownstreamContract
}

export async function deleteDownstreamContract(id: string): Promise<void> {
  const { error } = await supabase.from('downstream_contracts').delete().eq('id', id)
  if (error) throw error
}

// ── Memo（管理人备忘）──
export async function fetchMemos(projectId: string): Promise<Memo[]> {
  const { data, error } = await supabase
    .from('memos')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Memo[]
}

export async function addMemo(projectId: string, content: string): Promise<void> {
  const user = getCurrentUser()
  const { error } = await supabase.from('memos').insert({ project_id: projectId, content, author: user.name || '未登录' })
  if (error) throw error
}

export async function deleteMemo(id: string): Promise<void> {
  const { error } = await supabase.from('memos').delete().eq('id', id)
  if (error) throw error
}

// 跨项目拉取最近备忘（首页工作台用），表缺失时由调用方 try/catch 兜底
export async function fetchAllMemos(): Promise<(Memo & { project_name: string })[]> {
  const { data, error } = await supabase
    .from('memos')
    .select('*, projects(name)')
    .order('created_at', { ascending: false })
    .limit(8)
  if (error) throw error
  return ((data || []) as any[]).map(r => ({ ...r, project_name: r.projects?.name || '' }))
}

// ── Todo（待办 / 事项提醒）──
export async function fetchTodos(projectId: string): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('project_id', projectId)
    .order('done', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data || []) as Todo[]
}

export async function fetchAllTodos(): Promise<(Todo & { project_name: string })[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*, projects(name)')
    .order('done', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return ((data || []) as any[]).map(r => ({ ...r, project_name: r.projects?.name || '' }))
}

export async function addTodo(projectId: string, task: string, owner: string, due_date: string | null): Promise<void> {
  const { error } = await supabase.from('todos').insert({ project_id: projectId, task, owner, due_date })
  if (error) throw error
}

export async function updateTodo(id: string, patch: Partial<Todo>): Promise<void> {
  const { error } = await supabase.from('todos').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from('todos').delete().eq('id', id)
  if (error) throw error
}

// ── 变更日志 ──
export async function fetchChangeLog(projectId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('change_log')
    .select('*')
    .eq('project_id', projectId)
    .order('at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data || []) as any[]
}

// 跨项目聚合近期动态（不 JOIN，避免依赖外键；项目名由前端按 project_id 映射）
export async function fetchAllActivities(limit = 12): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('change_log')
      .select('id, project_id, field, old_value, new_value, by, at')
      .order('at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data || []) as any[]
  } catch (e) {
    console.warn('近期动态加载失败（change_log 表可能尚未创建）：', e)
    return []
  }
}

export function subscribeToProjects(callback: () => void) {
  return supabase
    .channel('projects-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, callback)
    .subscribe()
}
