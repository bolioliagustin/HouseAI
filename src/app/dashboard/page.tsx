import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Home, Receipt, TrendingUp, Scan, Settings, LogOut, Plus, Users, ShoppingCart, ChevronRight } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Initial Parallel Fetch for independent data
  const now = new Date();
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [
    profileRes,
    monthlyIncomesRes,
    recurringIncomesRes,
    houseMemberRes,
    fixedExpensesRes,
  ] = await Promise.all([
    // Profile
    supabase.from("users").select("*").eq("id", user.id).single(),
    // Monthly Incomes
    supabase
      .from("incomes")
      .select("amount")
      .eq("user_id", user.id)
      .eq("month", currentMonthStart),
    // Recurring Incomes
    supabase
      .from("incomes")
      .select("amount")
      .eq("user_id", user.id)
      .eq("is_recurring", true),
    // House Membership
    supabase
      .from("house_members")
      .select("house_id, role, houses(name, invite_code)")
      .eq("user_id", user.id)
      .maybeSingle(),
    // Fixed Expenses
    supabase
      .from("fixed_expenses")
      .select("amount, is_shared")
      .eq("user_id", user.id),
  ]);

  const profile = profileRes.data;
  const houseMember = houseMemberRes.data;
  const monthlyIncomes = monthlyIncomesRes.data;
  const recurringIncomes = recurringIncomesRes.data;
  const fixedExpenses = fixedExpensesRes.data;

  // 2. Dependent Parallel Fetch (only if in a house)
  let memberCountPromise = Promise.resolve(1) as any;
  let splitsPromise = Promise.resolve({ data: [] }) as any;
  let otherMemberPromise = Promise.resolve({ data: null }) as any;

  if (houseMember?.house_id) {
    memberCountPromise = supabase
      .from("house_members")
      .select("*", { count: "exact", head: true })
      .eq("house_id", houseMember.house_id)
      .then((res) => res.count || 1);

    splitsPromise = supabase
      .from("expense_splits")
      .select("amount, is_paid, user_id, shared_expenses!inner(paid_by)")
      .eq("user_id", user.id)
      .eq("is_paid", false);

    otherMemberPromise = supabase
      .from("house_members")
      .select("user_id, users(name, email)")
      .eq("house_id", houseMember.house_id)
      .neq("user_id", user.id)
      .maybeSingle();
  }

  const [memberCount, splitsRes, otherMemberRes] = await Promise.all([
    memberCountPromise,
    splitsPromise,
    otherMemberPromise,
  ]);

  // 3. Process Data
  const totalMonthly = monthlyIncomes?.reduce((sum, inc) => sum + Number(inc.amount), 0) || 0;
  const totalRecurring = recurringIncomes?.reduce((sum, inc) => sum + Number(inc.amount), 0) || 0;
  const totalIncome = totalMonthly + totalRecurring;

  const totalFixed = fixedExpenses?.reduce((sum, exp) => {
    const amount = Number(exp.amount);
    return sum + (exp.is_shared ? amount / memberCount : amount);
  }, 0) || 0;

  const splits = splitsRes.data;
  const sharedBalance = splits?.reduce((sum: number, split: any) => sum + Number(split.amount), 0) || 0;
  
  // Note: otherMemberName logic was unused in UI, removing it for cleaner code
  // or keeping it if needed for future expansion.
  // The current UI uses houseMember.houses.name for display.

  const balance = totalIncome - totalFixed;

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 pb-24">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                MitAI
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Hola, {profile?.name || user.email?.split("@")[0]}! 👋
              </p>
            </div>
          </div>
          <form action={signOut}>
            <button 
              type="submit"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-xl text-white">
          <p className="text-green-100 text-sm font-medium mb-1">Balance disponible</p>
          <p className="text-4xl font-bold mb-4">
            ${balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-green-100 text-xs">Ingresos</p>
              <p className="text-lg font-semibold">
                ${totalIncome.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-green-100 text-xs">Gastos fijos</p>
              <p className="text-lg font-semibold">
                ${totalFixed.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/incomes"
            className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 shadow-lg text-white hover:scale-[1.02] transition-transform group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Plus className="w-20 h-20" />
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3 backdrop-blur-sm group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg relative z-10">Ingresos</h3>
            <p className="text-sm text-emerald-100 font-medium relative z-10">Cargar ingreso</p>
          </Link>

          <Link
            href="/expenses"
            className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-5 shadow-lg text-white hover:scale-[1.02] transition-transform group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Receipt className="w-20 h-20" />
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3 backdrop-blur-sm group-hover:scale-110 transition-transform">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg relative z-10">Gastos</h3>
            <p className="text-sm text-blue-100 font-medium relative z-10">Gestionar gastos</p>
          </Link>

          <Link
            href="/scan"
            className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-5 shadow-lg text-white hover:scale-[1.02] transition-transform group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Scan className="w-20 h-20" />
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3 backdrop-blur-sm group-hover:scale-110 transition-transform">
              <Scan className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg relative z-10">Escanear</h3>
            <p className="text-sm text-purple-100 font-medium relative z-10">Escanear ticket</p>
          </Link>

          <Link
            href="/reports"
            className="bg-gradient-to-br from-orange-500 to-pink-600 rounded-2xl p-5 shadow-lg text-white hover:scale-[1.02] transition-transform group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <TrendingUp className="w-20 h-20" />
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3 backdrop-blur-sm group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg relative z-10">Reportes</h3>
            <p className="text-sm text-orange-100 font-medium relative z-10">Ver estadísticas</p>
          </Link>
        </div>

        {/* Shopping List Banner */}
        {houseMember?.house_id && (
            <Link href="/shopping" className="block transform transition-all hover:scale-[1.02]">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-5 shadow-lg text-white relative overflow-hidden flex items-center justify-between">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <ShoppingCart className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Lista de Compras</h3>
                            <p className="text-purple-100 text-sm font-medium">No olvides nada del super</p>
                        </div>
                    </div>
                    <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                         <ChevronRight className="w-6 h-6 text-white" />
                    </div>
                </div>
            </Link>
        )}

        {/* Shared Balance - only if in a house */}
        {houseMember?.house_id && (
          <Link href="/shared" className="block transform transition-all hover:scale-[1.02]">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Users className="w-24 h-24" />
              </div>

              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">
                      {(Array.isArray(houseMember.houses) ? houseMember.houses[0] : houseMember.houses)?.name}
                    </h3>
                    {sharedBalance > 0 ? (
                      <p className="text-blue-100 font-medium">
                        Debés ${Math.ceil(sharedBalance).toLocaleString("es-AR")}
                      </p>
                    ) : (
                      <p className="text-blue-100 font-medium">
                        ¡Estás al día! 🎉
                      </p>
                    )}
                  </div>
                </div>
                <div className="bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm">
                  <span className="text-sm font-bold">Ver casa</span>
                </div>
              </div>
            </div>
          </Link>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-around">
          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-1 text-green-600 dark:text-green-400"
          >
            <Home className="w-6 h-6" />
            <span className="text-xs font-medium">Inicio</span>
          </Link>
          <Link
            href="/expenses"
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <Receipt className="w-6 h-6" />
            <span className="text-xs">Gastos</span>
          </Link>
          <Link href="/scan" className="flex flex-col items-center gap-1 -mt-4">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
              <Scan className="w-7 h-7 text-white" />
            </div>
          </Link>
          <Link
            href="/reports"
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs">Reportes</span>
          </Link>
          <Link
            href="/settings"
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs">Config</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
