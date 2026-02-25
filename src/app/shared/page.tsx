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
  Check,
  Clock,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Users,
  Plus,
  X,
  CreditCard,
  Trash2,
} from "lucide-react";
import { NOTIFICATION_TEMPLATES, sendNotification } from "@/lib/notifications";

type SharedExpense = {
  id: string;
  total_amount: number;
  category: string;
  description: string | null;
  date: string;
  paid_by: string;
  payer_name: string | null;
  payer_email: string;
  my_split: number;
  is_paid: boolean;
  is_split: boolean;
  items: {
    name: string;
    quantity: number;
    total: number;
    category: string;
  }[];
};

type MemberSpending = {
  user_id: string;
  name: string;
  total: number;
};

type Installment = {
  id: string;
  description: string;
  category: string;
  total_amount: number;
  installments: number;
  monthly_amount: number;
  start_date: string;
  created_by: string;
  cuota_actual: number;
  cuotas_restantes: number;
};

const CATEGORIES = [
  { value: "muebles", label: "🛋️ Muebles/Hogar" },
  { value: "electrodomesticos", label: "🔌 Electrodomésticos" },
  { value: "tecnologia", label: "💻 Tecnología" },
  { value: "servicios", label: "💡 Servicios" },
  { value: "otros", label: "📦 Otros" },
];

export default function SharedExpensesPage() {
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState({ owe: 0, owed: 0 });
  const [memberSpending, setMemberSpending] = useState<MemberSpending[]>([]);
  const [memberCount, setMemberCount] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInstallment, setNewInstallment] = useState({
    description: "",
    category: "muebles",
    total_amount: "",
    installments: "3",
  });
  const [isSavingInstallment, setIsSavingInstallment] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    setIsLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;
    setMyUserId(user.id);

    // Get user's house
    const { data: membership } = await supabase
      .from("house_members")
      .select("house_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership?.house_id) {
      setExpenses([]);
      setIsLoading(false);
      return;
    }

    // Parallel independent fetches
    const [membersRes, sharedExpensesRes, installmentDataRes] = await Promise.all([
      // Get all house members
      supabase
        .from("house_members")
        .select("user_id, users(name, email)")
        .eq("house_id", membership.house_id),

      // Get ALL house expenses (both split and non-split)
      supabase
        .from("shared_expenses")
        .select(
          `
        *,
        users!paid_by(name, email),
        expense_splits(amount, is_paid, user_id),
        receipt_items(name, quantity, total, category)
      `
        )
        .eq("house_id", membership.house_id)
        .order("date", { ascending: false }),

      // Get installment expenses
      supabase
        .from("installment_expenses")
        .select("*")
        .eq("house_id", membership.house_id)
        .order("created_at", { ascending: false }),
    ]);

    const members = membersRes.data;
    const sharedExpenses = sharedExpensesRes.data;
    const installmentData = installmentDataRes.data;

    setMemberCount(members?.length || 1);

    if (installmentData) {
      const now = new Date();
      const processed = installmentData
        .map((inst) => {
          const startDate = new Date(inst.start_date);
          const monthsDiff =
            (now.getFullYear() - startDate.getFullYear()) * 12 +
            (now.getMonth() - startDate.getMonth());
          const cuotaActual = Math.min(monthsDiff + 1, inst.installments);
          const cuotasRestantes = Math.max(inst.installments - cuotaActual, 0);

          return {
            id: inst.id,
            description: inst.description,
            category: inst.category,
            total_amount: inst.total_amount,
            installments: inst.installments,
            monthly_amount: inst.monthly_amount,
            start_date: inst.start_date,
            created_by: inst.created_by,
            cuota_actual: cuotaActual,
            cuotas_restantes: cuotasRestantes,
          };
        })
        .filter((inst) => inst.cuotas_restantes >= 0);

      setInstallments(processed);
    }

    if (sharedExpenses) {
      // Calculate per-member spending
      const spendingMap = new Map<string, { name: string; total: number }>();

      members?.forEach((m) => {
        const userData = m.users as unknown as {
          name: string | null;
          email: string;
        };
        spendingMap.set(m.user_id, {
          name: userData?.name || userData?.email || "Miembro",
          total: 0,
        });
      });

      sharedExpenses.forEach((exp) => {
        const current = spendingMap.get(exp.paid_by);
        if (current) {
          spendingMap.set(exp.paid_by, {
            ...current,
            total: current.total + Number(exp.total_amount),
          });
        }
      });

      setMemberSpending(
        Array.from(spendingMap.entries()).map(([user_id, data]) => ({
          user_id,
          name: data.name,
          total: data.total,
        }))
      );

      // Process expenses for the list
      const processed = sharedExpenses.map((exp) => {
        const payer = exp.users as unknown as {
          name: string | null;
          email: string;
        };
        const splits = (exp.expense_splits as {
          amount: number;
          is_paid: boolean;
          user_id: string;
        }[]) || [];
        const mySplit = splits.find((s) => s.user_id === user.id);
        const hasSplits = splits.length > 0;

        return {
          id: exp.id,
          total_amount: exp.total_amount,
          category: exp.category,
          description: exp.description,
          date: exp.date,
          paid_by: exp.paid_by,
          payer_name: payer?.name,
          payer_email: payer?.email,
          my_split: mySplit?.amount || 0,
          is_paid: mySplit?.is_paid || false,
          is_split: hasSplits,
          items:
            (exp.receipt_items as {
              name: string;
              quantity: number;
              total: number;
              category: string;
            }[]) || [],
        };
      });

      setExpenses(processed);

      // Calculate balance (only from split expenses)
      let owe = 0;
      let owed = 0;

      processed.forEach((exp) => {
        if (!exp.is_split) return;

        if (exp.paid_by === user.id) {
          const unpaidSplits = (
            sharedExpenses.find((e) => e.id === exp.id)?.expense_splits as {
              amount: number;
              is_paid: boolean;
              user_id: string;
            }[]
          )?.filter((s) => !s.is_paid && s.user_id !== user.id);

          unpaidSplits?.forEach((s) => {
            owed += s.amount;
          });
        } else {
          if (exp.my_split > 0 && !exp.is_paid) {
            owe += exp.my_split;
          }
        }
      });

      setBalance({ owe, owed });
    }

    setIsLoading(false);
  }

  async function markAsPaid(expenseId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("expense_splits")
      .update({ is_paid: true })
      .eq("expense_id", expenseId)
      .eq("user_id", user.id);

    loadExpenses();
  }

  async function saveInstallment() {
    if (!newInstallment.description || !newInstallment.total_amount) return;
    setIsSavingInstallment(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const { data: membership } = await supabase
        .from("house_members")
        .select("house_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership?.house_id) throw new Error("No house");

      const totalAmount = parseFloat(newInstallment.total_amount);
      const numInstallments = parseInt(newInstallment.installments);
      const monthlyAmount = Math.ceil((totalAmount / numInstallments) * 100) / 100;

      await supabase.from("installment_expenses").insert({
        house_id: membership.house_id,
        created_by: user.id,
        description: newInstallment.description,
        category: newInstallment.category,
        total_amount: totalAmount,
        installments: numInstallments,
        monthly_amount: monthlyAmount,
        start_date: new Date().toISOString().split("T")[0],
      });

      await sendNotification(
          NOTIFICATION_TEMPLATES.NEW_INSTALLMENT(
              newInstallment.description,
              totalAmount
          )
      );

      setNewInstallment({
        description: "",
        category: "muebles",
        total_amount: "",
        installments: "3",
      });
      setShowAddForm(false);
      loadExpenses();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingInstallment(false);
    }
  }

  async function deleteInstallment(id: string) {
    await supabase.from("installment_expenses").delete().eq("id", id);
    loadExpenses();
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
    });
  };

  const totalHouseSpending = memberSpending.reduce(
    (sum, m) => sum + m.total,
    0
  );

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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Gastos de la Casa
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
                {/* Installments Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Cuotas compartidas
              </h3>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 transition-colors"
            >
              {showAddForm ? (
                <X className="w-5 h-5" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Add Installment Form */}
          {showAddForm && (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border-b border-gray-100 dark:border-gray-700 space-y-3">
              <input
                type="text"
                placeholder="Descripción (ej: Sillón nuevo)"
                value={newInstallment.description}
                onChange={(e) =>
                  setNewInstallment({ ...newInstallment, description: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />

              <select
                value={newInstallment.category}
                onChange={(e) =>
                  setNewInstallment({ ...newInstallment, category: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                    Monto total
                  </label>
                  <input
                    type="number"
                    placeholder="$50.000"
                    value={newInstallment.total_amount}
                    onChange={(e) =>
                      setNewInstallment({
                        ...newInstallment,
                        total_amount: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                    Cuotas
                  </label>
                  <select
                    value={newInstallment.installments}
                    onChange={(e) =>
                      setNewInstallment({
                        ...newInstallment,
                        installments: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {[2, 3, 6, 9, 12, 18, 24].map((n) => (
                      <option key={n} value={n}>
                        {n} cuotas
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview */}
              {newInstallment.total_amount && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-sm">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Cuota mensual total</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      $
                      {Math.ceil(
                        parseFloat(newInstallment.total_amount) /
                          parseInt(newInstallment.installments)
                      ).toLocaleString("es-AR")}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400 mt-1">
                    <span>Tu parte por mes</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      $
                      {Math.ceil(
                        parseFloat(newInstallment.total_amount) /
                          parseInt(newInstallment.installments) /
                          memberCount
                      ).toLocaleString("es-AR")}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={saveInstallment}
                disabled={
                  isSavingInstallment ||
                  !newInstallment.description ||
                  !newInstallment.total_amount
                }
                className="w-full py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isSavingInstallment ? (
                  "Guardando..."
                ) : (
                  <>
                    <Plus className="w-5 h-5" /> Agregar cuotas
                  </>
                )}
              </button>
            </div>
          )}

          {/* Installments List */}
          {installments.length === 0 && !showAddForm ? (
            <div className="p-6 text-center">
              <CreditCard className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No hay cuotas compartidas
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {installments.map((inst) => {
                const myMonthlyCost = inst.monthly_amount / memberCount;
                const isFinished = inst.cuotas_restantes === 0;

                return (
                  <div
                    key={inst.id}
                    className={`p-4 flex items-center gap-4 ${
                      isFinished ? "opacity-50" : ""
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        isFinished
                          ? "bg-green-100 dark:bg-green-900/30"
                          : "bg-purple-100 dark:bg-purple-900/30"
                      }`}
                    >
                      {isFinished ? (
                        <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                      ) : (
                        <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {inst.description}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {isFinished ? (
                          "✅ Pagado completo"
                        ) : (
                          <>
                            Cuota {inst.cuota_actual} de {inst.installments} ·{" "}
                            <span className="text-purple-600 dark:text-purple-400 font-medium">
                              ${Math.ceil(myMonthlyCost).toLocaleString("es-AR")}/mes
                            </span>
                          </>
                        )}
                      </p>
                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isFinished ? "bg-green-500" : "bg-purple-500"
                          }`}
                          style={{
                            width: `${(inst.cuota_actual / inst.installments) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        ${Number(inst.total_amount).toLocaleString("es-AR")}
                      </p>
                      <p className="text-xs text-gray-400">total</p>
                    </div>
                    {inst.created_by === myUserId && (
                      <button
                        onClick={() => deleteInstallment(inst.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Member Spending Summary */}
        {memberSpending.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Gasto por persona
              </h3>
            </div>

            <div className="space-y-3">
              {memberSpending.map((member) => {
                const percentage =
                  totalHouseSpending > 0
                    ? (member.total / totalHouseSpending) * 100
                    : 0;

                return (
                  <div key={member.user_id}>
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`text-sm font-medium ${
                          member.user_id === myUserId
                            ? "text-green-700 dark:text-green-400"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {member.user_id === myUserId ? "Vos" : member.name}
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        ${member.total.toLocaleString("es-AR")}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          member.user_id === myUserId
                            ? "bg-green-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between">
              <span className="text-sm text-gray-500">Total casa</span>
              <span className="font-bold text-gray-900 dark:text-white">
                ${totalHouseSpending.toLocaleString("es-AR")}
              </span>
            </div>
          </div>
        )}

        {/* Balance Cards - only if there are splits */}
        {(balance.owe > 0 || balance.owed > 0) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">Debo</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                ${balance.owe.toLocaleString("es-AR")}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-600 dark:text-green-400">
                Me deben
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${balance.owed.toLocaleString("es-AR")}
              </p>
            </div>
          </div>
        )}

        {/* Expenses List */}
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Cargando...</div>
        ) : expenses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center">
            <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              No hay gastos de la casa
            </p>
            <Link
              href="/scan"
              className="mt-4 inline-block px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
            >
              Escanear un ticket
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 px-1">
              Gastos recientes
            </h3>
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedId(
                      expandedId === expense.id ? null : expense.id
                    )
                  }
                  className="w-full p-4 flex items-center gap-4 text-left"
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      !expense.is_split
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : expense.paid_by === myUserId
                        ? "bg-green-100 dark:bg-green-900/30"
                        : expense.is_paid
                        ? "bg-gray-100 dark:bg-gray-700"
                        : "bg-red-100 dark:bg-red-900/30"
                    }`}
                  >
                    {!expense.is_split ? (
                      <Home className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    ) : expense.paid_by === myUserId ? (
                      <Receipt className="w-6 h-6 text-green-600 dark:text-green-400" />
                    ) : expense.is_paid ? (
                      <Check className="w-6 h-6 text-gray-400" />
                    ) : (
                      <Clock className="w-6 h-6 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {expense.description || expense.category}
                      </p>
                      {!expense.is_split && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded font-medium shrink-0">
                          Sin dividir
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(expense.date)} ·{" "}
                      {expense.paid_by === myUserId
                        ? "Pagaste vos"
                        : `Pagó ${expense.payer_name || expense.payer_email}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white">
                      ${expense.total_amount.toLocaleString("es-AR")}
                    </p>
                    {expense.is_split &&
                      expense.my_split > 0 &&
                      expense.paid_by !== myUserId && (
                        <p
                          className={`text-sm ${
                            expense.is_paid
                              ? "text-gray-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {expense.is_paid
                            ? "Pagado"
                            : `Debes $${expense.my_split.toLocaleString("es-AR")}`}
                        </p>
                      )}
                  </div>
                  {expandedId === expense.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {/* Expanded Content */}
                {expandedId === expense.id && (
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    {expense.items.length > 0 && (
                      <div className="p-4 space-y-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Productos ({expense.items.length})
                        </p>
                        {expense.items.slice(0, 5).map((item, i) => (
                          <div
                            key={i}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-gray-600 dark:text-gray-400">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="text-gray-900 dark:text-white">
                              ${item.total.toLocaleString("es-AR")}
                            </span>
                          </div>
                        ))}
                        {expense.items.length > 5 && (
                          <p className="text-xs text-gray-400">
                            +{expense.items.length - 5} productos más
                          </p>
                        )}
                      </div>
                    )}

                    {expense.is_split &&
                      expense.paid_by !== myUserId &&
                      expense.my_split > 0 &&
                      !expense.is_paid && (
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                          <button
                            onClick={() => markAsPaid(expense.id)}
                            className="w-full py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
                          >
                            <Check className="w-5 h-5" />
                            Marcar como pagado
                          </button>
                        </div>
                      )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-around">
          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <Home className="w-6 h-6" />
            <span className="text-xs">Inicio</span>
          </Link>
          <Link
            href="/expenses"
            className="flex flex-col items-center gap-1 text-gray-400"
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
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs">Reportes</span>
          </Link>
          <Link
            href="/settings"
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs">Config</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
