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
import { BottomNav } from "@/components/BottomNav";

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

  async function deleteSharedExpense(expenseId: string) {
    if (confirm("¿Estás seguro de eliminar este gasto? Esta acción eliminará también la división con los miembros.")) {
      setIsLoading(true);
      await supabase.from("shared_expenses").delete().eq("id", expenseId);
      loadExpenses();
    }
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
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Gastos de la Casa
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Installments Section */}
        <div className="bg-card rounded-[24px] shadow-sm border border-border/40 overflow-hidden transition-all hover:shadow-md">
          <div className="p-5 border-b border-border/40 flex items-center justify-between bg-muted/10">
            <div className="flex items-center gap-2">
              <div className="bg-accent/10 p-2 rounded-xl">
                 <CreditCard className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-bold text-foreground">
                Cuotas compartidas
              </h3>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="p-2.5 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm transition-colors"
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
            <div className="p-5 bg-muted/5 border-b border-border/40 space-y-4">
              <input
                type="text"
                placeholder="Descripción (ej: Sillón nuevo)"
                value={newInstallment.description}
                onChange={(e) =>
                  setNewInstallment({ ...newInstallment, description: e.target.value })
                }
                className="w-full px-5 py-4 rounded-[16px] border border-border/40 bg-card shadow-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
              />

              <select
                value={newInstallment.category}
                onChange={(e) =>
                  setNewInstallment({ ...newInstallment, category: e.target.value })
                }
                className="w-full px-5 py-4 rounded-[16px] border border-border/40 bg-card shadow-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block ml-1">
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
                    className="w-full px-5 py-4 rounded-[16px] border border-border/40 shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block ml-1">
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
                    className="w-full px-5 py-4 rounded-[16px] border border-border/40 shadow-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
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
                <div className="bg-card shadow-sm border border-border/40 rounded-[16px] p-4 text-sm mt-2">
                  <div className="flex justify-between text-muted-foreground font-medium">
                    <span>Cuota mensual total</span>
                    <span className="font-bold text-foreground">
                      $
                      {Math.ceil(
                        parseFloat(newInstallment.total_amount) /
                          parseInt(newInstallment.installments)
                      ).toLocaleString("es-AR")}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground font-medium mt-2 pt-2 border-t border-border/40">
                    <span>Tu parte por mes</span>
                    <span className="font-bold text-accent text-base">
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
                className="w-full py-4 mt-2 bg-accent hover:bg-accent/90 shadow-sm disabled:opacity-50 text-accent-foreground font-bold rounded-[16px] transition-colors flex items-center justify-center gap-2"
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
            <div className="p-8 text-center bg-muted/5">
              <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">
                No hay cuotas compartidas
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {installments.map((inst) => {
                const myMonthlyCost = inst.monthly_amount / memberCount;
                const isFinished = inst.cuotas_restantes === 0;

                return (
                  <div
                    key={inst.id}
                    className={`p-5 flex items-center gap-4 hover:bg-muted/5 transition-colors group ${
                      isFinished ? "opacity-50" : ""
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-[16px] flex items-center justify-center shadow-inner shrink-0 ${
                        isFinished
                          ? "bg-secondary/10"
                          : "bg-accent/10"
                      }`}
                    >
                      {isFinished ? (
                        <Check className="w-6 h-6 text-secondary" />
                      ) : (
                        <CreditCard className="w-6 h-6 text-accent" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {inst.description}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground mt-0.5 uppercase tracking-wider">
                        {isFinished ? (
                          "Pagado completo"
                        ) : (
                          <>
                            Cuota {inst.cuota_actual} de {inst.installments} ·{" "}
                            <span className="text-accent font-bold">
                              ${Math.ceil(myMonthlyCost).toLocaleString("es-AR")}/mes
                            </span>
                          </>
                        )}
                      </p>
                      {/* Progress bar */}
                      <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isFinished ? "bg-secondary" : "bg-accent"
                          }`}
                          style={{
                            width: `${(inst.cuota_actual / inst.installments) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-foreground">
                        ${Number(inst.total_amount).toLocaleString("es-AR")}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">total</p>
                    </div>
                    {inst.created_by === myUserId && (
                      <button
                        onClick={() => deleteInstallment(inst.id)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-5 h-5" />
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
          <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border/40 transition-all hover:shadow-md">
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-primary/10 p-2 rounded-xl">
                 <Users className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold text-foreground">
                Gasto por persona
              </h3>
            </div>

            <div className="space-y-4">
              {memberSpending.map((member) => {
                const percentage =
                  totalHouseSpending > 0
                    ? (member.total / totalHouseSpending) * 100
                    : 0;

                return (
                  <div key={member.user_id}>
                    <div className="flex justify-between items-center mb-2">
                      <span
                        className={`text-sm font-semibold uppercase tracking-wider ${
                          member.user_id === myUserId
                            ? "text-secondary"
                            : "text-muted-foreground"
                        }`}
                      >
                        {member.user_id === myUserId ? "Vos" : member.name}
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        ${member.total.toLocaleString("es-AR")}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all ${
                          member.user_id === myUserId
                            ? "bg-secondary"
                            : "bg-primary"
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-border/40 flex justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total casa</span>
              <span className="font-bold text-foreground text-lg">
                ${totalHouseSpending.toLocaleString("es-AR")}
              </span>
            </div>
          </div>
        )}

        {/* Balance Cards - only if there are splits */}
        {(balance.owe > 0 || balance.owed > 0) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-destructive/10 rounded-[24px] p-5 border border-transparent hover:border-destructive/20 transition-all text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-destructive mb-1">Debo</p>
              <p className="text-2xl font-bold text-destructive">
                ${balance.owe.toLocaleString("es-AR")}
              </p>
            </div>
            <div className="bg-secondary/10 rounded-[24px] p-5 border border-transparent hover:border-secondary/20 transition-all text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-secondary mb-1">
                Me deben
              </p>
              <p className="text-2xl font-bold text-secondary">
                ${balance.owed.toLocaleString("es-AR")}
              </p>
            </div>
          </div>
        )}

        {/* Expenses List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground font-medium">Cargando...</div>
        ) : expenses.length === 0 ? (
          <div className="bg-card border border-border/40 rounded-2xl p-10 text-center shadow-sm">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
               <ShoppingBag className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-foreground font-semibold">
              No hay gastos de la casa
            </p>
            <Link
              href="/scan"
              className="mt-4 inline-block px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold transition-colors shadow-sm"
            >
              Escanear un ticket
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground px-1 mt-6">
              Gastos recientes
            </h3>
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="bg-card rounded-[24px] shadow-sm border border-border/40 overflow-hidden transition-all hover:shadow-md"
              >
                <button
                  onClick={() =>
                    setExpandedId(
                      expandedId === expense.id ? null : expense.id
                    )
                  }
                  className="w-full p-4 flex items-center gap-4 text-left hover:bg-muted/10 transition-colors"
                >
                  <div
                    className={`w-12 h-12 rounded-[16px] flex items-center justify-center shadow-inner shrink-0 ${
                      !expense.is_split
                        ? "bg-accent/10 text-accent"
                        : expense.paid_by === myUserId
                        ? "bg-secondary/10 text-secondary"
                        : expense.is_paid
                        ? "bg-muted text-muted-foreground"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {!expense.is_split ? (
                      <Home className="w-6 h-6" />
                    ) : expense.paid_by === myUserId ? (
                      <Receipt className="w-6 h-6" />
                    ) : expense.is_paid ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <Clock className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">
                        {expense.description || expense.category}
                      </p>
                      {!expense.is_split && (
                        <span className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded-full font-bold uppercase tracking-wider shrink-0">
                          Sin dividir
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mt-0.5 uppercase tracking-wider">
                      {formatDate(expense.date)} ·{" "}
                      {expense.paid_by === myUserId
                        ? "Pagaste vos"
                        : `Pagó ${expense.payer_name || expense.payer_email}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground text-base">
                      ${expense.total_amount.toLocaleString("es-AR")}
                    </p>
                    {expense.is_split &&
                      expense.my_split > 0 &&
                      expense.paid_by !== myUserId && (
                        <p
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            expense.is_paid
                              ? "text-muted-foreground"
                              : "text-destructive"
                          }`}
                        >
                          {expense.is_paid
                            ? "Pagado"
                            : `Debes $${expense.my_split.toLocaleString("es-AR")}`}
                        </p>
                      )}
                  </div>
                  {expandedId === expense.id ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                </button>

                {/* Expanded Content */}
                {expandedId === expense.id && (
                  <div className="border-t border-border/40 bg-muted/5">
                    {expense.items.length > 0 && (
                      <div className="p-4 space-y-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Productos ({expense.items.length})
                        </p>
                        {expense.items.slice(0, 5).map((item, i) => (
                          <div
                            key={i}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-muted-foreground font-medium">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="text-foreground font-semibold">
                              ${item.total.toLocaleString("es-AR")}
                            </span>
                          </div>
                        ))}
                        {expense.items.length > 5 && (
                          <p className="text-xs text-muted-foreground font-medium italic">
                            +{expense.items.length - 5} productos más
                          </p>
                        )}
                      </div>
                    )}

                    {expense.is_split &&
                      expense.paid_by !== myUserId &&
                      expense.my_split > 0 &&
                      !expense.is_paid && (
                        <div className="p-4 border-t border-border/40">
                          <button
                            onClick={() => markAsPaid(expense.id)}
                            className="w-full py-3 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                          >
                            <Check className="w-5 h-5" />
                            Marcar como pagado
                          </button>
                        </div>
                      )}

                    {/* Delete option for the owner */}
                    {expense.paid_by === myUserId && (
                      <div className="p-4 border-t border-border/40">
                        <button
                          onClick={() => deleteSharedExpense(expense.id)}
                          className="w-full py-3 bg-destructive/10 hover:bg-destructive/20 text-destructive font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                        >
                          <Trash2 className="w-5 h-5" />
                          Eliminar gasto
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

      <BottomNav />
    </div>
  );
}
