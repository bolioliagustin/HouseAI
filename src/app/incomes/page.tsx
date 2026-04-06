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
import { BottomNav } from "@/components/BottomNav";

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
            <h1 className="text-xl font-bold tracking-tight text-foreground">Ingresos</h1>
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
          <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">Total ingresos</p>
          <p className="text-[2.5rem] leading-none font-bold text-primary">
            ${totalIncome.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-card rounded-t-[32px] sm:rounded-[24px] w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl border border-border/10">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-foreground">
                    Nuevo ingreso
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

                  {/* Recurring Toggle */}
                  <div className="flex items-center justify-between p-4 border border-border/50 bg-muted/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Repeat className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Ingreso mensual</p>
                        <p className="text-xs text-muted-foreground">Se repite cada mes</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRecurring(!isRecurring)}
                      className={`w-12 h-7 rounded-full transition-colors ${
                        isRecurring ? "bg-primary" : "bg-muted-foreground/30"
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
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Mes
                      </label>
                      <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Descripción (opcional)
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ej: Sueldo, Freelance..."
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
                      Agregar ingreso
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Incomes List */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 px-1 mt-6">Tus ingresos</p>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : incomes.length === 0 ? (
            <div className="bg-card border border-border/40 rounded-2xl p-8 text-center shadow-sm">
              <DollarSign className="w-12 h-12 text-muted mx-auto mb-3" />
              <p className="text-muted-foreground">No tienes ingresos cargados</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-[16px] font-semibold transition-colors"
              >
                Agregar mi primer ingreso
              </button>
            </div>
          ) : (
            incomes.map((income) => (
              <div
                key={income.id}
                className="bg-card rounded-2xl p-4 shadow-sm border border-border/40 flex items-center gap-4 transition-all hover:shadow-md"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${
                  income.is_recurring 
                    ? "bg-secondary/10" 
                    : "bg-primary/10"
                }`}>
                  {income.is_recurring ? (
                    <Repeat className="w-6 h-6 text-secondary" />
                  ) : (
                    <DollarSign className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {income.description || "Ingreso"}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    {income.is_recurring ? (
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">
                        Mensual
                      </span>
                    ) : (
                      income.month && formatMonth(income.month)
                    )}
                  </p>
                </div>
                <p className="font-bold text-primary whitespace-nowrap text-lg">
                  +${Number(income.amount).toLocaleString("es-AR")}
                </p>
                <div className="ml-2">
                  <button
                    onClick={() => handleDelete(income.id)}
                    className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
