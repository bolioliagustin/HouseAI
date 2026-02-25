"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Home,
  Receipt,
  TrendingUp,
  Scan,
  Settings,
  ArrowLeft,
  TrendingDown,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from "lucide-react";

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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 pb-24">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Reportes</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Month Selector */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-lg border border-gray-100 dark:border-gray-700">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {formatMonthLabel()}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            disabled={isCurrentMonth()}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-2">
              <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ingresos</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              ${totalIncome.toLocaleString("es-AR")}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mb-2">
              <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gastos</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              ${totalExpenses.toLocaleString("es-AR")}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${
              balance >= 0
                ? "bg-green-100 dark:bg-green-900/30"
                : "bg-red-100 dark:bg-red-900/30"
            }`}>
              <Wallet className={`w-4 h-4 ${
                balance >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Balance</p>
            <p className={`text-lg font-bold ${
              balance >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              ${balance.toLocaleString("es-AR")}
            </p>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Gastos por categoría</h3>

          {isLoading ? (
            <div className="h-24 flex items-center justify-center">
              <p className="text-gray-500">Cargando...</p>
            </div>
          ) : categoryData.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No hay gastos este mes
            </p>
          ) : (
            <div className="space-y-3">
              {categoryData.map((cat, i) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{cat.category}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ${cat.amount.toLocaleString("es-AR")}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Detalle de gastos</h3>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Cargando...</div>
          ) : expenseItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No hay gastos este mes
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {expenseItems.map((item, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${
                      item.type === "fixed"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                    }`}>
                      {item.type === "fixed" ? "Fijo" : "Variable"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.description}
                      </p>
                      <p className="text-xs text-gray-400">{item.category}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white shrink-0 ml-2">
                    ${item.amount.toLocaleString("es-AR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-around">
          <Link href="/dashboard" className="flex flex-col items-center gap-1 text-gray-400">
            <Home className="w-6 h-6" />
            <span className="text-xs">Inicio</span>
          </Link>
          <Link href="/expenses" className="flex flex-col items-center gap-1 text-gray-400">
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
            className="flex flex-col items-center gap-1 text-green-600 dark:text-green-400"
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs font-medium">Reportes</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center gap-1 text-gray-400">
            <Settings className="w-6 h-6" />
            <span className="text-xs">Config</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
