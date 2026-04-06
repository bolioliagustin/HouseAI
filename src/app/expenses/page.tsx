"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Home as HomeIcon,
  Receipt,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  X,
  Edit2,
  User,
  Users,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

type FixedExpense = {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  is_shared: boolean;
};

const CATEGORIES = [
  { value: "alquiler", label: "🏠 Alquiler", icon: "🏠" },
  { value: "servicios", label: "💡 Servicios", icon: "💡" },
  { value: "internet", label: "📶 Internet/Teléfono", icon: "📶" },
  { value: "expensas", label: "🏢 Expensas/Consoricio", icon: "🏢" },
  { value: "supermercado", label: "🛒 Supermercado", icon: "🛒" },
  { value: "comida", label: "🍕 Comida/Delivery", icon: "🍕" },
  { value: "limpieza", label: "🧹 Limpieza", icon: "🧹" },
  { value: "muebles", label: "🛋️ Muebles/Hogar", icon: "🛋️" },
  { value: "entretenimiento", label: "🎮 Entretenimiento", icon: "🎮" },
  { value: "transporte", label: "🚗 Transporte", icon: "🚗" },
  { value: "salud", label: "💊 Salud", icon: "💊" },
  { value: "otros", label: "📦 Otros", icon: "📦" },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"personal" | "casa">("personal");
  const [memberCount, setMemberCount] = useState(1);
  const [inHouse, setInHouse] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("otros");
  const [description, setDescription] = useState("");

  const supabase = createClient();

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setIsLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setIsLoading(false); return; }

    const [expensesRes, membershipRes] = await Promise.all([
      supabase.from("fixed_expenses").select("*").order("created_at", { ascending: false }),
      supabase.from("house_members").select("house_id").eq("user_id", user.id).maybeSingle(),
    ]);

    setExpenses(expensesRes.data || []);

    if (membershipRes.data?.house_id) {
      setInHouse(true);
      const { count } = await supabase
        .from("house_members")
        .select("*", { count: "exact", head: true })
        .eq("house_id", membershipRes.data.house_id);
      setMemberCount(count || 1);
    }

    setIsLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const isShared = activeTab === "casa";
    const expenseData = {
      amount: parseFloat(amount),
      category,
      description: description || null,
      is_shared: isShared,
    };

    if (editingId) {
      await supabase.from("fixed_expenses").update(expenseData).eq("id", editingId);
    } else {
      await supabase.from("fixed_expenses").insert({ ...expenseData, user_id: user.id });
    }

    resetForm();
    loadAll();
  }

  async function handleDelete(id: string) {
    if (confirm("¿Eliminar este gasto?")) {
      await supabase.from("fixed_expenses").delete().eq("id", id);
      loadAll();
    }
  }

  function handleEdit(expense: FixedExpense) {
    setEditingId(expense.id);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDescription(expense.description || "");
    setActiveTab(expense.is_shared ? "casa" : "personal");
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setAmount("");
    setCategory("otros");
    setDescription("");
  }

  const getCategoryInfo = (cat: string) => CATEGORIES.find((c) => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

  const personalExpenses = expenses.filter((e) => !e.is_shared);
  const houseExpenses = expenses.filter((e) => e.is_shared);
  const displayedExpenses = activeTab === "personal" ? personalExpenses : houseExpenses;

  const totalPersonal = personalExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalHouse = houseExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const myHousePart = memberCount > 1 ? totalHouse / memberCount : totalHouse;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-background/90 backdrop-blur-lg border-b border-border/40 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Gastos Fijos</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="p-2 bg-primary hover:bg-primary/90 rounded-xl text-primary-foreground transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4 pb-3 flex gap-2">
          <button
            onClick={() => setActiveTab("personal")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
              activeTab === "personal"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <User className="w-4 h-4" />
            Personales
            {personalExpenses.length > 0 && (
              <span className={`text-xs ml-0.5 px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === "personal" ? "bg-primary-foreground/20" : "bg-muted"
              }`}>
                {personalExpenses.length}
              </span>
            )}
          </button>
          {inHouse && (
            <button
              onClick={() => setActiveTab("casa")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                activeTab === "casa"
                  ? "bg-secondary text-secondary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <HomeIcon className="w-4 h-4" />
              De la casa
              {houseExpenses.length > 0 && (
                <span className={`text-xs ml-0.5 px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === "casa" ? "bg-secondary-foreground/20" : "bg-muted"
                }`}>
                  {houseExpenses.length}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Card */}
        {activeTab === "personal" ? (
          <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border/40">
            <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">
              Total gastos personales mensuales
            </p>
            <p className="text-[2.5rem] leading-none font-bold text-primary">
              ${totalPersonal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-3 font-medium">
              Suscripciones, seguros y otros gastos solo tuyos
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border/40">
            <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">
              Gastos fijos de la casa
            </p>
            <p className="text-[2.5rem] leading-none font-bold text-secondary">
              ${totalHouse.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </p>
            {memberCount > 1 && (
              <div className="mt-4 pt-4 border-t border-border/40 flex justify-between items-center">
                <p className="text-xs text-muted-foreground font-medium">
                  Tu parte ({memberCount} personas)
                </p>
                <p className="text-base font-bold text-secondary">
                  ${myHousePart.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  <span className="text-xs font-medium text-muted-foreground">/mes</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-card rounded-t-[32px] sm:rounded-[24px] w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl border border-border/10">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {editingId ? "Editar gasto" : "Nuevo gasto fijo"}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activeTab === "personal"
                        ? "Solo para vos, mensualmente"
                        : `Se divide entre ${memberCount} personas de la casa`}
                    </p>
                  </div>
                  <button onClick={resetForm} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Tab switcher in form */}
                {inHouse && (
                  <div className="flex gap-2 mb-5 bg-muted/30 p-1 rounded-[14px]">
                    <button
                      type="button"
                      onClick={() => setActiveTab("personal")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-sm font-bold transition-all ${
                        activeTab === "personal"
                          ? "bg-card text-primary shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      <User className="w-4 h-4" /> Personal
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("casa")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-sm font-bold transition-all ${
                        activeTab === "casa"
                          ? "bg-card text-secondary shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      <Users className="w-4 h-4" /> De la casa
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Monto total</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground"
                    />
                    {/* Casa split preview */}
                    {activeTab === "casa" && amount && memberCount > 1 && (
                      <div className="mt-2 flex justify-between text-sm bg-secondary/5 border border-secondary/20 rounded-xl px-4 py-2.5">
                        <span className="text-muted-foreground font-medium">Tu parte</span>
                        <span className="font-bold text-secondary">
                          ${(parseFloat(amount) / memberCount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          /mes
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Categoría</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Descripción (opcional)
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={activeTab === "casa" ? "Ej: Alquiler departamento" : "Ej: Suscripción Netflix"}
                      className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground"
                    />
                  </div>

                  {/* Submit */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      className={`w-full py-3 px-4 font-semibold rounded-[16px] shadow-sm transition-all flex items-center justify-center gap-2 text-white ${
                        activeTab === "casa"
                          ? "bg-secondary hover:bg-secondary/90"
                          : "bg-primary hover:bg-primary/90"
                      }`}
                    >
                      <Save className="w-5 h-5" />
                      {editingId ? "Guardar cambios" : "Agregar gasto"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Expenses List */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 px-1 mt-2">
            {activeTab === "personal" ? "Tus gastos personales" : "Gastos fijos de la casa"}
          </p>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : displayedExpenses.length === 0 ? (
            <div className="bg-card border border-border/40 rounded-2xl p-8 text-center shadow-sm">
              {activeTab === "personal" ? (
                <Receipt className="w-12 h-12 text-muted mx-auto mb-3" />
              ) : (
                <HomeIcon className="w-12 h-12 text-muted mx-auto mb-3" />
              )}
              <p className="text-muted-foreground font-medium">
                {activeTab === "personal"
                  ? "No tenés gastos personales cargados"
                  : "No hay gastos fijos de la casa"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {activeTab === "personal"
                  ? "Agregá tus suscripciones, seguros, etc."
                  : "Agregá el alquiler, expensas, servicios compartidos…"}
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-[16px] font-semibold transition-colors"
              >
                Agregar gasto
              </button>
            </div>
          ) : (
            displayedExpenses.map((expense) => {
              const catInfo = getCategoryInfo(expense.category);
              const perPerson = expense.is_shared && memberCount > 1
                ? Number(expense.amount) / memberCount
                : null;
              return (
                <div
                  key={expense.id}
                  className="bg-card rounded-2xl p-4 shadow-sm border border-border/40 flex items-center gap-4 transition-all hover:shadow-md"
                >
                  <div className="w-12 h-12 bg-muted/60 rounded-xl flex items-center justify-center text-2xl shadow-inner shrink-0">
                    {catInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {expense.description || catInfo.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{catInfo.label}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground text-lg">
                      ${Number(expense.amount).toLocaleString("es-AR")}
                    </p>
                    {perPerson !== null && (
                      <p className="text-xs font-medium text-secondary">
                        ${perPerson.toLocaleString("es-AR", { minimumFractionDigits: 0 })}/persona
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 ml-1">
                    <button
                      onClick={() => handleEdit(expense)}
                      className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
