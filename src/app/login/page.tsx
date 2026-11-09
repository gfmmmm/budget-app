'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('비밀번호가 틀렸습니다')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">💰 가계부</h1>
          <p className="text-sm text-center text-slate-500 mb-8">비밀번호를 입력하세요</p>

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50
                       text-slate-800 placeholder:text-slate-400
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       text-base"
          />

          {error && (
            <p className="mt-3 text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="mt-4 w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold
                       hover:bg-indigo-700 active:bg-indigo-800 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {loading ? '확인 중...' : '로그인'}
          </button>
        </div>
      </form>
    </div>
  )
}
