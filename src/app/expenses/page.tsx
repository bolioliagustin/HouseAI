"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Home,
  Receipt,
  TrendingUp,
  Scan,
  Settings,
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  Save,
  X,
} from "lucide-react";

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
  const [isShared, setIsShared] = useState(false);

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

    const expenseData = {
      amount: parseFloat(amount),
      category,
      description: description || null,
      is_shared: isShared,
    };

    if (editingId) {
      await supabase.from("fixed_expenses").update(expenseData).eq("id", editingId);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("fixed_expenses").insert({ ...expenseData, user_id: user?.id });

      // Notify house members if shared expense
      if (isShared) {
        const catInfo = CATEGORIES.find((c) => c.value === category);
        console.log("Enviando notificación a la casa...");
        fetch("/api/push/notify-house", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "💸 Nuevo gasto compartido",
            body: `${catInfo?.icon || "📦"} ${description || category} — $${Math.ceil(parseFloat(amount))}`,
          }),
        })
        .then(res => res.json())
        .then(data => console.log("Resultado notificación:", data))
        .catch(err => console.error("Error enviando notificación:", err));
      }
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
    setIsShared(expense.is_shared);
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setAmount("");
    setCategory("otros");
    setDescription("");
    setIsShared(false);
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const getCategoryInfo = (cat: string) => CATEGORIES.find((c) => c.value === cat) || CATEGORIES[10];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 pb-24">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Gastos Fijos</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="p-2 bg-green-500 hover:bg-green-600 rounded-xl text-white transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Summary Card */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 shadow-xl text-white">
          <p className="text-blue-100 text-sm font-medium mb-1">Total gastos fijos mensuales</p>
          <p className="text-4xl font-bold">
            ${totalExpenses.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingId ? "Editar gasto" : "Nuevo gasto fijo"}
                  </h2>
                  <button
                    onClick={resetForm}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Categoría
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Descripción (opcional)
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ej: Alquiler departamento"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                  </div>

                  {/* Is Shared */}
                  <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isShared}
                      onChange={(e) => setIsShared(e.target.checked)}
                      className="w-5 h-5 text-green-500 rounded focus:ring-green-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Gasto compartido</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Se dividirá con tu compañero
                      </p>
                    </div>
                  </label>

                  {/* Submit */}
                  <button
                    type="submit"
                    className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {editingId ? "Guardar cambios" : "Agregar gasto"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Expenses List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Cargando...</div>
          ) : expenses.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center">
              <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No tienes gastos fijos cargados</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                Agregar primer gasto
              </button>
            </div>
          ) : (
            expenses.map((expense) => {
              const catInfo = getCategoryInfo(expense.category);
              return (
                <div
                  key={expense.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-2xl">
                    {catInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {expense.description || catInfo.label}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {catInfo.label}
                      </span>
                      {expense.is_shared && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                          Compartido
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="font-bold text-gray-900 dark:text-white whitespace-nowrap">
                    ${Number(expense.amount).toLocaleString("es-AR")}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(expense)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-around">
          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <Home className="w-6 h-6" />
            <span className="text-xs">Inicio</span>
          </Link>
          <Link
            href="/expenses"
            className="flex flex-col items-center gap-1 text-green-600 dark:text-green-400"
          >
            <Receipt className="w-6 h-6" />
            <span className="text-xs font-medium">Gastos</span>
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
