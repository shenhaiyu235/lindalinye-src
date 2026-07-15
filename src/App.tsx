import React, { useState, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Project } from './lib/types'
import { fetchProjects, subscribeToProjects, setCurrentUser } from './lib/db'
import { supabase } from './lib/supabase'
import ProjectList from './pages/ProjectList'
import ProjectDetail from './pages/ProjectDetail'
import SummaryTable from './pages/SummaryTable'
import TodosPage from './pages/TodosPage'
import RiskBoard from './pages/RiskBoard'
import ChangeHistory from './pages/ChangeHistory'
import LoginModal from './components/LoginModal'

type Page = 'list' | 'detail' | 'summary' | 'todos' | 'risk' | 'history'

interface Identity { name: string; role: string }
interface OnlineUser { name: string; role: string }

// 从 Supabase 会话推导展示身份：姓名取 user_metadata.name，缺省用邮箱前缀；角色取 user_metadata.role，缺省"填报"
function identityFromSession(session: Session | null): Identity {
  const u = session?.user
  if (!u) return { name: '', role: '' }
  const meta: any = u.user_metadata || {}
  const name = meta.name || meta.full_name || (u.email ? u.email.split('@')[0] : '用户')
  const role = meta.role === '只读' ? '只读' : '填报'
  return { name, role }
}

// 把常见 Auth 报错翻译成中文
function zhAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return '邮箱或密码不正确'
  if (m.includes('email not confirmed')) return '该账号邮箱尚未确认（请在 Supabase 关闭邮箱确认或确认后再登录）'
  if (m.includes('rate limit') || m.includes('too many')) return '尝试过于频繁，请稍后再试'
  if (m.includes('network')) return '网络异常，请检查网络后重试'
  return msg || '登录失败，请重试'
}

export default function App() {
  const [page, setPage] = useState<Page>('list')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)

  // Supabase Auth 会话
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  const user = identityFromSession(session)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchProjects()
      setProjects(data)
    } catch (e) {
      console.error('Failed to load projects:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始化会话 + 监听登录状态变化
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCurrentUser(identityFromSession(data.session))
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      setCurrentUser(identityFromSession(sess))
    })
    return () => { sub.subscription.unsubscribe() }
  }, [])

  // 登录后加载数据 + 订阅实时变更
  useEffect(() => {
    if (!session) { setProjects([]); return }
    loadProjects()
    const sub = subscribeToProjects(() => loadProjects())
    return () => { sub.unsubscribe() }
  }, [session, loadProjects])

  // Realtime 在线状态（presence）
  useEffect(() => {
    if (!session || !user.name) return
    const key = `${user.name}-${Math.random().toString(36).slice(2, 8)}`
    const channel = supabase.channel('ldly-presence', { config: { presence: { key } } })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, OnlineUser[]>
        const list: OnlineUser[] = []
        const seen = new Set<string>()
        Object.values(state).forEach(arr => arr.forEach(u => {
          if (u?.name && !seen.has(u.name)) { seen.add(u.name); list.push(u) }
        }))
        setOnlineUsers(list)
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') await channel.track({ name: user.name, role: user.role })
      })
    return () => { supabase.removeChannel(channel) }
  }, [session, user.name, user.role])

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash.startsWith('project/')) {
      setPage('detail')
      setProjectId(hash.replace('project/', ''))
    } else if (hash === 'summary') {
      setPage('summary')
    } else if (hash === 'todos') {
      setPage('todos')
    } else if (hash === 'risk') {
      setPage('risk')
    } else if (hash === 'history') {
      setPage('history')
    } else {
      setPage('list')
    }
  }, [])

  const navigate = (p: Page, id?: string) => {
    setPage(p)
    setProjectId(id || null)
    if (p === 'detail' && id) window.location.hash = `project/${id}`
    else if (p === 'summary') window.location.hash = 'summary'
    else if (p === 'todos') window.location.hash = 'todos'
    else if (p === 'risk') window.location.hash = 'risk'
    else if (p === 'history') window.location.hash = 'history'
    else { window.location.hash = ''; setProjectId(null) }
  }

  const handleLogin = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? zhAuthError(error.message) : null
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setCurrentUser({ name: '', role: '' })
    try { localStorage.removeItem('ldly_user') } catch {}
    setOnlineUsers([])
  }

  // 会话尚未确定：短暂加载态
  if (!authReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#5F5E5A', fontSize: 14 }}>
        加载中...
      </div>
    )
  }

  // 未登录：只显示登录框，屏蔽所有数据界面
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F5F7' }}>
        <LoginModal onSubmit={handleLogin} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7' }}>
      <AppHeader
        page={page}
        user={user}
        onlineUsers={onlineUsers}
        onNavigate={(p) => navigate(p)}
        onLogout={handleLogout}
      />
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#5F5E5A', fontSize: 14 }}>
          加载中...
        </div>
      ) : (
        <>
          {page === 'list' && (
            <ProjectList projects={projects} onSelect={(id) => navigate('detail', id)} onRefresh={loadProjects} onOpenTodos={() => navigate('todos')} onOpenHistory={() => navigate('history')} />
          )}
          {page === 'detail' && projectId && (
            <ProjectDetail
              projectId={projectId}
              onBack={() => navigate('list')}
              onUpdate={loadProjects}
              readOnly={user.role === '只读'}
            />
          )}
          {page === 'summary' && (
            <SummaryTable projects={projects} onSelect={(id) => navigate('detail', id)} />
          )}
          {page === 'risk' && (
            <RiskBoard projects={projects} onSelect={(id) => navigate('detail', id)} />
          )}
          {page === 'history' && (
            <ChangeHistory onBack={() => navigate('list')} />
          )}
          {page === 'todos' && (
            <TodosPage onOpenProject={(id) => navigate('detail', id)} />
          )}
        </>
      )}
    </div>
  )
}

function Avatar({ name, role, color }: { name: string; role: string; color: string }) {
  const ch = name ? name.slice(0, 1) : '?'
  return (
    <span title={`${name} · ${role}`}
      style={{ width: 26, height: 26, borderRadius: '50%', background: color, color: '#fff', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', flexShrink: 0 }}>
      {ch}
    </span>
  )
}

function AppHeader({ page, user, onlineUsers, onNavigate, onLogout }: {
  page: Page; user: Identity; onlineUsers: OnlineUser[]; onNavigate: (p: Page) => void; onLogout: () => void
}) {
  const linkStyle = (p: Page): React.CSSProperties => ({
    padding: '6px 16px', border: 'none', borderRadius: 6, cursor: 'pointer',
    fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
    background: page === p ? '#185FA5' : 'transparent',
    color: page === p ? '#fff' : '#5F5E5A',
    transition: 'all .15s'
  })

  // 在线协作者头像配色
  const colors = ['#185FA5', '#534AB7', '#3B6D11', '#BA7517', '#BA7517', '#A32D2D']
  const others = onlineUsers.filter(u => u.name !== user.name)

  return (
    <header style={{ background: '#fff', borderBottom: '1px solid #E3E3E0', padding: '12px 24px', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 17, fontWeight: 600, color: '#2C2C2A', whiteSpace: 'nowrap' }}>林大林业项目管理</h1>
          <nav style={{ display: 'flex', gap: 4 }}>
            <button style={linkStyle('list')} onClick={() => onNavigate('list')}>项目目录</button>
            <button style={linkStyle('summary')} onClick={() => onNavigate('summary')}>汇总大表</button>
            <button style={linkStyle('risk')} onClick={() => onNavigate('risk')}>风险看板</button>
            <button style={linkStyle('todos')} onClick={() => onNavigate('todos')}>我的待办</button>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* 在线协作人（排除当前用户，避免头像重复） */}
          {user.name && others.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex' }}>
                {others.slice(0, 5).map((u, i) => (
                  <span key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                    <Avatar name={u.name} role={u.role} color={colors[(u.name.charCodeAt(0) || 0) % colors.length]} />
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 11, color: '#888780', marginLeft: 6 }}>
                {others.length} 人在线
              </span>
            </div>
          )}
          {/* ProjectDetail 会把保存按钮投射到这里 */}
          <div id="header-detail-actions" />
          <button onClick={onLogout} title="退出登录"
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #E3E3E0', background: '#fff', color: '#5F5E5A', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
            退出
          </button>
          {/* 身份标识：最右侧 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 16, border: '1px solid #E3E3E0', background: '#F1EFE8' }}>
            <Avatar name={user.name} role={user.role} color={user.role === '只读' ? '#888780' : '#185FA5'} />
            <span style={{ fontSize: 12, color: '#5F5E5A' }}>{user.name}</span>
            <span style={{ fontSize: 11, color: user.role === '只读' ? '#888780' : '#185FA5', fontWeight: 600 }}>{user.role}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
