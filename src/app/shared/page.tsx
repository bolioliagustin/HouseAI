"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Home as HomeIcon,
  Receipt,
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
  Scan,
  Search,
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
  const [memberSpending, setMemberSpending] = useState<
    { user_id: string; name: string; total: number; netDebt: number }[]
  >([]);
  const [memberCount, setMemberCount] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInstallment, setNewInstallment] = useState({
    description: "",
    category: "muebles",
    total_amount: "",
    installments: "3",
  });
  const [isSavingInstallment, setIsSavingInstallment] = useState(false);
  const [houseFixedExpenses, setHouseFixedExpenses] = useState<{id:string;amount:number;category:string;description:string|null;user_id:string}[]>([]);

  // Manual Shared Expense State
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [newManualExpense, setNewManualExpense] = useState({ description: "", amount: "", category: "hogar" });
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid">("all");

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

    // Parallel: members + shared_expenses + installments
    const [membersRes, sharedExpensesRes, installmentDataRes] = await Promise.all([
      supabase
        .from("house_members")
        .select("user_id, users(name, email)")
        .eq("house_id", membership.house_id),

      supabase
        .from("shared_expenses")
        .select(`*, users!paid_by(name, email), expense_splits(amount, is_paid, user_id), receipt_items(name, quantity, total, category)`)
        .eq("house_id", membership.house_id)
        .order("date", { ascending: false }),

      supabase
        .from("installment_expenses")
        .select("*")
        .eq("house_id", membership.house_id)
        .order("created_at", { ascending: false }),
    ]);

    const members = membersRes.data || [];
    const sharedExpenses = sharedExpensesRes.data;
    const installmentData = installmentDataRes.data;

    // Fetch fixed shared expenses for ALL house members (sequential, needs member IDs)
    const memberIds = members.map((m) => m.user_id);
    const { data: fixedSharedData } = memberIds.length > 0
      ? await supabase
          .from("fixed_expenses")
          .select("*")
          .in("user_id", memberIds)
          .eq("is_shared", true)
      : { data: [] };

    setHouseFixedExpenses(fixedSharedData || []);
    setMemberCount(members.length || 1);

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
      // Calculate per-member spending and net debt
      const spendingMap = new Map<string, { name: string; total: number; netDebt: number }>();

      members?.forEach((m) => {
        const userData = m.users as unknown as {
          name: string | null;
          email: string;
        };
        spendingMap.set(m.user_id, {
          name: userData?.name || userData?.email || "Miembro",
          total: 0,
          netDebt: 0,
        });
      });

      // Calculate per-member spending and net debt using splits
      sharedExpenses.forEach((exp) => {
        const splits = (exp.expense_splits as { amount: number; is_paid: boolean; user_id: string }[]) || [];

        if (splits.length > 0) {
          // Gasto dividido: cada miembro acumula su split al gasto total solo si fue pagado
          splits.forEach((split) => {
            if (split.is_paid) {
              const memberEntry = spendingMap.get(split.user_id);
              if (memberEntry) {
                spendingMap.set(split.user_id, {
                  ...memberEntry,
                  total: memberEntry.total + Number(split.amount),
                });
              }
            }
          });
        } else {
          // Gasto sin dividir: suma el total al que pagó
          const current = spendingMap.get(exp.paid_by);
          if (current) {
            spendingMap.set(exp.paid_by, {
              ...current,
              total: current.total + Number(exp.total_amount),
            });
          }
        }

        // Net Debt logic
        if (exp.is_shared && exp.paid_by) {
          const unpaidSplits = splits.filter((s) => !s.is_paid && s.user_id !== exp.paid_by);
          unpaidSplits.forEach((split) => {
            // debtor owes money (+)
            const debtor = spendingMap.get(split.user_id);
            if (debtor) {
              spendingMap.set(split.user_id, { ...debtor, netDebt: debtor.netDebt + split.amount });
            }
            // creditor is owed money (-)
            const creditor = spendingMap.get(exp.paid_by);
            if (creditor) {
              spendingMap.set(exp.paid_by, { ...creditor, netDebt: creditor.netDebt - split.amount });
            }
          });
        }
      });

      setMemberSpending(
        Array.from(spendingMap.entries()).map(([user_id, data]) => ({
          user_id,
          name: data.name,
          total: data.total,
          netDebt: data.netDebt,
        }))
      );

      // Extract current user's net debt to update 'balance' state
      const myMemberData = spendingMap.get(user.id);
      const myNetDebt = myMemberData ? myMemberData.netDebt : 0;
      
      let owe = 0;
      let owed = 0;
      if (myNetDebt > 0.01) owe = myNetDebt;
      if (myNetDebt < -0.01) owed = Math.abs(myNetDebt);

      setBalance({ owe, owed });

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

  async function saveManualExpense() {
    if (!newManualExpense.description || !newManualExpense.amount) return;
    setIsSavingManual(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      // Get house context
      const { data: membership } = await supabase
        .from("house_members")
        .select("house_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership?.house_id) throw new Error("No house");

      const amount = parseFloat(newManualExpense.amount);

      // 1. Create shared_expense
      const { data: expense, error: expError } = await supabase
        .from("shared_expenses")
        .insert({
          house_id: membership.house_id,
          paid_by: user.id,
          total_amount: amount,
          category: newManualExpense.category,
          description: newManualExpense.description,
          date: new Date().toISOString().split("T")[0],
          is_shared: true,
        })
        .select()
        .single();

      if (expError) throw expError;

      // 2. Create one receipt item
      await supabase.from("receipt_items").insert({
        expense_id: expense.id,
        name: newManualExpense.description,
        quantity: 1,
        unit_price: amount,
        total: amount,
        category: newManualExpense.category,
      });

      // 3. Create splits
      const { data: members } = await supabase
        .from("house_members")
        .select("user_id")
        .eq("house_id", membership.house_id);

      if (members && members.length > 0) {
        const splitAmount = amount / members.length;
        const splits = members.map((m) => ({
          expense_id: expense.id,
          user_id: m.user_id,
          amount: splitAmount,
          is_paid: m.user_id === user.id,
        }));
        await supabase.from("expense_splits").insert(splits);
      }

      setNewManualExpense({ description: "", amount: "", category: "hogar" });
      setShowAddManualModal(false);
      loadExpenses();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingManual(false);
    }
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

        {/* House Fixed Expenses Section — read only, managed from /expenses */}
        {(houseFixedExpenses.length > 0) && (
          <div className="bg-card rounded-[24px] shadow-sm border border-border/40 overflow-hidden transition-all hover:shadow-md">
            <div className="p-5 border-b border-border/40 flex items-center justify-between bg-muted/10">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 p-2 rounded-xl">
                  <HomeIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Gastos Fijos Mensuales</h3>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Alquiler, expensas, servicios…</p>
                </div>
              </div>
              <Link
                href="/expenses"
                className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
              >
                Gestionar
              </Link>
            </div>
            <div className="divide-y divide-border/40">
              {houseFixedExpenses.map((fe) => {
                const perPerson = memberCount > 1 ? Number(fe.amount) / memberCount : null;
                return (
                  <div key={fe.id} className="p-5 flex items-center gap-4 hover:bg-muted/5 transition-colors">
                    <div className="w-12 h-12 bg-primary/10 rounded-[16px] flex items-center justify-center shrink-0">
                      <HomeIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{fe.description || fe.category}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-0.5 uppercase tracking-wider">{fe.category}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-foreground">
                        ${Number(fe.amount).toLocaleString("es-AR")}
                      </p>
                      {perPerson !== null && (
                        <p className="text-xs font-medium text-primary">
                          ${perPerson.toLocaleString("es-AR", { minimumFractionDigits: 0 })}/persona
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                  <div key={member.user_id} className="mb-4 last:mb-0">
                    {/* Primary Spending Bar */}
                    <div className="flex justify-between items-center mb-1.5">
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
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden shadow-inner mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${
                          member.user_id === myUserId
                            ? "bg-secondary"
                            : "bg-primary"
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>

                    {/* Secondary Net Debt Bar */}
                    {Math.abs(member.netDebt) > 0.01 && (
                      <div className="pl-2 pr-1 border-l-2 border-border/40 mt-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {member.netDebt > 0 ? "Debe a la casa" : "A favor"}
                          </span>
                          <span className={`text-xs font-bold ${member.netDebt > 0 ? "text-destructive" : "text-emerald-500"}`}>
                            ${Math.abs(member.netDebt).toLocaleString("es-AR")}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-muted/40 rounded-full overflow-hidden shadow-inner">
                          <div
                            className={`h-full rounded-full transition-all ${
                              member.netDebt > 0 ? "bg-destructive" : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min((Math.abs(member.netDebt) / (totalHouseSpending || 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
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
            <p className="text-[10px] text-muted-foreground mt-4 text-center">
              (Las deudas entre miembros se calculan de forma neta)
            </p>
          </div>
        )}

        {/* Balance Cards - only if there are splits */}
        {(balance.owe > 0 || balance.owed > 0) && (
          <div className="flex justify-center">
            {balance.owe > 0 ? (
              <div className="bg-destructive/10 rounded-[24px] p-5 border border-transparent hover:border-destructive/20 transition-all text-center w-full sm:w-1/2">
                <p className="text-xs font-bold uppercase tracking-wider text-destructive mb-1">Debo a la casa</p>
                <p className="text-2xl font-bold text-destructive">
                  ${balance.owe.toLocaleString("es-AR")}
                </p>
              </div>
            ) : (
              <div className="bg-secondary/10 rounded-[24px] p-5 border border-transparent hover:border-secondary/20 transition-all text-center w-full sm:w-1/2">
                <p className="text-xs font-bold uppercase tracking-wider text-secondary mb-1">
                  La casa me debe
                </p>
                <p className="text-2xl font-bold text-secondary">
                  ${balance.owed.toLocaleString("es-AR")}
                </p>
              </div>
            )}
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
            <div className="flex flex-col gap-3 mb-4 px-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground">
                  Gastos recientes
                </h3>
                <button
                  onClick={() => setShowAddManualModal(true)}
                  className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1 hover:text-primary/80 transition-colors bg-primary/10 px-3 py-1.5 rounded-full shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  Agregar Gasto
                </button>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Buscar gastos..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-card border border-border/40 shadow-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground placeholder:-muted-foreground"
                  />
                </div>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-3 py-2 bg-card border border-border/40 shadow-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold text-muted-foreground"
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendientes</option>
                  <option value="paid">Pagados</option>
                </select>
              </div>
            </div>

            {expenses.filter(exp => {
                const matchesSearch = (exp.description || exp.category).toLowerCase().includes(searchTerm.toLowerCase());
                if (!matchesSearch) return false;
                if (filterStatus === "pending") return exp.is_split && !exp.is_paid;
                if (filterStatus === "paid") return exp.is_paid;
                return true;
            }).map((expense) => (
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
                      <HomeIcon className="w-6 h-6" />
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

      {/* Manual Add Expense Modal */}
      {showAddManualModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="bg-card rounded-t-[32px] sm:rounded-[24px] w-full max-w-md shadow-2xl border border-border/10 overflow-hidden transform transition-all animate-in slide-in-from-bottom flex flex-col max-h-[85vh]">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Agregar gasto</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Se dividirá equitativamente</p>
                </div>
                <button onClick={() => setShowAddManualModal(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Link to Scan for groceries */}
              <Link
                href="/scan"
                className="mb-6 flex flex-col justify-center items-center gap-2 p-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors"
                onClick={() => setShowAddManualModal(false)}
              >
                <Scan className="w-6 h-6 text-primary" />
                <div className="text-center">
                  <p className="text-sm font-bold text-primary">¿Tenés un ticket de súper?</p>
                  <p className="text-xs text-primary/80">Escanear ticket con IA (recomendado)</p>
                </div>
              </Link>

              <div className="flex items-center gap-4 mb-6">
                <div className="h-px bg-border flex-1"></div>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">o carga manual</span>
                <div className="h-px bg-border flex-1"></div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block ml-1">Descripción</label>
                  <input
                    type="text"
                    placeholder="Ej: Expensas, Factura internet..."
                    value={newManualExpense.description}
                    onChange={(e) => setNewManualExpense({ ...newManualExpense, description: e.target.value })}
                    className="w-full px-5 py-4 rounded-[16px] border border-border/40 bg-muted/20 shadow-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block ml-1">Monto total</label>
                    <input
                      type="number"
                      placeholder="$0.00"
                      value={newManualExpense.amount}
                      onChange={(e) => setNewManualExpense({ ...newManualExpense, amount: e.target.value })}
                      className="w-full px-5 py-4 rounded-[16px] border border-border/40 bg-muted/20 shadow-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block ml-1">Categoría</label>
                    <select
                      value={newManualExpense.category}
                      onChange={(e) => setNewManualExpense({ ...newManualExpense, category: e.target.value })}
                      className="w-full px-5 py-4 rounded-[16px] border border-border/40 bg-muted/20 shadow-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                    >
                      {["hogar","supermercado","servicios","streaming","otros"].map((cat) => (
                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {newManualExpense.amount && memberCount > 1 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex justify-between items-center mt-2">
                    <span className="text-xs font-medium text-muted-foreground">Tu parte ({memberCount} pers.)</span>
                    <span className="text-sm font-bold text-primary">
                      ${(parseFloat(newManualExpense.amount) / memberCount).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                
                <button
                  onClick={saveManualExpense}
                  disabled={isSavingManual || !newManualExpense.amount || !newManualExpense.description}
                  className="w-full py-4 mt-4 bg-foreground hover:bg-foreground/90 disabled:opacity-50 text-background font-bold rounded-[16px] transition-colors flex items-center justify-center gap-2"
                >
                  {isSavingManual ? "Guardando..." : "Agregar gasto compartido"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
