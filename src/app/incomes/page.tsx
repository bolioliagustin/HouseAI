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
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  X,
  DollarSign,
  Repeat,
} from "lucide-react";

type Income = {
  id: string;
  amount: number;
  description: string | null;
  month: string | null;
  is_recurring: boolean;
};

export default function IncomesPage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [isRecurring, setIsRecurring] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadIncomes();
  }, []);

  async function loadIncomes() {
    setIsLoading(true);
    const { data } = await supabase
      .from("incomes")
      .select("*")
      .order("month", { ascending: false });

    setIncomes(data || []);
    setIsLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("incomes").insert({
      user_id: user?.id,
      amount: parseFloat(amount),
      description: description || null,
      month: isRecurring ? null : `${month}-01`,
      is_recurring: isRecurring,
    });

    resetForm();
    loadIncomes();
  }

  async function handleDelete(id: string) {
    if (confirm("¿Eliminar este ingreso?")) {
      await supabase.from("incomes").delete().eq("id", id);
      loadIncomes();
    }
  }

  function resetForm() {
    setShowForm(false);
    setAmount("");
    setDescription("");
    setMonth(new Date().toISOString().substring(0, 7));
    setIsRecurring(false);
  }

  const totalIncome = incomes.reduce((sum, inc) => sum + Number(inc.amount), 0);

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  };

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
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Ingresos</h1>
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
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-xl text-white">
          <p className="text-green-100 text-sm font-medium mb-1">Total ingresos</p>
          <p className="text-4xl font-bold">
            ${totalIncome.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-2xl w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Nuevo ingreso
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

                  {/* Recurring Toggle */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Repeat className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Ingreso mensual</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Se repite cada mes</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRecurring(!isRecurring)}
                      className={`w-12 h-7 rounded-full transition-colors ${
                        isRecurring ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          isRecurring ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Month - only show if not recurring */}
                  {!isRecurring && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Mes
                      </label>
                      <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Descripción (opcional)
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ej: Sueldo, Freelance..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Agregar ingreso
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Incomes List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Cargando...</div>
          ) : incomes.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center">
              <DollarSign className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No tienes ingresos cargados</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                Agregar primer ingreso
              </button>
            </div>
          ) : (
            incomes.map((income) => (
              <div
                key={income.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  income.is_recurring 
                    ? "bg-purple-100 dark:bg-purple-900/30" 
                    : "bg-green-100 dark:bg-green-900/30"
                }`}>
                  {income.is_recurring ? (
                    <Repeat className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {income.description || "Ingreso"}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    {income.is_recurring ? (
                      <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded text-xs font-medium">
                        Mensual
                      </span>
                    ) : (
                      income.month && formatMonth(income.month)
                    )}
                  </p>
                </div>
                <p className="font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
                  +${Number(income.amount).toLocaleString("es-AR")}
                </p>
                <button
                  onClick={() => handleDelete(income.id)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ))
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
          <Link href="/reports" className="flex flex-col items-center gap-1 text-gray-400">
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs">Reportes</span>
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
