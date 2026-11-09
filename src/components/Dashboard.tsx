'use client'

import { Expense, Budget } from '@/types'
import { formatMoney, percent, progressColor, remainingDays } from '@/lib/utils'

interface Props {
  viewMonth: string
  expenses: Expense[]
  budgets: Budget[]
  prevMonthTotal: number
}

export default function Dashboard({ viewMonth, expenses, budgets, prevMonthTotal }: Props) {
  const active = expenses.filter(e => !e.excluded)
  const totalSpent = active.reduce((s, e) => s + e.amount, 0)
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
  const pct = percent(totalSpent, totalBudget)
  const remaining = Math.max(0, totalBudget - totalSpent)
  const days = remainingDays(viewMonth)
  const dailyAvailable = days > 0 ? Math.floor(remaining / days) : 0
  const diff = totalSpent - prevMonthTotal
  const diffPct = prevMonthTotal > 0 ? Math.round(Math.abs(diff) / prevMonthTotal * 100) : 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-end justify-between mb-1">
        <span className="text-[13px] text-slate-500">이번 달 지출</span>
        {totalBudget > 0 && (
          <span className="text-[11px] text-slate-400">
            예산 {formatMoney(totalBudget)}
          </span>
        )}
      </div>

      <div className="text-[28px] font-extrabold text-slate-800 tracking-tight mb-3">
        {formatMoney(totalSpent)}
      </div>

      {totalBudget > 0 && (
        <>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: progressColor(pct) }}
            />
          </div>
          <div className="text-[12px] font-semibold mb-4" style={{ color: progressColor(pct) }}>
            {pct}% 사용
          </div>
        </>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
          <div className="text-[10px] text-slate-400 mb-0.5">전월 대비</div>
          <div className={`text-[13px] font-bold ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-blue-500' : 'text-slate-500'}`}>
            {prevMonthTotal > 0
              ? `${diff > 0 ? '↑' : '↓'} ${diffPct}%`
              : '-'}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
          <div className="text-[10px] text-slate-400 mb-0.5">남은 예산</div>
          <div className="text-[13px] font-bold text-slate-700">
            {totalBudget > 0 ? formatMoney(remaining) : '-'}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
          <div className="text-[10px] text-slate-400 mb-0.5">하루 가능</div>
          <div className="text-[13px] font-bold text-slate-700">
            {days > 0 && totalBudget > 0 ? formatMoney(dailyAvailable) : '-'}
          </div>
        </div>
      </div>
    </div>
  )
}
