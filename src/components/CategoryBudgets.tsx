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

  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of expenses.filter(e => !e.excluded && e.value_type !== 'review')) {
      map[e.category] = (map[e.category] || 0) + e.amount
    }
    return map
  }, [expenses])

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
    } catch { alert('예산 저장 실패') }
  }

  if (items.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h2 className="text-[15px] font-bold text-slate-800 mb-4">카테고리별 예산</h2>
      <div className="space-y-3.5">
        {items.map(item => {
          const color = CATEGORY_COLOR[item.category] || '#6b7280'
          const isOver = item.pct >= 100
          return (
            <div key={item.category}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <span className="text-[13px]">{CATEGORY_EMOJI[item.category] || '📦'}</span>
                  <span className="text-[13px] font-medium text-slate-700">{item.category}</span>
                </div>
                <div className="flex items-baseline gap-0.5 text-[12px]">
                  <span className="font-bold text-slate-800">{formatMoney(item.spent)}</span>
                  <span className="text-slate-300">/</span>
                  {editingCat === item.category ? (
                    <form onSubmit={e => { e.preventDefault(); saveBudget(item.category) }} className="inline">
                      <input type="number" inputMode="numeric" value={editValue}
                        onChange={e => setEditValue(e.target.value)} autoFocus
                        className="w-16 px-1 py-0 text-[12px] border border-indigo-300 rounded text-right focus:outline-none"
                        onBlur={() => saveBudget(item.category)} />
                    </form>
                  ) : (
                    <button onClick={() => { setEditingCat(item.category); setEditValue(item.amount.toString()) }}
                      className="text-slate-400 hover:text-indigo-600 transition-colors">
                      {formatMoney(item.amount)}
                    </button>
                  )}
                </div>
              </div>

              <div className="h-[6px] bg-slate-100 rounded-full overflow-hidden mb-1">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(item.pct, 100)}%`, backgroundColor: isOver ? '#ef4444' : color }} />
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className={isOver ? 'text-red-400' : 'text-slate-400'}>
                  {isOver ? `${formatMoney(item.spent - item.amount)} 초과` : `${formatMoney(item.remaining)} 남음`}
                </span>
                {!isOver && days > 0 && (
                  <span className="text-slate-300">하루 {formatMoney(item.daily)}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
