'use client'

import { useState } from 'react'
import { Expense } from '@/types'
import { supabase } from '@/lib/supabase'
import { CATEGORY_EMOJI, MULTI_PURPOSE_VENDORS, HIDDEN_CATEGORIES } from '@/lib/constants'
import { formatMoney } from '@/lib/utils'

interface Props {
  reviewItems: Expense[]
  budgetCategories: string[]
  onUpdate: () => void
}

/* 기본 9개 (짧은 이름) */
const BASE = ['식비', '커피', '교통', '쇼핑', '생활비', '주거비', '구독비', '문화', '기타']

/* DB 카테고리 중 BASE와 "같은 계열"인지 판별 */
const ALIAS: Record<string, string> = {
  '교통/차량': '교통', '쇼핑/패션': '쇼핑', '주거비용': '주거비',
  '술자리/유흥비': '술자리', '문화/자기계발': '문화',
}

export default function ReviewInbox({ reviewItems, budgetCategories, onUpdate }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  /* BASE + DB전용 카테고리(BASE에 이미 있는 계열은 제외) */
  const dbOnly = budgetCategories.filter(c =>
    !HIDDEN_CATEGORIES.includes(c) &&
    !BASE.includes(c) &&
    !BASE.includes(ALIAS[c] ?? '')
  )
  const categories = [...BASE, ...dbOnly]

  if (reviewItems.length === 0) return null

  const isMultiPurpose = (title: string) =>
    MULTI_PURPOSE_VENDORS.some(v => title.includes(v))

  async function categorize(exp: Expense, cat: string) {
    setSaving(exp.id)
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
        <div className="px-3 pb-3 space-y-2">
          {reviewItems.slice(0, 10).map(exp => (
            <div key={exp.id}
              className="bg-white rounded-xl px-3.5 py-3 border border-amber-100/80"
              style={{ opacity: saving === exp.id ? 0.4 : 1 }}>

              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="text-[14px] font-semibold text-slate-800 truncate">{exp.title}</span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{exp.date.slice(5)}</span>
                </div>
                <span className="text-[14px] font-bold text-slate-800 tabular-nums ml-3 flex-shrink-0">
                  {formatMoney(exp.amount)}
                </span>
              </div>

              <div className="flex flex-wrap gap-[5px]">
                {categories.map(cat => (
                  <button key={cat} onClick={() => categorize(exp, cat)}
                    disabled={saving === exp.id}
                    className="h-[28px] px-2.5 text-[12px] rounded-lg border border-slate-200 bg-slate-50
                               text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700
                               active:bg-indigo-100 transition-colors disabled:opacity-40 whitespace-nowrap">
                    {CATEGORY_EMOJI[cat] || ''} {cat}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
