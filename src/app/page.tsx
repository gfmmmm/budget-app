'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, subMonths } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { toYearMonth, monthRange, lastNMonths } from '@/lib/utils'
import type { Expense, Budget, MonthlyTrend } from '@/types'

import Dashboard from '@/components/Dashboard'
import ReviewInbox from '@/components/ReviewInbox'
import ExpenseList from '@/components/ExpenseList'
import CategoryBudgets from '@/components/CategoryBudgets'
import SpendingTrend from '@/components/SpendingTrend'
import ExpenseModal from '@/components/ExpenseModal'

export default function HomePage() {
  const [viewMonth, setViewMonth] = useState(toYearMonth(new Date()))
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [prevMonthTotal, setPrevMonthTotal] = useState(0)
  const [trendData, setTrendData] = useState<MonthlyTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 모달 상태
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; expense?: Expense } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
    const { start, end } = monthRange(viewMonth)

    // 이번 달 지출
    const { data: expData, error: expError } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (expError) throw expError
    setExpenses((expData as Expense[]) ?? [])

    // 이번 달 예산
    const { data: budgetData } = await supabase
      .from('budgets')
      .select('*')
      .eq('period', viewMonth)

    setBudgets((budgetData as Budget[]) ?? [])

    // 전월 지출 합계
    const prevMonth = toYearMonth(subMonths(new Date(viewMonth + '-01'), 1))
    const prevRange = monthRange(prevMonth)
    const { data: prevData } = await supabase
      .from('expenses')
      .select('amount, excluded, value_type')
      .gte('date', prevRange.start)
      .lte('date', prevRange.end)

    const prevTotal = (prevData ?? [])
      .filter((e: { excluded?: boolean; value_type?: string | null }) => !e.excluded && e.value_type !== 'review')
      .reduce((s: number, e: { amount: number }) => s + e.amount, 0)
    setPrevMonthTotal(prevTotal)

    // 최근 6개월 추이
    const months = lastNMonths(6)
    const firstMonth = months[0]
    const lastMonth = months[months.length - 1]
    const trendStart = monthRange(firstMonth).start
    const trendEnd = monthRange(lastMonth).end

    const { data: trendRaw } = await supabase
      .from('expenses')
      .select('date, amount, category, excluded, value_type')
      .gte('date', trendStart)
      .lte('date', trendEnd)

    const trendMap = new Map<string, MonthlyTrend>()
    for (const m of months) {
      trendMap.set(m, { month: m, total: 0, byCategory: {} })
    }
    for (const e of (trendRaw ?? []) as Array<{ date: string; amount: number; category: string; excluded?: boolean; value_type?: string | null }>) {
      if (e.excluded || e.value_type === 'review') continue
      const ym = e.date.slice(0, 7)
      const entry = trendMap.get(ym)
      if (entry) {
        entry.total += e.amount
        entry.byCategory[e.category] = (entry.byCategory[e.category] || 0) + e.amount
      }
    }
    setTrendData(months.map(m => trendMap.get(m)!))

    } catch (err) {
      console.error('데이터 로딩 실패:', err)
      setError('데이터를 불러올 수 없습니다. Supabase 연결을 확인하세요.')
    } finally {
      setLoading(false)
    }
  }, [viewMonth])

  useEffect(() => { fetchData() }, [fetchData])

  function changeMonth(delta: number) {
    const d = new Date(viewMonth + '-01')
    if (delta > 0) d.setMonth(d.getMonth() + 1)
    else d.setMonth(d.getMonth() - 1)
    setViewMonth(toYearMonth(d))
  }

  const reviewItems = expenses.filter(e => e.value_type === 'review' && !e.excluded)
  const budgetCategories = budgets.map(b => b.category)
  const monthLabel = (() => {
    const [y, m] = viewMonth.split('-')
    return `${y}년 ${parseInt(m)}월`
  })()

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-8">
      {/* 헤더: 월 선택 */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
          >
            ◀
          </button>
          <h1 className="text-base font-bold text-slate-800">{monthLabel}</h1>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
          >
            ▶
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-slate-400 text-sm">불러오는 중...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-slate-400 text-sm text-center">{error}</div>
            <button onClick={fetchData} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white">다시 시도</button>
          </div>
        ) : (
          <>
            {/* 1. 판단필요 인박스 */}
            <ReviewInbox
              reviewItems={reviewItems}
              budgetCategories={budgetCategories}
              onUpdate={fetchData}
            />

            {/* 2. 월별 대시보드 */}
            <Dashboard
              viewMonth={viewMonth}
              expenses={expenses}
              budgets={budgets}
              prevMonthTotal={prevMonthTotal}
            />

            {/* 3. 카테고리별 예산 */}
            <CategoryBudgets
              viewMonth={viewMonth}
              expenses={expenses}
              budgets={budgets}
              onUpdate={fetchData}
            />

            {/* 4. 지출 내역 */}
            <ExpenseList
              expenses={expenses}
              budgetCategories={budgetCategories}
              onEdit={exp => setModal({ mode: 'edit', expense: exp })}
              onAdd={() => setModal({ mode: 'add' })}
            />

            {/* 5. 지출 추이 차트 */}
            <SpendingTrend data={trendData} />

            {/* 로그아웃 */}
            <div className="text-center pt-4 pb-8">
              <button
                onClick={handleLogout}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                로그아웃
              </button>
            </div>
          </>
        )}
      </main>

      {/* 플로팅 추가 버튼 */}
      {!loading && (
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg
                     flex items-center justify-center text-2xl
                     hover:bg-indigo-700 active:bg-indigo-800 transition-colors
                     sm:right-[calc(50%-240px)]"
          aria-label="지출 추가"
        >
          +
        </button>
      )}

      {/* 모달 */}
      {modal && (
        <ExpenseModal
          mode={modal.mode}
          expense={modal.expense}
          categories={budgetCategories}
          onClose={() => setModal(null)}
          onSave={fetchData}
        />
      )}
    </div>
  )
}
