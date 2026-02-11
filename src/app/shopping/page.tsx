"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  ShoppingCart,
  Loader2,
} from "lucide-react";

type ShoppingItem = {
  id: string;
  name: string;
  is_checked: boolean;
  added_by: string;
};

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadItems();

    // Realtime subscription
    const channel = supabase
      .channel("shopping_list_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_items",
        },
        (payload) => {
          loadItems(); // Refresh on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadItems() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("house_members")
      .select("house_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership?.house_id) {
        setIsLoading(false);
        return;
    }

    const { data, error } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("house_id", membership.house_id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setItems(data);
    }
    setIsLoading(false);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;

    setIsAdding(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("house_members")
      .select("house_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membership?.house_id) {
      await supabase.from("shopping_items").insert({
        house_id: membership.house_id,
        name: newItem.trim(),
        added_by: user.id,
      });
      setNewItem("");
      loadItems();
    }
    setIsAdding(false);
  }

  async function toggleCheck(id: string, currentStatus: boolean) {
    // Optimistic update
    setItems(items.map(i => i.id === id ? { ...i, is_checked: !currentStatus } : i));

    await supabase
      .from("shopping_items")
      .update({ is_checked: !currentStatus })
      .eq("id", id);
      
    loadItems();
  }

  async function deleteItem(id: string) {
    // Optimistic update
    setItems(items.filter(i => i.id !== id));

    await supabase.from("shopping_items").delete().eq("id", id);
    loadItems();
  }

  const pendingItems = items.filter((i) => !i.is_checked);
  const checkedItems = items.filter((i) => i.is_checked);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 pb-24">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-purple-600" />
            Lista de Compras
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Add Item Form */}
        <form onSubmit={addItem} className="relative">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="¿Qué falta comprar? (ej: Leche 1L)"
            className="w-full pl-5 pr-14 py-4 rounded-2xl border-none shadow-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-lg"
          />
          <button
            type="submit"
            disabled={!newItem.trim() || isAdding}
            className="absolute right-2 top-2 bottom-2 aspect-square bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors"
          >
            {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
          </button>
        </form>

        {/* Loading */}
        {isLoading && (
            <div className="text-center py-10">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
            </div>
        )}

        {/* Empty State */}
        {!isLoading && items.length === 0 && (
            <div className="text-center py-12 opacity-50">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 text-lg">Tu lista está vacía</p>
                <p className="text-sm text-gray-400">Agrega cosas para que no se olviden</p>
            </div>
        )}

        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white px-1">Pendientes ({pendingItems.length})</h2>
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 group"
              >
                <button
                  onClick={() => toggleCheck(item.id, item.is_checked)}
                  className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 transition-colors flex items-center justify-center shrink-0"
                >
                  {/* Unchecked circle */}
                </button>
                <span className="flex-1 text-lg text-gray-900 dark:text-white font-medium">{item.name}</span>
                <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Checked Items */}
        {checkedItems.length > 0 && (
          <div className="space-y-3 opacity-60">
            <h2 className="font-semibold text-gray-900 dark:text-white px-1 mt-8">Comprados</h2>
            {checkedItems.map((item) => (
              <div
                key={item.id}
                className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 flex items-center gap-4"
              >
                <button
                  onClick={() => toggleCheck(item.id, item.is_checked)}
                  className="w-6 h-6 rounded-full bg-green-500 border-2 border-green-500 flex items-center justify-center shrink-0"
                >
                  <Check className="w-4 h-4 text-white" />
                </button>
                <span className="flex-1 text-gray-500 dark:text-gray-400 line-through">{item.name}</span>
                 <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-2 text-gray-400 hover:text-red-500"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
