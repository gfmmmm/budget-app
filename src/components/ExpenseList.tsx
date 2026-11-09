'use client'

import { useMemo, useState } from 'react'
import { Expense } from '@/types'
import { CATEGORIES, CATEGORY_EMOJI, CATEGORY_COLOR } from '@/lib/constants'
import { formatMoney, formatDateGroup } from '@/lib/utils'

interface Props {
  expenses: Expense[]
  budgetCategories: string[]
  onEdit: (expense: Expense) => void
  onAdd: () => void
}

export default function ExpenseList({ expenses, budgetCategories, onEdit, onAdd }: Props) {
  const [filter, setFilter] = useState<string>('전체')

  const allCats = useMemo(() =>
    Array.from(new Set([...budgetCategories, ...CATEGORIES])),
    [budgetCategories]
  )
  const filterTabs = ['전체', ...allCats]

  // 필터 적용 (excluded 포함해서 보여주되 시각적으로 구분)
  const filtered = useMemo(() => {
    const active = expenses.filter(e => e.value_type !== 'review') // review는 인박스에서 처리
    if (filter === '전체') return active
    return active.filter(e => e.category === filter)
  }, [expenses, filter])

  // 날짜별 그룹핑
  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of filtered) {
      const existing = map.get(e.date) ?? []
      existing.push(e)
      map.set(e.date, existing)
    }
    // 날짜 내림차순
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">
          지출 내역
          <span className="text-sm font-normal text-slate-400 ml-2">{filtered.length}건</span>
        </h2>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white font-semibold
                     hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
        >
          + 추가
        </button>
      </div>

      {/* 카테고리 필터 */}
      <div className="filter-scroll flex gap-1.5 px-5 pb-3 overflow-x-auto">
        {filterTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap border transition-colors ${
              filter === tab
                ? 'bg-indigo-600 border-indigo-600 text-white font-semibold'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-300'
            }`}
          >
            {tab !== '전체' && (CATEGORY_EMOJI[tab] || '')} {tab}
          </button>
        ))}
      </div>

      {/* 그룹별 리스트 */}
      <div className="divide-y divide-slate-100">
        {grouped.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">
            지출 내역이 없습니다
          </div>
        )}

        {grouped.map(([date, items]) => {
          const dayTotal = items.filter(e => !e.excluded).reduce((s, e) => s + e.amount, 0)
          return (
            <div key={date}>
              {/* 날짜 헤더 */}
              <div className="px-5 py-2.5 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  {formatDateGroup(date)}
                </span>
                <span className="text-xs text-slate-400">
                  {items.length}건 · {formatMoney(dayTotal)}
                </span>
              </div>

              {/* 개별 항목 */}
              {items.map(exp => (
                <button
                  key={exp.id}
                  onClick={() => onEdit(exp)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${exp.excluded ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {exp.title}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span
                      className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{
                        backgroundColor: (CATEGORY_COLOR[exp.category] || '#6b7280') + '15',
                        color: CATEGORY_COLOR[exp.category] || '#6b7280',
                      }}
                    >
                      {exp.category}
                    </span>
                    <span className={`text-sm font-semibold ${exp.excluded ? 'text-slate-400' : 'text-slate-800'}`}>
                      {formatMoney(exp.amount)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
