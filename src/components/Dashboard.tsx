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
  const diffSign = diff > 0 ? '+' : ''
  const diffPct = prevMonthTotal > 0 ? Math.round((diff / prevMonthTotal) * 100) : 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      {/* 총 지출 */}
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm text-slate-500">이번 달 지출</span>
        <span className="text-xs text-slate-400">
          예산 {formatMoney(totalBudget)}
        </span>
      </div>
      <div className="text-3xl font-bold text-slate-800 mb-3">
        {formatMoney(totalSpent)}
      </div>

      {/* 진행률 바 */}
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: progressColor(pct),
          }}
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span style={{ color: progressColor(pct) }} className="font-semibold">
          {pct}% 사용
        </span>
      </div>

      {/* 상세 지표 */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {/* 전월 대비 */}
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-xs text-slate-500 mb-1">전월 대비</div>
          <div className={`text-sm font-bold ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-blue-500' : 'text-slate-600'}`}>
            {prevMonthTotal > 0 ? (
              <>
                {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'} {diffSign}{diffPct}%
              </>
            ) : (
              <span className="text-slate-400">-</span>
            )}
          </div>
        </div>

        {/* 남은 예산 */}
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-xs text-slate-500 mb-1">남은 예산</div>
          <div className="text-sm font-bold text-slate-700">
            {totalBudget > 0 ? formatMoney(remaining) : '-'}
          </div>
        </div>

        {/* 하루 가능 */}
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-xs text-slate-500 mb-1">하루 가능</div>
          <div className="text-sm font-bold text-slate-700">
            {days > 0 && totalBudget > 0 ? formatMoney(dailyAvailable) : '-'}
          </div>
        </div>
      </div>
    </div>
  )
}
