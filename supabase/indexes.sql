-- Optimización de Indices para HouseAI
-- Ejecutar en Supabase SQL Editor

-- 1. Incomes (Ingresos)
-- Filtros comunes: user_id + month (Dashboard/Reportes)
CREATE INDEX IF NOT EXISTS idx_incomes_user_month ON public.incomes(user_id, month);
-- Filtros: user_id + is_recurring (Dashboard)
CREATE INDEX IF NOT EXISTS idx_incomes_user_recurring ON public.incomes(user_id, is_recurring);

-- 2. Fixed Expenses (Gastos Fijos)
-- Filtros: user_id (Dashboard/Reportes)
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user ON public.fixed_expenses(user_id);

-- 3. Shared Expenses (Gastos Compartidos)
-- Filtros: house_id + orden por fecha (Shared Page)
CREATE INDEX IF NOT EXISTS idx_shared_expenses_house_date ON public.shared_expenses(house_id, date DESC);
-- Filtros: paid_by + rango de fechas (Reportes)
CREATE INDEX IF NOT EXISTS idx_shared_expenses_paid_by_date ON public.shared_expenses(paid_by, date);

-- 4. Expense Splits (Divisiones)
-- Filtros: user_id + is_paid (Dashboard - Deudas)
CREATE INDEX IF NOT EXISTS idx_expense_splits_user_paid ON public.expense_splits(user_id, is_paid);
-- Búsquedas por foreign key (Joins)
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON public.expense_splits(expense_id);

-- 5. House Members (Miembros)
-- Busquedas por user_id (Auth/Permisos)
CREATE INDEX IF NOT EXISTS idx_house_members_user_id ON public.house_members(user_id);
-- Busquedas por house_id (Listar miembros)
CREATE INDEX IF NOT EXISTS idx_house_members_house_id ON public.house_members(house_id);

-- 6. Installments (Cuotas)
-- Filtros: house_id
CREATE INDEX IF NOT EXISTS idx_installments_house_id ON public.installment_expenses(house_id);

-- 7. Receipt Items
-- Búsquedas por expense_id (Detalle de gasto)
CREATE INDEX IF NOT EXISTS idx_receipt_items_expense_id ON public.receipt_items(expense_id);
