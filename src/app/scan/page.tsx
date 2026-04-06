"use client";
export const dynamic = "force-dynamic";

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
  Plus,
  FileText,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { NOTIFICATION_TEMPLATES, sendNotification } from "@/lib/notifications";

type ReceiptItem = {
  name: string;
  normalized_name?: string;
  quantity: number;
  unit_price: number;
  total: number;
  category: string;
  price_alert?: "high" | "low" | null;
  historical_avg?: number;
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
  const [mode, setMode] = useState<"choose" | "scan" | "manual">("choose");
  // "personal" = solo mío, "house" = de la casa sin dividir, "split" = dividido
  const [expenseType, setExpenseType] = useState<"personal" | "house" | "split">("personal");
  // Manual entry state
  const [manualStore, setManualStore] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualItem, setManualItem] = useState({ name: "", quantity: "1", unit_price: "", category: "Supermercado" });

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

      // Check for price anomalies
      const itemsWithAlerts = await checkPriceAnomalies(data.items);
      setResult({ ...data, items: itemsWithAlerts });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }

  async function checkPriceAnomalies(items: ReceiptItem[]): Promise<ReceiptItem[]> {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return items;

      // Get house context
      const { data: membership } = await supabase
        .from("house_members")
        .select("house_id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (!membership?.house_id) return items;

      const newItems = await Promise.all(items.map(async (item) => {
          if (!item.normalized_name) return item;

          // Fetch last 5 prices for this product in this house
          const { data: history } = await supabase
            .from("receipt_items")
            .select("unit_price, shared_expenses!inner(house_id)")
             // @ts-ignore
            .eq("normalized_name", item.normalized_name)
            .eq("shared_expenses.house_id", membership.house_id)
            .order("created_at", { ascending: false })
            .limit(5);

            if (history && history.length > 0) {
                const prices = history.map(h => Number(h.unit_price));
                const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
                
                // If price diff is > 15%
                if (item.unit_price > avgPrice * 1.15) {
                    return { ...item, price_alert: "high" as const, historical_avg: avgPrice };
                } else if (item.unit_price < avgPrice * 0.85) {
                    return { ...item, price_alert: "low" as const, historical_avg: avgPrice };
                }
            }
            return item;
      }));

      return newItems;
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
        await sendNotification(
            NOTIFICATION_TEMPLATES.NEW_SCAN(
                result.total,
                result.store || "Compra"
            )
        );
      }

      // ---------------------------------------------------------
      // SHOPPING LIST CLOSED LOOP
      // ---------------------------------------------------------
      try {
        if (membership?.house_id) {
          // 1. Get pending shopping items
          const { data: shoppingItems } = await supabase
            .from("shopping_items")
            .select("id, name")
            .eq("house_id", membership.house_id)
            .eq("is_checked", false);

          if (shoppingItems && shoppingItems.length > 0) {
             // 2. Simple Client-side Fuzzy Match
             // We normalize strings to lowercase and remove accents/special chars
             const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
             
             const scannedNames = result.items.map(i => normalize(i.name));
             const matchedIds: string[] = [];

             shoppingItems.forEach(item => {
                 const itemNorm = normalize(item.name);
                 // Check if any scanned item contains the shopping list item name (or vice versa)
                 // e.g. List: "Leche" -> Ticket: "Leche Conaprole" (Match)
                 const isMatch = scannedNames.some(scanned => scanned.includes(itemNorm) || itemNorm.includes(scanned));
                 if (isMatch) {
                     matchedIds.push(item.id);
                 }
             });

             // 3. Update DB
             if (matchedIds.length > 0) {
                 await supabase
                    .from("shopping_items")
                    .update({ is_checked: true })
                    .in("id", matchedIds);
                 
                 // Notify current user
                 alert(`¡Magia! ✨ Se marcaron ${matchedIds.length} items de la lista de compras.`);
             }
          }
        }
      } catch (err) {
          console.error("Error checking shopping list:", err);
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
    setMode("choose");
    setManualStore("");
    setManualDate(new Date().toISOString().split("T")[0]);
    setManualItem({ name: "", quantity: "1", unit_price: "", category: "Supermercado" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function startManualMode() {
    setMode("manual");
    setResult({
      store: null,
      date: new Date().toISOString().split("T")[0],
      items: [],
      subtotal: null,
      total: 0,
    });
  }

  function addManualItem(e: React.FormEvent) {
    e.preventDefault();
    if (!manualItem.name.trim() || !manualItem.unit_price) return;
    if (!result) return;

    const qty = parseFloat(manualItem.quantity) || 1;
    const price = parseFloat(manualItem.unit_price) || 0;

    const newItem: ReceiptItem = {
      name: manualItem.name.trim(),
      quantity: qty,
      unit_price: price,
      total: qty * price,
      category: manualItem.category,
    };

    const newItems = [...result.items, newItem];
    const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);

    setResult({
      ...result,
      store: manualStore || null,
      date: manualDate,
      items: newItems,
      total: newTotal,
    });

    setManualItem({ name: "", quantity: "1", unit_price: "", category: manualItem.category });
  }

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
            {mode === "manual" ? "Cargar Gasto Manual" : "Escanear Ticket"}
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Choose Mode */}
        {mode === "choose" && !result && !isLoading && (
          <div className="space-y-4">
            {/* Scan Option */}
            <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border/40 transition-all hover:shadow-md">
              <div className="text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <Camera className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Escanear Ticket
                </h2>
                <p className="text-muted-foreground mb-6">
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

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-[16px] shadow-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all"
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
                    className="px-6 py-3 bg-card border border-border/50 text-foreground font-medium rounded-[16px] flex items-center justify-center gap-2 hover:bg-muted transition-all"
                  >
                    <Upload className="w-5 h-5" />
                    Subir imagen
                  </button>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 py-2">
              <hr className="flex-1 border-border/50" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">o</span>
              <hr className="flex-1 border-border/50" />
            </div>

            {/* Manual Option */}
            <button
              onClick={startManualMode}
              className="w-full bg-card rounded-[24px] p-6 shadow-sm border border-border/40 hover:border-border transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-secondary/10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                  <FileText className="w-7 h-7 text-secondary" />
                </div>
                <div className="text-left py-1">
                  <h3 className="font-bold text-foreground">Cargar manualmente</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Agregá los items uno a uno, sin necesidad de ticket</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Manual Entry Form */}
        {mode === "manual" && result && !saved && (
          <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border/40 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Tienda</label>
                <input
                  type="text"
                  value={manualStore}
                  onChange={(e) => setManualStore(e.target.value)}
                  placeholder="Ej: Carrefour"
                  className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Fecha</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
                />
              </div>
            </div>

            <hr className="border-border/50 my-4" />

            <form onSubmit={addManualItem} className="space-y-4">
              <p className="font-semibold text-foreground">Agregar item</p>
              <input
                type="text"
                value={manualItem.name}
                onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                placeholder="Nombre del producto"
                className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground"
              />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Cant.</label>
                  <input
                    type="number"
                    step="any"
                    value={manualItem.quantity}
                    onChange={(e) => setManualItem({ ...manualItem, quantity: e.target.value })}
                    className="w-full px-3 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Precio unit.</label>
                  <input
                    type="number"
                    step="any"
                    value={manualItem.unit_price}
                    onChange={(e) => setManualItem({ ...manualItem, unit_price: e.target.value })}
                    placeholder="$"
                    className="w-full px-3 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoría</label>
                  <select
                    value={manualItem.category}
                    onChange={(e) => setManualItem({ ...manualItem, category: e.target.value })}
                    className="w-full px-3 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!manualItem.name.trim() || !manualItem.unit_price}
                  className="w-full py-3 bg-secondary hover:bg-secondary/90 disabled:opacity-40 text-secondary-foreground font-semibold rounded-[16px] flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  Agregar item
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-card rounded-[24px] p-8 shadow-sm border border-border/40 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-lg font-bold text-foreground">
              Analizando ticket...
            </p>
            <p className="text-muted-foreground mt-1">
              Esto puede tardar unos segundos
            </p>
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-48 mx-auto mt-6 rounded-xl opacity-50 border border-border"
              />
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 rounded-[24px] p-6 border border-destructive/20 text-center">
            <p className="text-destructive font-semibold">{error}</p>
            <button
              onClick={resetScan}
              className="mt-6 px-6 py-2.5 bg-destructive text-destructive-foreground font-semibold rounded-xl shadow-sm hover:bg-destructive/90 transition-all"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Results */}
        {result && !isLoading && (
          <>
            {/* Summary Card */}
            <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border/40 relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">
                    {result.store || (mode === "manual" ? "Gasto manual" : "Ticket escaneado")}
                  </p>
                  <p className="text-[2.5rem] leading-none font-bold text-primary">
                    ${result.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {result.date && (
                  <span className="bg-muted px-3 py-1.5 rounded-full text-xs font-semibold text-muted-foreground">
                    {result.date}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm font-medium mt-4">
                {result.items.length} {mode === "manual" ? "productos cargados" : "productos detectados"}
              </p>
            </div>

            {/* Items List */}
            <div className="bg-card rounded-[24px] shadow-sm border border-border/40 overflow-hidden">
              <div className="p-5 border-b border-border/40 bg-muted/10">
                <h3 className="font-bold text-foreground">
                  Productos detectados
                </h3>
              </div>
              <div className="divide-y divide-border/40">
                {result.items.map((item, index) => (
                  <div key={index} className="p-4 bg-card hover:bg-muted/10 transition-colors">
                    {editingIndex === index ? (
                      <div className="space-y-4">
                        <input
                          type="text"
                          defaultValue={item.name}
                          onBlur={(e) => updateItem(index, { name: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                          placeholder="Nombre del producto"
                        />
                        <div className="flex gap-3">
                          <input
                            type="number"
                            defaultValue={item.quantity}
                            onBlur={(e) =>
                              updateItem(index, { quantity: parseFloat(e.target.value) || 1 })
                            }
                            className="w-24 px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                            placeholder="Cant"
                          />
                          <input
                            type="number"
                            defaultValue={item.unit_price}
                            onBlur={(e) =>
                              updateItem(index, { unit_price: parseFloat(e.target.value) || 0 })
                            }
                            className="flex-1 px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                            placeholder="Precio"
                          />
                        </div>
                        <select
                          defaultValue={item.category}
                          onChange={(e) => updateItem(index, { category: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setEditingIndex(null)}
                          className="w-full py-3 bg-secondary text-secondary-foreground font-semibold rounded-[16px] shadow-sm hover:bg-secondary/90 transition-all text-sm"
                        >
                          Listo
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-medium text-muted-foreground">{item.quantity}x</span>
                            <span className="text-sm font-medium text-muted-foreground">
                              ${item.unit_price.toLocaleString("es-AR")}
                            </span>
                            <span className="bg-muted px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {item.category}
                            </span>
                          </div>
                          {item.price_alert && (
                              <div className={`text-xs flex items-center font-semibold gap-1 mt-1.5 ${item.price_alert === "high" ? "text-destructive" : "text-primary"}`}>
                                  {item.price_alert === "high" ? "📈" : "📉"} 
                                  {item.price_alert === "high" ? "Subió " : "Bajó "}
                                  {Math.round(((item.unit_price - (item.historical_avg || 0)) / (item.historical_avg || 1)) * 100)}%
                                  <span className="text-muted-foreground font-medium ml-1">(Promedio: ${Math.round(item.historical_avg || 0)})</span>
                              </div>
                          )}
                        </div>
                        <p className="font-bold text-foreground text-lg whitespace-nowrap">
                          ${item.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => setEditingIndex(index)}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </button>
                          <button
                            onClick={() => removeItem(index)}
                            className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Expense Type Selector */}
            <div className="space-y-3 pt-2">
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground px-1">Clasificación</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setExpenseType("personal")}
                  className={`p-4 rounded-[20px] border-2 text-center transition-all ${
                    expenseType === "personal"
                      ? "border-primary bg-primary/5"
                      : "border-border/40 bg-card hover:bg-muted/50"
                  }`}
                >
                  <User className={`w-6 h-6 mx-auto mb-2 ${
                    expenseType === "personal" ? "text-primary" : "text-muted-foreground"
                  }`} />
                  <p className={`text-xs font-bold ${
                    expenseType === "personal" ? "text-foreground" : "text-muted-foreground"
                  }`}>Personal</p>
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseType("house")}
                  className={`p-4 rounded-[20px] border-2 text-center transition-all ${
                    expenseType === "house"
                      ? "border-secondary bg-secondary/5"
                      : "border-border/40 bg-card hover:bg-muted/50"
                  }`}
                >
                  <Home className={`w-6 h-6 mx-auto mb-2 ${
                    expenseType === "house" ? "text-secondary" : "text-muted-foreground"
                  }`} />
                  <p className={`text-xs font-bold ${
                    expenseType === "house" ? "text-foreground" : "text-muted-foreground"
                  }`}>De la casa</p>
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseType("split")}
                  className={`p-4 rounded-[20px] border-2 text-center transition-all ${
                    expenseType === "split"
                      ? "border-accent bg-accent/5"
                      : "border-border/40 bg-card hover:bg-muted/50"
                  }`}
                >
                  <Users className={`w-6 h-6 mx-auto mb-2 ${
                    expenseType === "split" ? "text-accent" : "text-muted-foreground"
                  }`} />
                  <p className={`text-xs font-bold ${
                    expenseType === "split" ? "text-foreground" : "text-muted-foreground"
                  }`}>Dividido</p>
                </button>
              </div>
              <p className="text-xs text-muted-foreground px-1">
                {expenseType === "personal" && "Solo aparece en tus gastos."}
                {expenseType === "house" && "Gasto de la casa, para todos pero sin dividir."}
                {expenseType === "split" && "El gasto se dividirá en partes iguales."}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={resetScan}
                className="flex-1 py-3.5 bg-card border border-border/50 text-foreground font-semibold rounded-[16px] flex items-center justify-center gap-2 hover:bg-muted transition-all"
              >
                <X className="w-5 h-5" />
                Cancelar
              </button>
              {saved ? (
                <div className="flex-1 py-3.5 bg-primary text-primary-foreground font-semibold rounded-[16px] flex items-center justify-center gap-2 shadow-sm">
                  <Check className="w-5 h-5" />
                  ¡Guardado!
                </div>
              ) : (
                <button
                  onClick={saveToDatabase}
                  disabled={isSaving || result.items.length === 0}
                  className="flex-1 py-3.5 bg-primary text-primary-foreground font-semibold rounded-[16px] shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary/90 transition-all"
                >
                  {isSaving ? (
                     <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Guardar
                </button>
              )}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
