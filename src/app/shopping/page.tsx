"use client";
export const dynamic = "force-dynamic";

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
import { BottomNav } from "@/components/BottomNav";

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
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
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
            placeholder="¿Qué falta comprar?"
            className="w-full pl-5 pr-14 py-4 rounded-[24px] border border-border/40 shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-card text-foreground placeholder-muted-foreground outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!newItem.trim() || isAdding}
            className="absolute right-2 top-2 bottom-2 aspect-square bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-[20px] flex items-center justify-center transition-colors shadow-sm"
          >
            {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
          </button>
        </form>

        {/* Loading */}
        {isLoading && (
            <div className="text-center py-10">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            </div>
        )}

        {/* Empty State */}
        {!isLoading && items.length === 0 && (
            <div className="bg-card border border-border/40 rounded-2xl p-12 text-center shadow-sm">
                <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-foreground font-semibold text-lg mb-1">Tu lista está vacía</p>
                <p className="text-sm font-medium text-muted-foreground">Agregá cosas para que no se te olviden</p>
            </div>
        )}

        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 px-1 mt-2">Pendientes ({pendingItems.length})</h2>
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="bg-card rounded-[20px] p-4 shadow-sm border border-border/40 flex items-center gap-4 group hover:shadow-md transition-all"
              >
                <button
                  onClick={() => toggleCheck(item.id, item.is_checked)}
                  className="w-6 h-6 rounded-full border-2 border-border/80 hover:border-primary transition-colors flex items-center justify-center shrink-0"
                >
                  {/* Unchecked circle */}
                </button>
                <span className="flex-1 text-base text-foreground font-semibold">{item.name}</span>
                <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Checked Items */}
        {checkedItems.length > 0 && (
          <div className="space-y-3 opacity-70">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 px-1 mt-6">Comprados</h2>
            {checkedItems.map((item) => (
              <div
                key={item.id}
                className="bg-muted/10 rounded-[20px] p-4 flex items-center gap-4 border border-transparent group transition-colors hover:border-border/40"
              >
                <button
                  onClick={() => toggleCheck(item.id, item.is_checked)}
                  className="w-6 h-6 rounded-full bg-secondary border-2 border-secondary flex items-center justify-center shrink-0"
                >
                  <Check className="w-4 h-4 text-secondary-foreground" />
                </button>
                <span className="flex-1 text-muted-foreground font-medium line-through">{item.name}</span>
                 <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
