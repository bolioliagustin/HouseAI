"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Home,
  Receipt,
  TrendingUp,
  Scan,
  Settings,
  ArrowLeft,
  Camera,
  Upload,
  Loader2,
  Check,
  X,
  Edit2,
  Trash2,
  Save,
  Users,
  User,
} from "lucide-react";

type ReceiptItem = {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  category: string;
};

type OCRResult = {
  store: string | null;
  date: string | null;
  items: ReceiptItem[];
  subtotal: number | null;
  total: number;
};

const CATEGORIES = [
  "Supermercado",
  "Bebidas",
  "Limpieza",
  "Carnes",
  "Lácteos",
  "Panadería",
  "Frutas y Verduras",
  "Congelados",
  "Otros",
];

export default function ScanPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // "personal" = solo mío, "house" = de la casa sin dividir, "split" = dividido
  const [expenseType, setExpenseType] = useState<"personal" | "house" | "split">("personal");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Send to OCR
    await processImage(file);
  }

  async function processImage(file: File) {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Error al procesar la imagen");
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }

  function updateItem(index: number, updates: Partial<ReceiptItem>) {
    if (!result) return;

    const newItems = [...result.items];
    newItems[index] = { ...newItems[index], ...updates };

    // Recalculate total if unit_price or quantity changed
    if (updates.unit_price !== undefined || updates.quantity !== undefined) {
      newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
    }

    // Recalculate overall total
    const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);

    setResult({ ...result, items: newItems, total: newTotal });
    setEditingIndex(null);
  }

  function removeItem(index: number) {
    if (!result) return;

    const newItems = result.items.filter((_, i) => i !== index);
    const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);

    setResult({ ...result, items: newItems, total: newTotal });
  }

  async function saveToDatabase() {
    if (!result || result.items.length === 0) return;

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      // Get user's house
      const { data: membership } = await supabase
        .from("house_members")
        .select("house_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (expenseType !== "personal" && !membership?.house_id) {
        throw new Error("Debes crear o unirte a una casa para gastos de casa");
      }

      // Create expense record
      const { data: expense, error: expenseError } = await supabase
        .from("shared_expenses")
        .insert({
          house_id: expenseType !== "personal" ? membership?.house_id : null,
          paid_by: user.id,
          total_amount: result.total,
          category: "Supermercado",
          description: result.store || "Compra de supermercado",
          date: result.date || new Date().toISOString().split("T")[0],
          is_shared: expenseType !== "personal",
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Create receipt items
      const receiptItems = result.items.map((item) => ({
        expense_id: expense.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        category: item.category,
      }));

      const { error: itemsError } = await supabase
        .from("receipt_items")
        .insert(receiptItems);

      if (itemsError) throw itemsError;

      // Only create splits if "split" type
      if (expenseType === "split" && membership?.house_id) {
        const { data: members } = await supabase
          .from("house_members")
          .select("user_id")
          .eq("house_id", membership.house_id);

        if (members && members.length > 0) {
          const splitAmount = result.total / members.length;
          const splits = members.map((member) => ({
            expense_id: expense.id,
            user_id: member.user_id,
            amount: splitAmount,
            is_paid: member.user_id === user.id,
          }));

          if (splits.length > 0) {
            await supabase.from("expense_splits").insert(splits);
          }
        }
      }

      setSaved(true);

      // Notify house members if shared expense
      if (expenseType !== "personal") {
        fetch("/api/push/notify-house", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "🧾 Nuevo ticket escaneado",
            body: `${result.store || "Compra"} — $${Math.ceil(result.total)}`,
          }),
        }).catch(() => {});
      }

      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  }

  function resetScan() {
    setResult(null);
    setImagePreview(null);
    setError(null);
    setSaved(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Escanear Ticket</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Upload Section */}
        {!result && !isLoading && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="text-center">
              <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Camera className="w-10 h-10 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Sube tu ticket
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Tomá una foto o seleccioná una imagen del ticket de compra
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium rounded-xl shadow-lg flex items-center gap-2 hover:shadow-xl transition-all"
                >
                  <Camera className="w-5 h-5" />
                  Tomar foto
                </button>
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute("capture");
                      fileInputRef.current.click();
                      fileInputRef.current.setAttribute("capture", "environment");
                    }
                  }}
                  className="px-6 py-3 border-2 border-purple-500 text-purple-600 dark:text-purple-400 font-medium rounded-xl flex items-center gap-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                >
                  <Upload className="w-5 h-5" />
                  Subir imagen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-100 dark:border-gray-700 text-center">
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              Analizando ticket...
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              Esto puede tardar unos segundos
            </p>
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-48 mx-auto mt-4 rounded-lg opacity-50"
              />
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 border border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
            <button
              onClick={resetScan}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Results */}
        {result && !isLoading && (
          <>
            {/* Summary Card */}
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-6 shadow-xl text-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-purple-100 text-sm">
                    {result.store || "Ticket escaneado"}
                  </p>
                  <p className="text-3xl font-bold">
                    ${result.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {result.date && (
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                    {result.date}
                  </span>
                )}
              </div>
              <p className="text-purple-100 text-sm">
                {result.items.length} productos detectados
              </p>
            </div>

            {/* Items List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Productos detectados
                </h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {result.items.map((item, index) => (
                  <div key={index} className="p-4">
                    {editingIndex === index ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          defaultValue={item.name}
                          onBlur={(e) => updateItem(index, { name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                          placeholder="Nombre del producto"
                        />
                        <div className="flex gap-3">
                          <input
                            type="number"
                            defaultValue={item.quantity}
                            onBlur={(e) =>
                              updateItem(index, { quantity: parseFloat(e.target.value) || 1 })
                            }
                            className="w-20 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                            placeholder="Cant"
                          />
                          <input
                            type="number"
                            defaultValue={item.unit_price}
                            onBlur={(e) =>
                              updateItem(index, { unit_price: parseFloat(e.target.value) || 0 })
                            }
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                            placeholder="Precio"
                          />
                        </div>
                        <select
                          defaultValue={item.category}
                          onChange={(e) => updateItem(index, { category: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setEditingIndex(null)}
                          className="w-full py-2 bg-green-500 text-white rounded-lg font-medium"
                        >
                          Listo
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{item.quantity}x</span>
                            <span>
                              ${item.unit_price.toLocaleString("es-AR")}
                            </span>
                            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">
                              {item.category}
                            </span>
                          </div>
                        </div>
                        <p className="font-bold text-gray-900 dark:text-white whitespace-nowrap">
                          ${item.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingIndex(index)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => removeItem(index)}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Expense Type Selector */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">Tipo de gasto</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setExpenseType("personal")}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    expenseType === "personal"
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  }`}
                >
                  <User className={`w-5 h-5 mx-auto mb-1 ${
                    expenseType === "personal" ? "text-green-600" : "text-gray-400"
                  }`} />
                  <p className={`text-xs font-medium ${
                    expenseType === "personal" ? "text-green-700 dark:text-green-400" : "text-gray-500"
                  }`}>Personal</p>
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseType("house")}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    expenseType === "house"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  }`}
                >
                  <Home className={`w-5 h-5 mx-auto mb-1 ${
                    expenseType === "house" ? "text-blue-600" : "text-gray-400"
                  }`} />
                  <p className={`text-xs font-medium ${
                    expenseType === "house" ? "text-blue-700 dark:text-blue-400" : "text-gray-500"
                  }`}>De la casa</p>
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseType("split")}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    expenseType === "split"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  }`}
                >
                  <Users className={`w-5 h-5 mx-auto mb-1 ${
                    expenseType === "split" ? "text-purple-600" : "text-gray-400"
                  }`} />
                  <p className={`text-xs font-medium ${
                    expenseType === "split" ? "text-purple-700 dark:text-purple-400" : "text-gray-500"
                  }`}>Dividido</p>
                </button>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
                {expenseType === "personal" && "Solo aparece en tus gastos"}
                {expenseType === "house" && "Se trackea como gasto de la casa, sin dividir"}
                {expenseType === "split" && "Se divide entre los miembros de la casa"}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={resetScan}
                className="flex-1 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Cancelar
              </button>
              {saved ? (
                <div className="flex-1 py-3 bg-green-500 text-white font-medium rounded-xl flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" />
                  ¡Guardado!
                </div>
              ) : (
                <button
                  onClick={saveToDatabase}
                  disabled={isSaving || result.items.length === 0}
                  className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Guardar gasto
                </button>
              )}
            </div>
          </>
        )}
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
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
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
