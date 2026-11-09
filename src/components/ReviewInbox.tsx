'use client'

import { useState } from 'react'
import { Expense } from '@/types'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, CATEGORY_EMOJI, MULTI_PURPOSE_VENDORS, HIDDEN_CATEGORIES } from '@/lib/constants'
import { formatMoney } from '@/lib/utils'

interface Props {
  reviewItems: Expense[]
  budgetCategories: string[]
  onUpdate: () => void
}

const ALIAS: Record<string, string> = {
  '교통/차량': '교통', '쇼핑/패션': '쇼핑', '주거비용': '주거비',
  '문화/자기계발': '문화',
}

export default function ReviewInbox({ reviewItems, budgetCategories, onUpdate }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [selecting, setSelecting] = useState<Expense | null>(null)

  // 시트에서 보여줄 전체 카테고리: 기본 + DB 고유 (숨김/중복 제외)
  const allCats = Array.from(new Set([
    ...CATEGORIES,
    ...budgetCategories.filter(c =>
      !HIDDEN_CATEGORIES.includes(c) &&
      !CATEGORIES.includes(c as typeof CATEGORIES[number]) &&
      !(ALIAS[c] && CATEGORIES.includes(ALIAS[c] as typeof CATEGORIES[number]))
    ),
  ]))

  if (reviewItems.length === 0) return null

  const isMultiPurpose = (title: string) =>
    MULTI_PURPOSE_VENDORS.some(v => title.includes(v))

  async function categorize(exp: Expense, cat: string) {
    setSaving(exp.id)
    setSelecting(null)
    try {
      await supabase.from('expenses')
        .update({ category: cat, value_type: null }).eq('id', exp.id)

      const pattern = isMultiPurpose(exp.title)
        ? `${exp.title}|${exp.amount}` : exp.title
      await supabase.from('category_rules')
        .upsert({ pattern, category: cat, updated_at: new Date().toISOString() },
          { onConflict: 'pattern' })

      if (!isMultiPurpose(exp.title)) {
        await supabase.from('expenses')
          .update({ category: cat, value_type: null })
          .eq('title', exp.title).eq('value_type', 'review')
      }
      onUpdate()
    } catch { alert('분류 실패') }
    finally { setSaving(null) }
  }

  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
        <button onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📥</span>
            <span className="text-[13px] font-bold text-amber-900">판단필요</span>
            <span className="bg-amber-400 text-amber-900 text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {reviewItems.length}
            </span>
          </div>
          <span className="text-amber-600 text-xs">{collapsed ? '▼' : '▲'}</span>
        </button>

        {!collapsed && (
          <div className="px-3 pb-3 space-y-1.5">
            {reviewItems.slice(0, 10).map(exp => (
              <div key={exp.id}
                className="bg-white rounded-xl px-3.5 py-2.5 border border-amber-100/80 flex items-center justify-between gap-2"
                style={{ opacity: saving === exp.id ? 0.4 : 1 }}>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[14px] font-semibold text-slate-800 truncate">{exp.title}</span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{exp.date.slice(5)}</span>
                  </div>
                  <span className="text-[13px] font-bold text-slate-700 tabular-nums">
                    {formatMoney(exp.amount)}
                  </span>
                </div>

                <button
                  onClick={() => setSelecting(exp)}
                  disabled={saving === exp.id}
                  className="flex-shrink-0 h-[32px] px-3 text-[12px] font-semibold rounded-lg
                             bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800
                             transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  분류하기
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 카테고리 선택 바텀시트 */}
      {selecting && (
        <div
          className="sheet-overlay fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) setSelecting(null) }}
        >
          <div className="sheet-content bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-5 pb-8">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[15px] font-bold text-slate-800">카테고리 선택</h3>
              <button onClick={() => setSelecting(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>
            <p className="text-[13px] text-slate-500 mb-4">
              <span className="font-semibold text-slate-700">{selecting.title}</span>
              <span className="ml-2">{formatMoney(selecting.amount)}</span>
            </p>

            <div className="grid grid-cols-3 gap-2">
              {allCats.map(cat => (
                <button key={cat} onClick={() => categorize(selecting, cat)}
                  className="flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl
                             border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300
                             active:bg-indigo-100 transition-colors">
                  <span className="text-lg">{CATEGORY_EMOJI[cat] || '📦'}</span>
                  <span className="text-[11px] text-slate-600 font-medium">{cat}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
