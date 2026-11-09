export interface Expense {
  id: string
  title: string
  amount: number
  date: string
  category: string
  value_type: string | null
  excluded: boolean
  created_at: string
}

export interface Budget {
  id: string
  period: string
  category: string
  amount: number
  created_at: string
}

export interface CategoryRule {
  pattern: string
  category: string
  updated_at: string
}

export interface MonthlyTrend {
  month: string // YYYY-MM
  total: number
  byCategory: Record<string, number>
}
