'use client'

import { useState, useEffect, useRef } from 'react'
import { Expense } from '@/types'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, CATEGORY_EMOJI } from '@/lib/constants'
import { format } from 'date-fns'

interface Props {
  mode: 'add' | 'edit'
  expense?: Expense | null
  categories: string[]
  onClose: () => void
  onSave: () => void
}

export default function ExpenseModal({ mode, expense, categories, onClose, onSave }: Props) {
  const allCats = Array.from(new Set([...categories, ...CATEGORIES]))
  const [title, setTitle] = useState(expense?.title ?? '')
  const [amount, setAmount] = useState(expense?.amount?.toString() ?? '')
  const [date, setDate] = useState(expense?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const [category, setCategory] = useState(expense?.category ?? '기타')
  const [saving, setSaving] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // ESC 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    if (!title.trim() || !amount || !date) return
    setSaving(true)

    try {
      if (mode === 'add') {
        const { error } = await supabase.from('expenses').insert({
          title: title.trim(),
          amount: parseInt(amount),
          date,
          category,
          value_type: null,
          excluded: false,
        })
        if (error) throw error
      } else if (expense) {
        const { error } = await supabase.from('expenses').update({
          title: title.trim(),
          amount: parseInt(amount),
          date,
          category,
        }).eq('id', expense.id)
        if (error) throw error
      }
      onSave()
      onClose()
    } catch {
      alert('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!expense || !confirm('삭제하시겠습니까?')) return
    setSaving(true)
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
      if (error) throw error
      onSave()
      onClose()
    } catch {
      alert('삭제 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      className="sheet-overlay fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
    >
      <div className="sheet-content bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 pb-8 max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-800">
            {mode === 'add' ? '지출 추가' : '지출 수정'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        {/* 거래처명 */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-slate-600 mb-1 block">거래처명</span>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="예: 스타벅스 강남점"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
          />
        </label>

        {/* 금액 */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-slate-600 mb-1 block">금액</span>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
          />
        </label>

        {/* 날짜 */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-slate-600 mb-1 block">날짜</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
          />
        </label>

        {/* 카테고리 */}
        <div className="mb-6">
          <span className="text-sm font-medium text-slate-600 mb-2 block">카테고리</span>
          <div className="flex flex-wrap gap-2">
            {allCats.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  category === cat
                    ? 'bg-indigo-600 border-indigo-600 text-white font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300'
                }`}
              >
                {CATEGORY_EMOJI[cat] || ''} {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          {mode === 'edit' && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-3 rounded-xl border border-red-200 text-red-500 font-semibold
                         hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              삭제
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !amount}
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold
                       hover:bg-indigo-700 active:bg-indigo-800 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '저장 중...' : mode === 'add' ? '추가' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
