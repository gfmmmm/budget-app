'use client'

import { useMemo } from 'react'
import { MonthlyTrend } from '@/types'
import { CATEGORY_COLOR } from '@/lib/constants'
import { formatMoney, formatMoneyShort } from '@/lib/utils'

interface Props {
  data: MonthlyTrend[]
}

// 상위 카테고리 5개 + 나머지를 "기타"로
function topCategories(data: MonthlyTrend[]): string[] {
  const totals: Record<string, number> = {}
  for (const m of data) {
    for (const [cat, amt] of Object.entries(m.byCategory)) {
      totals[cat] = (totals[cat] || 0) + amt
    }
  }
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1])
  return sorted.slice(0, 5).map(([cat]) => cat)
}

export default function SpendingTrend({ data }: Props) {
  const topCats = useMemo(() => topCategories(data), [data])
  const maxTotal = useMemo(() => Math.max(...data.map(d => d.total), 1), [data])
  const avgTotal = useMemo(() => {
    const nonZero = data.filter(d => d.total > 0)
    return nonZero.length > 0 ? Math.round(nonZero.reduce((s, d) => s + d.total, 0) / nonZero.length) : 0
  }, [data])

  if (data.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-800">지출 추이</h2>
        <span className="text-xs text-slate-400">
          월평균 {formatMoney(avgTotal)}
        </span>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4">
        {topCats.map(cat => (
          <div key={cat} className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: CATEGORY_COLOR[cat] || '#6b7280' }}
            />
            <span className="text-xs text-slate-500">{cat}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-slate-300" />
          <span className="text-xs text-slate-500">기타</span>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="relative">
        {/* 평균 라인 */}
        {avgTotal > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-slate-300 z-10"
            style={{ bottom: `${(avgTotal / maxTotal) * 180}px` }}
          >
            <span className="absolute -top-3 right-0 text-[10px] text-slate-400">
              평균
            </span>
          </div>
        )}

        {/* 바 차트 */}
        <div className="flex items-end justify-between gap-2" style={{ height: 200 }}>
          {data.map(month => {
            const barHeight = maxTotal > 0 ? (month.total / maxTotal) * 180 : 0

            // 카테고리별 세그먼트 계산
            const segments: { cat: string; height: number; color: string }[] = []
            let otherAmount = month.total

            for (const cat of topCats) {
              const amt = month.byCategory[cat] || 0
              if (amt > 0) {
                segments.push({
                  cat,
                  height: (amt / month.total) * barHeight,
                  color: CATEGORY_COLOR[cat] || '#6b7280',
                })
                otherAmount -= amt
              }
            }
            if (otherAmount > 0 && month.total > 0) {
              segments.push({
                cat: '기타',
                height: (otherAmount / month.total) * barHeight,
                color: '#d1d5db',
              })
            }

            const monthLabel = month.month.slice(5) + '월'

            return (
              <div key={month.month} className="flex-1 flex flex-col items-center">
                {/* 금액 */}
                <span className="text-[10px] text-slate-400 mb-1">
                  {month.total > 0 ? formatMoneyShort(month.total) : ''}
                </span>

                {/* 스택 바 */}
                <div
                  className="w-full max-w-[40px] rounded-t-md overflow-hidden flex flex-col-reverse"
                  style={{ height: barHeight || 2 }}
                >
                  {segments.map((seg, i) => (
                    <div
                      key={i}
                      style={{
                        height: seg.height,
                        backgroundColor: seg.color,
                        minHeight: seg.height > 0 ? 2 : 0,
                      }}
                    />
                  ))}
                </div>

                {/* 월 라벨 */}
                <span className="text-xs text-slate-500 mt-2">{monthLabel}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
