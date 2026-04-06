"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  TrendingUp,
  ArrowLeft,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

type CategoryData = {
  category: string;
  amount: number;
  percentage: number;
};

type ExpenseItem = {
  description: string;
  amount: number;
  category: string;
  date: string;
  type: "fixed" | "variable";
};

// Category label mapping
const categoryLabels: Record<string, string> = {
  alquiler: "🏠 Alquiler",
  servicios: "💡 Servicios",
  internet: "📶 Internet/Teléfono",
  supermercado: "🛒 Supermercado",
  comida: "🍕 Comida/Delivery",
  limpieza: "🧹 Limpieza",
  muebles: "🛋️ Muebles/Hogar",
  entretenimiento: "🎮 Entretenimiento",
  transporte: "🚗 Transporte",
  salud: "💊 Salud",
  otros: "📦 Otros",
  Supermercado: "🛒 Supermercado",
  Otros: "📦 Otros",
};

const getCategoryLabel = (cat: string) => categoryLabels[cat] || cat;

export default function ReportsPage() {
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const supabase = createClient();

  useEffect(() => {
    loadReportData();
  }, [selectedMonth]);

  function navigateMonth(direction: number) {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + direction, 1);
    setSelectedMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    );
  }

  const formatMonthLabel = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    const label = date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const isCurrentMonth = () => {
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return selectedMonth === current;
  };

  /**
   * Loads all report data for the selected month.
   * Optimized to use parallel fetching and avoid N+1 queries.
   * @complexity O(n) where n is the number of expenses
   */
  async function loadReportData() {
    setIsLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const [year, month] = selectedMonth.split("-").map(Number);
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    const monthStart = `${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${monthStr}-${lastDay}`;

    // 1. Initial Parallel Fetch
    // Fetch critical data concurrently to minimize waterfall
    const [
      incomesRes,
      recurringIncomesRes,
      membershipRes,
      fixedExpensesRes,
      myExpensesRes,
    ] = await Promise.all([
      // Regular incomes
      supabase
        .from("incomes")
        .select("amount")
        .eq("user_id", user.id)
        .eq("is_recurring", false)
        .gte("month", monthStart)
        .lte("month", monthEnd),
      // Recurring incomes
      supabase
        .from("incomes")
        .select("amount")
        .eq("user_id", user.id)
        .eq("is_recurring", true),
      // Membership
      supabase
        .from("house_members")
        .select("house_id")
        .eq("user_id", user.id)
        .maybeSingle(),
      // Fixed Expenses
      supabase.from("fixed_expenses").select("*").eq("user_id", user.id),
      // My Shared Expenses (paid by me)
      supabase
        .from("shared_expenses")
        .select("id, total_amount, category, description, date, is_shared, house_id")
        .eq("paid_by", user.id)
        .gte("date", monthStart)
        .lte("date", monthEnd),
    ]);

    // Process Incomes
    const monthlyIncome = Math.ceil(
      (incomesRes.data?.reduce((sum, inc) => sum + Number(inc.amount), 0) || 0) +
        (recurringIncomesRes.data?.reduce((sum, inc) => sum + Number(inc.amount), 0) || 0)
    );
    setTotalIncome(monthlyIncome);

    // 2. Fetch Dependent Data (Splits, Installments)
    const membership = membershipRes.data;
    const myExpenses = myExpensesRes.data || [];

    let memberCountPromise = Promise.resolve(1) as any;
    let splitsFromOthersPromise = Promise.resolve({ data: [] }) as any;
    let installmentsPromise = Promise.resolve({ data: [] }) as any;
    let allSplitsForMyExpensesPromise = Promise.resolve({ data: [] }) as any;

    if (membership?.house_id) {
      memberCountPromise = supabase
        .from("house_members")
        .select("*", { count: "exact", head: true })
        .eq("house_id", membership.house_id)
        .then((res) => res.count || 1);

      splitsFromOthersPromise = supabase
        .from("expense_splits")
        .select("amount, shared_expenses!inner(date, category, description, paid_by)")
        .eq("user_id", user.id)
        .neq("shared_expenses.paid_by", user.id)
        .gte("shared_expenses.date", monthStart)
        .lte("shared_expenses.date", monthEnd) as any;

      installmentsPromise = supabase
        .from("installment_expenses")
        .select("*")
        .eq("house_id", membership.house_id);
    }

    // Batch fetch splits for ALL my expenses to fix N+1
    if (myExpenses.length > 0) {
      allSplitsForMyExpensesPromise = supabase
        .from("expense_splits")
        .select("expense_id, amount, user_id")
        .in(
          "expense_id",
          myExpenses.map((e) => e.id)
        ) as any;
    }

    const [memberCount, splitsFromOthersRes, installmentsRes, allSplitsRes] =
      await Promise.all([
        memberCountPromise,
        splitsFromOthersPromise,
        installmentsPromise,
        allSplitsForMyExpensesPromise,
      ]);

    // === PROCESS DATA ===
    const allExpenseItems: ExpenseItem[] = [];
    let totalFixedAmount = 0;
    let totalVariableAmount = 0;

    // 1. Fixed Expenses
    fixedExpensesRes.data?.forEach((exp) => {
      const amount = Math.ceil(
        exp.is_shared ? Number(exp.amount) / memberCount : Number(exp.amount)
      );
      totalFixedAmount += amount;
      allExpenseItems.push({
        description: exp.description || getCategoryLabel(exp.category),
        amount,
        category: getCategoryLabel(exp.category || "otros"),
        date: monthStart,
        type: "fixed",
      });
    });

    // 2. My Variable Expenses
    // Map splits by expense ID for O(1) lookup
    const splitsMap = new Map<string, any[]>();
    allSplitsRes.data?.forEach((split: any) => {
      if (!splitsMap.has(split.expense_id)) {
        splitsMap.set(split.expense_id, []);
      }
      splitsMap.get(split.expense_id)?.push(split);
    });

    myExpenses.forEach((exp) => {
      let myAmount = 0;
      const expenseSplits = splitsMap.get(exp.id);

      if (expenseSplits && expenseSplits.length > 0) {
        // It has splits. Find mine.
        const mySplit = expenseSplits.find((s: any) => s.user_id === user.id);
        myAmount = mySplit ? Math.ceil(Number(mySplit.amount)) : 0;
      } else {
        // No splits, I paid full amount
        myAmount = Math.ceil(Number(exp.total_amount));
      }

      totalVariableAmount += myAmount;
      allExpenseItems.push({
        description: exp.description || getCategoryLabel(exp.category),
        amount: myAmount,
        category: getCategoryLabel(exp.category || "otros"),
        date: exp.date,
        type: "variable",
      });
    });

    // 3. Splits from Others
    splitsFromOthersRes.data?.forEach((s: any) => {
      const shared = Array.isArray(s.shared_expenses)
        ? s.shared_expenses[0]
        : s.shared_expenses;
      if (!shared?.date) return;
      const amount = Math.ceil(Number(s.amount));
      totalVariableAmount += amount;
      allExpenseItems.push({
        description: shared.description || getCategoryLabel(shared.category || "otros"),
        amount,
        category: getCategoryLabel(shared.category || "otros"),
        date: shared.date,
        type: "variable",
      });
    });

    // 4. Installments
    if (installmentsRes.data) {
      const selectedDate = new Date(year, month - 1, 1);
      installmentsRes.data.forEach((inst: any) => {
        const startDate = new Date(inst.start_date);
        const monthsDiff =
          (selectedDate.getFullYear() - startDate.getFullYear()) * 12 +
          (selectedDate.getMonth() - startDate.getMonth());

        // Only include if this month is within the installment period
        if (monthsDiff >= 0 && monthsDiff < inst.installments) {
          const myCost = Math.ceil(Number(inst.monthly_amount) / memberCount);
          totalFixedAmount += myCost;
          allExpenseItems.push({
            description: `${inst.description} (cuota ${monthsDiff + 1}/${inst.installments})`,
            amount: myCost,
            category: getCategoryLabel(inst.category || "otros"),
            date: monthStart,
            type: "fixed",
          });
        }
      });
    }

    const totalExp = totalFixedAmount + totalVariableAmount;
    setTotalExpenses(totalExp);
    setExpenseItems(allExpenseItems.sort((a, b) => b.amount - a.amount));

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    allExpenseItems.forEach((exp) => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });

    const categories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExp > 0 ? (amount / totalExp) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    setCategoryData(categories);
    setIsLoading(false);
  }

  const balance = totalIncome - totalExpenses;

  const categoryColors = [
    "bg-purple-500",
    "bg-blue-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-red-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-orange-500",
  ];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-background/90 backdrop-blur-lg border-b border-border/40 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Reportes</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Month Selector */}
        <div className="flex items-center justify-between bg-card rounded-[24px] p-3 shadow-sm border border-border/40">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-3 rounded-[16px] hover:bg-muted transition-colors border border-border/40"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <span className="text-lg font-bold text-foreground">
            {formatMonthLabel()}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            disabled={isCurrentMonth()}
            className="p-3 rounded-[16px] hover:bg-muted transition-colors disabled:opacity-30 border border-border/40"
          >
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border/40 flex flex-col items-center xl:items-start text-center xl:text-left transition-all hover:shadow-md">
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ingresos</p>
            <p className="text-lg font-bold text-primary">
              ${totalIncome.toLocaleString("es-AR")}
            </p>
          </div>

          <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border/40 flex flex-col items-center xl:items-start text-center xl:text-left transition-all hover:shadow-md">
            <div className="w-10 h-10 bg-destructive/10 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
              <TrendingDown className="w-5 h-5 text-destructive" />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Gastos</p>
            <p className="text-lg font-bold text-destructive">
              ${totalExpenses.toLocaleString("es-AR")}
            </p>
          </div>

          <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border/40 flex flex-col items-center xl:items-start text-center xl:text-left transition-all hover:shadow-md">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 shadow-inner ${
              balance >= 0
                ? "bg-secondary/10"
                : "bg-destructive/10"
            }`}>
              <Wallet className={`w-5 h-5 ${
                balance >= 0
                  ? "text-secondary"
                  : "text-destructive"
              }`} />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Balance</p>
            <p className={`text-lg font-bold ${
              balance >= 0
                ? "text-secondary"
                : "text-destructive"
            }`}>
              ${balance.toLocaleString("es-AR")}
            </p>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border/40">
          <h3 className="font-bold text-foreground mb-5">Gastos por categoría</h3>

          {isLoading ? (
            <div className="h-24 flex items-center justify-center">
              <p className="text-muted-foreground font-medium">Cargando...</p>
            </div>
          ) : categoryData.length === 0 ? (
            <div className="bg-muted/10 border border-border/40 rounded-2xl p-8 text-center">
               <p className="text-muted-foreground font-medium">No hay gastos este mes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {categoryData.map((cat, i) => (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground font-medium">{cat.category}</span>
                    <span className="font-bold text-foreground">
                      ${cat.amount.toLocaleString("es-AR")}
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`h-full ${categoryColors[i % categoryColors.length]} rounded-full transition-all`}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expense Details */}
        <div className="bg-card rounded-[24px] shadow-sm border border-border/40 overflow-hidden">
          <div className="p-5 border-b border-border/40 bg-muted/10">
            <h3 className="font-bold text-foreground">Detalle de gastos</h3>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground font-medium">Cargando...</div>
          ) : expenseItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground font-medium">
              No hay gastos este mes
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {expenseItems.map((item, i) => (
                <div key={i} className="px-5 py-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl flex items-center justify-center shadow-inner shrink-0 ${
                      item.type === "fixed"
                        ? "bg-secondary/10"
                        : "bg-accent/10"
                    }`}>
                        <TrendingDown className={`w-4 h-4 ${
                             item.type === "fixed" ? "text-secondary" : "text-accent"
                        }`}/>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                            item.type === "fixed"
                                ? "bg-secondary/10 text-secondary"
                                : "bg-accent/10 text-accent"
                          }`}>
                            {item.type === "fixed" ? "Fijo" : "Variable"}
                          </span>
                          <p className="text-[10px] font-medium text-muted-foreground truncate uppercase tracking-wider">{item.category}</p>
                      </div>
                    </div>
                  </div>
                  <span className="text-base font-bold text-foreground shrink-0 ml-2">
                    ${item.amount.toLocaleString("es-AR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
