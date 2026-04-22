'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, ensureAnonymousSession } from '@/lib/supabase/client'

export default function HomePage() {
  const router = useRouter()
  const [name,     setName]     = useState('')
  const [code,     setCode]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) { setError('הכנס שם'); return }
    setLoading(true)
    setError(null)
    try {
      await ensureAnonymousSession()
      const { data, error: rpcErr } = await supabase.rpc('rpc_create_room', {
        p_display_name: name.trim(),
      })
      if (rpcErr) throw rpcErr
      router.push(`/room/${data.room_code}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה')
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!name.trim()) { setError('הכנס שם'); return }
    if (!code.trim()) { setError('הכנס קוד חדר'); return }
    setLoading(true)
    setError(null)
    try {
      await ensureAnonymousSession()
      const { error: rpcErr } = await supabase.rpc('rpc_join_room', {
        p_room_code:    code.trim().toUpperCase(),
        p_display_name: name.trim(),
      })
      if (rpcErr) throw rpcErr
      router.push(`/room/${code.trim().toUpperCase()}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה')
      setLoading(false)
    }
  }

  const inputClass = 'w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-center text-lg'

  return (
    <main className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <h1 className="text-4xl font-black text-center text-white tracking-tight">
          משחק זיכרון
        </h1>

        <input
          type="text"
          placeholder="השם שלך..."
          value={name}
          onChange={e => setName(e.target.value)}
          className={inputClass}
          maxLength={20}
          disabled={loading}
        />

        <button
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-lg transition-colors"
        >
          {loading ? 'טוען...' : 'צור חדר'}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-slate-500 text-sm">או</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        <input
          type="text"
          placeholder="קוד חדר..."
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          className={`${inputClass} tracking-widest`}
          maxLength={6}
          disabled={loading}
        />

        <button
          onClick={handleJoin}
          disabled={loading || !name.trim() || !code.trim()}
          className="w-full py-4 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-lg transition-colors"
        >
          {loading ? 'טוען...' : 'הצטרף לחדר'}
        </button>

        {error && (
          <p className="text-center text-red-400 text-sm">{error}</p>
        )}
      </div>
    </main>
  )
}
