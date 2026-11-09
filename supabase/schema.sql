-- 가계부 앱 스키마
-- Supabase SQL Editor에서 실행

-- 1) expenses: 지출 내역
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount integer not null,
  date date not null,
  category text not null default '기타',
  value_type text, -- null = 분류완료, 'review' = 판단필요
  excluded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_date on expenses (date desc);
create index if not exists idx_expenses_value_type on expenses (value_type) where value_type is not null;

-- 2) budgets: 카테고리별 월 예산
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  period text not null, -- 'YYYY-MM'
  category text not null,
  amount integer not null default 0,
  created_at timestamptz not null default now(),
  unique (period, category)
);

-- 3) category_rules: 거래처 → 카테고리 학습 규칙
create table if not exists category_rules (
  pattern text primary key, -- 거래처명 또는 '거래처명|금액'
  category text not null,
  updated_at timestamptz not null default now()
);
