"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Home as HomeIcon,
  Receipt,
  TrendingUp,
  Scan,
  Settings,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  X,
  Edit2,
  Users,
  User,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { NOTIFICATION_TEMPLATES, sendNotification } from "@/lib/notifications";

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

  // Form state
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("otros");
  const [description, setDescription] = useState("");
  const [expenseType, setExpenseType] = useState<"personal" | "house" | "split">("personal");

  const supabase = createClient();

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    setIsLoading(true);
    const { data } = await supabase
      .from("fixed_expenses")
      .select("*")
      .order("created_at", { ascending: false });

    setExpenses(data || []);
    setIsLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const expenseData = {
      amount: parseFloat(amount),
      category,
      description: description || null,
      is_shared: false,
    };

    if (editingId) {
      await supabase.from("fixed_expenses").update(expenseData).eq("id", editingId);
    } else {
      await supabase.from("fixed_expenses").insert({ ...expenseData, user_id: user.id });
    }

    resetForm();
    loadExpenses();
  }

  async function handleDelete(id: string) {
    if (confirm("¿Eliminar este gasto?")) {
      await supabase.from("fixed_expenses").delete().eq("id", id);
      loadExpenses();
    }
  }

  function handleEdit(expense: FixedExpense) {
    setEditingId(expense.id);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDescription(expense.description || "");
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setAmount("");
    setCategory("otros");
    setDescription("");
    setExpenseType("personal");
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const getCategoryInfo = (cat: string) => CATEGORIES.find((c) => c.value === cat) || CATEGORIES[10];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-background/90 backdrop-blur-lg border-b border-border/40 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Suscripciones y Gastos Fijos</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="p-2 bg-primary hover:bg-primary/90 rounded-xl text-primary-foreground transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Card */}
        <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border/40">
          <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">Total gastos fijos mensuales</p>
          <p className="text-[2.5rem] leading-none font-bold text-primary">
            ${totalExpenses.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-card rounded-t-[32px] sm:rounded-[24px] w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl border border-border/10">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-foreground">
                    {editingId ? "Editar gasto" : "Nuevo gasto fijo"}
                  </h2>
                  <button
                    onClick={resetForm}
                    className="p-2 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Monto
                    </label>
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
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Categoría
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
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
                      placeholder="Ej: Alquiler departamento"
                      className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground"
                    />
                  </div>

                  {/* Submit */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-[16px] shadow-sm transition-all flex items-center justify-center gap-2"
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
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 px-1 mt-6">Tus gastos</p>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : expenses.length === 0 ? (
            <div className="bg-card border border-border/40 rounded-2xl p-8 text-center shadow-sm">
              <Receipt className="w-12 h-12 text-muted mx-auto mb-3" />
              <p className="text-muted-foreground">No tienes gastos fijos cargados</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-[16px] font-semibold transition-colors"
              >
                Agregar mi primer gasto
              </button>
            </div>
          ) : (
            expenses.map((expense) => {
              const catInfo = getCategoryInfo(expense.category);
              return (
                <div
                  key={expense.id}
                  className="bg-card rounded-2xl p-4 shadow-sm border border-border/40 flex items-center gap-4 transition-all hover:shadow-md"
                >
                  <div className="w-12 h-12 bg-muted/60 rounded-xl flex items-center justify-center text-2xl shadow-inner">
                    {catInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {expense.description || catInfo.label}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {catInfo.label}
                      </span>
                      {expense.is_shared && (
                        <span className="text-[10px] uppercase tracking-wider font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">
                          Compartido
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="font-bold text-foreground whitespace-nowrap text-lg">
                    ${Number(expense.amount).toLocaleString("es-AR")}
                  </p>
                  <div className="flex flex-col gap-1 md:flex-row ml-2">
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
