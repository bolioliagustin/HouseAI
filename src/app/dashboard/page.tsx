export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Home, Receipt, TrendingUp, Scan, Settings, LogOut, Plus, Users, ShoppingCart, ChevronRight, Sparkles } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

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
    sharedExpensesRes,
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
    // Shared Expenses paid by this user this month (tickets + house expenses)
    supabase
      .from("shared_expenses")
      .select("id, total_amount, is_shared, house_id")
      .eq("paid_by", user.id)
      .gte("date", currentMonthStart),
  ]);

  const profile = profileRes.data;
  const houseMember = houseMemberRes.data;
  const monthlyIncomes = monthlyIncomesRes.data;
  const recurringIncomes = recurringIncomesRes.data;
  const fixedExpenses = fixedExpensesRes.data;
  const sharedExpenses = sharedExpensesRes.data || [];

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

  // Also fetch expense_splits for shared expenses where this user is paid_by
  // to know which ones were actually split (so we only count our portion)
  let mySplitsAsPayer: any[] = [];
  if (sharedExpenses.length > 0) {
    const sharedExpenseIds = sharedExpenses.map((e: any) => e.id);
    const { data: splitsData } = await supabase
      .from("expense_splits")
      .select("expense_id, amount, user_id")
      .in("expense_id", sharedExpenseIds);
    mySplitsAsPayer = splitsData || [];
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

  // Fixed expenses: count full amount (is_shared flag on fixed_expenses is just metadata now)
  const totalFixed = fixedExpenses?.reduce((sum, exp) => {
    return sum + Number(exp.amount);
  }, 0) || 0;

  // Shared expenses split into personal (no house_id) vs house (has house_id)
  const sharedPersonal = sharedExpenses.filter((e: any) => !e.house_id);
  const sharedHouse = sharedExpenses.filter((e: any) => !!e.house_id);

  const totalSharedPersonal = sharedPersonal.reduce((sum: number, exp: any) => {
    return sum + Number(exp.total_amount);
  }, 0);

  const totalSharedHouse = sharedHouse.reduce((sum: number, exp: any) => {
    const expSplits = mySplitsAsPayer.filter((s: any) => s.expense_id === exp.id);
    if (expSplits.length > 0) {
      const ourSplit = expSplits.find((s: any) => s.user_id === user.id);
      return sum + (ourSplit ? Number(ourSplit.amount) : Number(exp.total_amount));
    }
    return sum + Number(exp.total_amount);
  }, 0);

  const totalShared = totalSharedPersonal + totalSharedHouse;

  const splits = splitsRes.data;
  const sharedBalance = splits?.reduce((sum: number, split: any) => sum + Number(split.amount), 0) || 0;
  
  // Note: otherMemberName logic was unused in UI, removing it for cleaner code
  // or keeping it if needed for future expansion.
  // The current UI uses houseMember.houses.name for display.

  const balance = totalIncome - totalFixed - totalShared;

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-background/90 backdrop-blur-lg border-b border-border/40 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Home className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                MitAI
              </h1>
              <p className="text-xs text-muted-foreground">
                Hola, {profile?.name || user.email?.split("@")[0]} 👋
              </p>
            </div>
          </div>
          <form action={signOut}>
            <button 
              type="submit"
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Balance Card */}
        <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border/40">
          <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">Balance disponible</p>
          <p className="text-[2.5rem] leading-none font-bold text-primary mb-6">
            ${balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-xs font-medium">Ingresos</p>
              <p className="text-base font-semibold text-foreground">
                ${totalIncome.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Gastos fijos</p>
              <p className="text-base font-semibold text-foreground">
                ${totalFixed.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="my-5 border-t border-border/50"></div>

          {/* Monthly expenses breakdown */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <p className="text-muted-foreground">Gastos personales del mes</p>
              <p className="font-semibold text-foreground">${totalSharedPersonal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
            </div>
            {houseMember?.house_id && (
              <div className="flex justify-between items-center text-sm">
                <p className="text-muted-foreground">Gastos de la casa</p>
                <div className="text-right">
                  <p className="font-semibold text-foreground">${totalSharedHouse.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-muted-foreground">Total: ${sharedHouse.reduce((acc: number, val: any) => acc + Number(val.total_amount), 0).toLocaleString("es-AR")}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 px-1">Acciones Rápidas</p>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/incomes"
              className="bg-primary/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
            >
              <div className="w-10 h-10 bg-card rounded-full flex items-center justify-center shadow-sm">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Ingresos</span>
            </Link>

            <Link
              href="/expenses"
              className="bg-primary/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
            >
              <div className="w-10 h-10 bg-card rounded-full flex items-center justify-center shadow-sm">
                <Receipt className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Gastos</span>
            </Link>

            <Link
              href="/scan"
              className="bg-primary/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
            >
              <div className="w-10 h-10 bg-card rounded-full flex items-center justify-center shadow-sm">
                <Scan className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Escanear</span>
            </Link>

            <Link
              href="/reports"
              className="bg-primary/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
            >
              <div className="w-10 h-10 bg-card rounded-full flex items-center justify-center shadow-sm">
                <TrendingUp className="w-5 h-5 text-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground">Reportes</span>
            </Link>
          </div>
        </div>

        {/* Shopping List Banner */}
        {houseMember?.house_id && (
            <Link href="/shopping" className="block transform transition-all hover:scale-[1.01]">
                <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-secondary" />
                        </div>
                        <h3 className="font-semibold text-foreground text-sm">Lista de compras</h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
            </Link>
        )}

        {/* Shared Balance - only if in a house */}
        {houseMember?.house_id && (
          <Link href="/shared" className="block transform transition-all hover:scale-[1.01]">
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                  <Home className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Mi casa</h3>
                  {sharedBalance > 0 ? (
                    <p className="text-accent font-medium text-xs">
                      Debés ${Math.ceil(sharedBalance).toLocaleString("es-AR")}
                    </p>
                  ) : (
                    <p className="text-primary font-medium text-xs">
                      ¡Estás al día! 🎉
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </Link>
        )}
        
        {/* Weekly Summary mockup from Figma */}
        <div className="bg-[#896f53] rounded-2xl p-5 shadow-sm mt-4 relative overflow-hidden">
             <div className="relative z-10">
                 <h3 className="text-white font-semibold mb-1">Resumen Semanal</h3>
                 <p className="text-white/80 text-sm leading-snug max-w-[80%]">Tus gastos de casa se mantienen dentro del presupuesto proyectado para este mes.</p>
             </div>
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl pointer-events-none"></div>
        </div>
      </main>

      {/* Chat FAB */}
      {houseMember?.house_id && (
        <Link
            href="/chat"
            className="fixed bottom-24 right-4 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform z-50"
        >
            <Sparkles className="w-6 h-6" />
        </Link>
      )}

      <BottomNav />
    </div>
  );
}
