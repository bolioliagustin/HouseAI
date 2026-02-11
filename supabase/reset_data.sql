-- ⚠️ PELIGRO: Este script borra TODOS los datos de la aplicación.
-- Mantiene la estructura de las tablas (usuarios, casas, gastos, etc. quedarán vacíos).
-- Ejecutar en Supabase SQL Editor.

-- Borrar datos de tablas públicas (CASCADE se encarga de las dependencias)
TRUNCATE TABLE 
  public.receipt_items,
  public.expense_splits,
  public.shared_expenses,
  public.fixed_expenses,
  public.incomes,
  public.installment_expenses,
  public.house_members,
  public.houses,
  public.push_subscriptions,
  public.users
CASCADE;

-- Si también quieres borrar las cuentas de usuario (login/email), descomenta la siguiente línea:
-- DELETE FROM auth.users;

-- Nota: Al borrar auth.users, se borrará automáticamente todo lo demás debido a las restricciones "ON DELETE CASCADE".
