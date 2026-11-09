import { format, startOfMonth, endOfMonth, subMonths, differenceInCalendarDays, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

/** 금액 포맷: 1,234원 */
export function formatMoney(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

/** 축약 금액: 12.3만원 */
export function formatMoneyShort(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(n % 10000 === 0 ? 0 : 1) + '만원'
  return formatMoney(n)
}

/** YYYY-MM 형식 */
export function toYearMonth(d: Date): string {
  return format(d, 'yyyy-MM')
}

/** 이번 달 시작/끝 */
export function monthRange(yearMonth: string) {
  const d = parseISO(yearMonth + '-01')
  return {
    start: format(startOfMonth(d), 'yyyy-MM-dd'),
    end: format(endOfMonth(d), 'yyyy-MM-dd'),
  }
}

/** 이번 달 남은 날 수 (오늘 포함) */
export function remainingDays(yearMonth: string): number {
  const now = new Date()
  const currentYM = toYearMonth(now)
  if (yearMonth !== currentYM) return 0
  const end = endOfMonth(now)
  return differenceInCalendarDays(end, now) + 1
}

/** 날짜 → "11-08 (토)" */
export function formatDateGroup(dateStr: string): string {
  const d = parseISO(dateStr)
  return format(d, 'MM-dd (E)', { locale: ko })
}

/** 지난 N개월의 YYYY-MM 목록 (이번 달 포함) */
export function lastNMonths(n: number): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    months.push(toYearMonth(subMonths(now, i)))
  }
  return months
}

/** 퍼센트 계산 (0~100+) */
export function percent(used: number, budget: number): number {
  if (budget <= 0) return used > 0 ? 100 : 0
  return Math.round((used / budget) * 100)
}

/** Progress bar 색상 */
export function progressColor(pct: number): string {
  if (pct >= 90) return '#ef4444'
  if (pct >= 70) return '#f59e0b'
  return '#6366f1'
}
