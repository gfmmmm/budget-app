'use client'

import { useState, useMemo } from 'react'
import { Expense, Budget } from '@/types'
import { supabase } from '@/lib/supabase'
import { CATEGORY_EMOJI, CATEGORY_COLOR } from '@/lib/constants'
import { formatMoney, percent, progressColor, remainingDays } from '@/lib/utils'

interface Props {
  viewMonth: string
  expenses: Expense[]
  budgets: Budget[]
  onUpdate: () => void
}

export default function CategoryBudgets({ viewMonth, expenses, budgets, onUpdate }: Props) {
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const days = remainingDays(viewMonth)

  // 카테고리별 지출 합계
  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of expenses.filter(e => !e.excluded && e.value_type !== 'review')) {
      map[e.category] = (map[e.category] || 0) + e.amount
    }
    return map
  }, [expenses])

  // 예산이 설정된 카테고리 순서대로 (사용률 높은 순)
  const items = useMemo(() => {
    return budgets
      .filter(b => b.amount > 0)
      .map(b => {
        const spent = spentByCategory[b.category] || 0
        const pct = percent(spent, b.amount)
        const remaining = Math.max(0, b.amount - spent)
        const daily = days > 0 ? Math.floor(remaining / days) : 0
        return { ...b, spent, pct, remaining, daily }
      })
      .sort((a, b) => b.pct - a.pct)
  }, [budgets, spentByCategory, days])

  async function saveBudget(category: string) {
    const amount = parseInt(editValue) || 0
    const existing = budgets.find(b => b.category === category)

    try {
      if (existing) {
        await supabase.from('budgets').update({ amount }).eq('id', existing.id)
      } else {
        await supabase.from('budgets').insert({ period: viewMonth, category, amount })
      }
      setEditingCat(null)
      onUpdate()
    } catch {
      alert('예산 저장 실패')
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-base font-bold text-slate-800 mb-3">카테고리별 예산</h2>
        <p className="text-sm text-slate-400 text-center py-6">
          아직 예산이 설정되지 않았습니다
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h2 className="text-base font-bold text-slate-800 mb-4">카테고리별 예산</h2>

      <div className="space-y-4">
        {items.map(item => (
          <div key={item.category}>
            {/* 카테고리 헤더 */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{CATEGORY_EMOJI[item.category] || '📦'}</span>
                <span className="text-sm font-semibold text-slate-700">{item.category}</span>
                <span className="text-xs font-bold ml-1" style={{ color: progressColor(item.pct) }}>
                  {item.pct}%
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{formatMoney(item.spent)}</span>
                <span>/</span>
                {editingCat === item.category ? (
                  <form
                    onSubmit={e => { e.preventDefault(); saveBudget(item.category) }}
                    className="flex items-center gap-1"
                  >
                    <input
                      type="number"
                      inputMode="numeric"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      autoFocus
                      className="w-20 px-2 py-0.5 text-xs border border-indigo-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      onBlur={() => saveBudget(item.category)}
                    />
                  </form>
                ) : (
                  <button
                    onClick={() => { setEditingCat(item.category); setEditValue(item.amount.toString()) }}
                    className="hover:text-indigo-600 transition-colors"
                  >
                    {formatMoney(item.amount)}
                  </button>
                )}
              </div>
            </div>

            {/* 진행률 바 */}
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(item.pct, 100)}%`,
                  backgroundColor: CATEGORY_COLOR[item.category] || progressColor(item.pct),
                }}
              />
            </div>

            {/* 남은 예산 */}
            <div className="text-xs text-slate-400">
              {item.remaining > 0
                ? `${formatMoney(item.remaining)} 남음`
                : `${formatMoney(item.spent - item.amount)} 초과`}
              {days > 0 && item.remaining > 0 && (
                <span className="ml-2">· 하루 {formatMoney(item.daily)} 가능</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
