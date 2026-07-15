import React, { useState } from 'react'

interface Props {
  // 返回错误信息（字符串）表示登录失败并展示；返回 null 表示成功
  onSubmit: (email: string, password: string) => Promise<string | null>
}

export default function LoginModal({ onSubmit }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const em = email.trim()
    if (!em || !password) return
    setLoading(true)
    setError(null)
    const err = await onSubmit(em, password)
    setLoading(false)
    if (err) setError(err)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(40,38,34,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '28px 32px', width: 360, boxShadow: '0 8px 30px rgba(0,0,0,0.18)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>登录</h2>
        <p style={{ fontSize: 12, color: '#9a978f', margin: '0 0 18px', lineHeight: 1.5 }}>
          林大林业债权债务管理平台 · 请使用管理人分配的账号登录
        </p>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: '#6b6b65', marginBottom: 4 }}>邮箱</div>
          <input
            autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #e8e5df', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
          />
        </div>
        <div style={{ marginBottom: error ? 10 : 20 }}>
          <div style={{ fontSize: 12, color: '#6b6b65', marginBottom: 4 }}>密码</div>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #e8e5df', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
          />
        </div>
        {error && (
          <div style={{ fontSize: 12, color: '#b54545', margin: '0 0 16px', lineHeight: 1.5 }}>
            {error}
          </div>
        )}
        <button onClick={submit} disabled={!email.trim() || !password || loading}
          style={{ width: '100%', padding: '10px', borderRadius: 6, background: (!email.trim() || !password || loading) ? '#cfccc4' : '#3b5b9b', color: '#fff', border: 'none', cursor: (!email.trim() || !password || loading) ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 500 }}>
          {loading ? '登录中…' : '登录'}
        </button>
      </div>
    </div>
  )
}
