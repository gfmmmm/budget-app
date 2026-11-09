'use client'

import { useState } from 'react'
import { Expense } from '@/types'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, CATEGORY_EMOJI, MULTI_PURPOSE_VENDORS } from '@/lib/constants'
import { formatMoney, formatDateGroup } from '@/lib/utils'

interface Props {
  reviewItems: Expense[]
  budgetCategories: string[]
  onUpdate: () => void
}

export default function ReviewInbox({ reviewItems, budgetCategories, onUpdate }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  // budgets에서 가져온 카테고리 + 기본 카테고리 합치기 (중복 제거)
  const categories = Array.from(new Set([...budgetCategories, ...CATEGORIES]))

  if (reviewItems.length === 0) return null

  const isMultiPurpose = (title: string) =>
    MULTI_PURPOSE_VENDORS.some(v => title.includes(v))

  async function categorize(exp: Expense, newCategory: string) {
    setSaving(exp.id)
    try {
      // 1. 해당 지출 업데이트
      const { error } = await supabase
        .from('expenses')
        .update({ category: newCategory, value_type: null })
        .eq('id', exp.id)
      if (error) throw error

      // 2. 학습 규칙 저장
      const pattern = isMultiPurpose(exp.title)
        ? `${exp.title}|${exp.amount}`
        : exp.title

      await supabase
        .from('category_rules')
        .upsert(
          { pattern, category: newCategory, updated_at: new Date().toISOString() },
          { onConflict: 'pattern' }
        )

      // 3. 같은 패턴의 다른 review 항목 일괄 분류
      if (!isMultiPurpose(exp.title)) {
        // 고유 거래처: 같은 이름의 모든 review 항목
        await supabase
          .from('expenses')
          .update({ category: newCategory, value_type: null })
          .eq('title', exp.title)
          .eq('value_type', 'review')
      } else {
        // 다용도 거래처: 이름+금액이 같은 항목만
        const sameCombo = reviewItems.filter(
          r => r.id !== exp.id && r.title === exp.title && r.amount === exp.amount
        )
        for (const r of sameCombo) {
          await supabase
            .from('expenses')
            .update({ category: newCategory, value_type: null })
            .eq('id', r.id)
        }
      }

      onUpdate()
    } catch {
      alert('분류 실패')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
      {/* 헤더 */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📥</span>
          <span className="text-sm font-bold text-amber-900">판단필요</span>
          <span className="bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
            {reviewItems.length}
          </span>
        </div>
        <span className="text-amber-700 text-sm">
          {collapsed ? '펼치기 ▼' : '접기 ▲'}
        </span>
      </button>

      {/* 아이템 리스트 */}
      {!collapsed && (
        <div className="mt-3 space-y-2">
          {reviewItems.slice(0, 20).map(exp => (
            <div
              key={exp.id}
              className="bg-white rounded-xl p-3 border border-amber-100"
              style={{ opacity: saving === exp.id ? 0.5 : 1 }}
            >
              {/* 거래 정보 */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-semibold text-slate-800">{exp.title}</span>
                  <span className="text-xs text-slate-400 ml-2">
                    {formatDateGroup(exp.date)}
                  </span>
                </div>
                <span className="text-sm font-bold text-slate-800">
                  {formatMoney(exp.amount)}
                </span>
              </div>

              {/* 카테고리 버튼 */}
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => categorize(exp, cat)}
                    disabled={saving === exp.id}
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50
                               text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700
                               active:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    {CATEGORY_EMOJI[cat] || ''} {cat}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {reviewItems.length > 20 && (
            <p className="text-xs text-amber-700 text-center py-1">
              +{reviewItems.length - 20}건 더
            </p>
          )}
        </div>
      )}
    </div>
  )
}
