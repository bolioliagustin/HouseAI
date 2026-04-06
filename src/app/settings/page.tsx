"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import Link from "next/link";
import {
  Home,
  Receipt,
  TrendingUp,
  Scan,
  Settings,
  ArrowLeft,
  Copy,
  Check,
  LogOut,
  Plus,
  Users,
  Moon,
  Sun,
  Bell,
} from "lucide-react";
import { NOTIFICATION_TEMPLATES, sendNotification } from "@/lib/notifications";
import { BottomNav } from "@/components/BottomNav";

type House = {
  id: string;
  name: string;
  invite_code: string;
};

type HouseMember = {
  user_id: string;
  role: "owner" | "member";
  users: {
    name: string | null;
    email: string;
  };
  hasPush?: boolean;
};

export default function SettingsPage() {
  const [house, setHouse] = useState<House | null>(null);
  const [members, setMembers] = useState<HouseMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateHouse, setShowCreateHouse] = useState(false);
  const [showJoinHouse, setShowJoinHouse] = useState(false);
  const [houseName, setHouseName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const supabase = createClient();

  const {
      subscription,
      subscribeToPush,
      unsubscribeFromPush,
      permission,
      isLoading: isLoadingPush,
      error: pushError,
    } = usePushNotifications();
  
    async function handleTestPush() {
      if (!subscription) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        await fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Prueba MitAI 🏠",
            body: "¡Funciona! Las notificaciones están activas 🚀",
            userId: user.id
          }),
        });
        alert("¡Notificación enviada! Revisa tu barra de notificaciones.");
      } catch (e) {
        console.error(e);
        alert("Error al enviar notificación");
      }
    }

    async function handleTogglePush() {
      if (subscription) {
        await unsubscribeFromPush();
      } else {
        const result = await subscribeToPush();
        if (!result.success && result.error) {
          alert(result.error);
        }
      }
    }

  useEffect(() => {
    loadData();
    // Check system preference
    if (typeof window !== "undefined") {
      setIsDark(document.documentElement.classList.contains("dark"));
    }
  }, []);

  async function loadData() {
    setIsLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserEmail(user?.email || "");

    // Get user's house
    const { data: membership } = await supabase
      .from("house_members")
      .select("house_id, houses(*)")
      .eq("user_id", user?.id)
      .maybeSingle();

    if (membership?.houses) {
      const houseList = Array.isArray(membership.houses) ? membership.houses : [membership.houses];
      const houseData = houseList[0] as unknown as House;
      setHouse(houseData);

      // Get house members
      const { data: houseMembers } = await supabase
        .from("house_members")
        .select("user_id, role, users(name, email)")
        .eq("house_id", houseData.id);

      setMembers((houseMembers as unknown as HouseMember[]) || []);

      // Check which members have push enabled
      if (houseMembers && houseMembers.length > 0) {
        const memberIds = houseMembers.map((m) => m.user_id);
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("user_id")
          .in("user_id", memberIds);

        const subscribedSet = new Set(subs?.map((s) => s.user_id));
        
        setMembers((prev) =>
          prev.map((m) => ({
            ...m,
            hasPush: subscribedSet.has(m.user_id),
          }))
        );
      }
    }

    setIsLoading(false);
  }

  async function handleCreateHouse(e: React.FormEvent) {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Create the house and get its ID
    const { data: newHouse, error: houseError } = await supabase
      .from("houses")
      .insert({ name: houseName })
      .select()
      .single();

    if (houseError || !newHouse) {
      alert("Error al crear la casa: " + (houseError?.message || ""));
      return;
    }

    // Add the creator as owner
    const { error: memberError } = await supabase
      .from("house_members")
      .insert({
        house_id: newHouse.id,
        user_id: user.id,
        role: "owner",
      });

    if (memberError) {
      console.error("Error adding member:", memberError);
    }

    setShowCreateHouse(false);
    setHouseName("");
    loadData();
  }

  async function handleJoinHouse(e: React.FormEvent) {
    e.preventDefault();

    // Find house by invite code
    const { data: houseData } = await supabase
      .from("houses")
      .select("id")
      .eq("invite_code", inviteCode.toLowerCase())
      .single();

    if (houseData) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("house_members").insert({
        house_id: houseData.id,
        user_id: user?.id,
        role: "member",
      });

      // Notify other members
      if (user) {
        const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Alguien";
        await sendNotification(NOTIFICATION_TEMPLATES.NEW_MEMBER(userName));
      }

      setShowJoinHouse(false);
      setInviteCode("");
      loadData();
    } else {
      alert("Código de invitación inválido");
    }
  }

  async function handleLeaveHouse() {
    if (!house || !confirm("¿Seguro que quieres salir de esta casa?")) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase
      .from("house_members")
      .delete()
      .eq("house_id", house.id)
      .eq("user_id", user?.id);

    setHouse(null);
    setMembers([]);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function copyInviteCode() {
    if (house) {
      navigator.clipboard.writeText(house.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function toggleDarkMode() {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
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
          <h1 className="text-xl font-bold tracking-tight text-foreground">Configuración</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Account Section */}
        <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border/40 transition-all hover:shadow-md">
          <h2 className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-4">Cuenta</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-semibold text-muted-foreground">Email</span>
              <span className="text-foreground font-bold">{userEmail}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-border/40">
              <span className="text-sm font-semibold text-muted-foreground">Modo oscuro</span>
              <button
                onClick={toggleDarkMode}
                className="p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-accent" />
                ) : (
                  <Moon className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border/40 transition-all hover:shadow-md">
          <h2 className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificaciones
          </h2>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-foreground font-bold">Activar alertas</p>
              <p className="text-xs text-muted-foreground font-medium mt-1">Recibir avisos de gastos y deudas</p>
            </div>
            {isLoadingPush ? (
              <div className="w-12 h-6 bg-muted rounded-full animate-pulse" />
            ) : (
              <button
                onClick={handleTogglePush}
                className={`w-12 h-6 rounded-full transition-colors relative shadow-inner ${
                  subscription ? "bg-accent" : "bg-muted"
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${
                    subscription ? "left-7" : "left-1"
                  }`}
                />
              </button>
            )}
          </div>

          {subscription && (
            <div className="flex justify-end mt-4 pt-4 border-t border-border/40">
              <button
                onClick={handleTestPush}
                className="text-xs text-secondary hover:text-secondary/80 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                <span>Enviar prueba</span>
                <span>🚀</span>
              </button>
            </div>
          )}

          {pushError && !subscription && (
            <p className="text-xs text-destructive mt-4 p-3 bg-destructive/10 rounded-xl font-medium">
              ⚠️ {pushError}
            </p>
          )}
        </div>

        {/* House Section */}
        <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border/40 transition-all hover:shadow-md">
          <h2 className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-4 flex items-center gap-2">
            <Home className="w-4 h-4" />
            Mi Casa
          </h2>

          {isLoading ? (
            <p className="text-muted-foreground py-4 font-medium">Cargando...</p>
          ) : house ? (
            <div className="space-y-6">
              <div className="p-5 bg-accent/10 rounded-2xl border border-transparent hover:border-accent/20 transition-all">
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent mb-1">Casa actual</p>
                <p className="text-xl font-bold text-foreground">
                  {house.name}
                </p>
              </div>

              {/* Invite Code */}
              <div className="flex items-center gap-3 p-5 bg-muted/5 rounded-2xl border border-border/40">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Código de invitación</p>
                  <p className="text-xl font-mono font-bold text-foreground">
                    {house.invite_code}
                  </p>
                </div>
                <button
                  onClick={copyInviteCode}
                  className="p-3 bg-card border border-border/40 rounded-xl shadow-sm hover:shadow-md transition-all"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-secondary" />
                  ) : (
                    <Copy className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Members */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Miembros ({members.length})
                </p>
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-4 p-4 bg-muted/5 border border-border/40 rounded-2xl hover:bg-muted/10 transition-colors"
                    >
                      <div className="w-12 h-12 bg-accent/20 rounded-[16px] flex items-center justify-center text-accent font-bold text-lg shadow-inner">
                        {(member.users.name || member.users.email)[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-foreground">
                          {member.users.name || member.users.email}
                        </p>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">{member.role === "owner" ? "Dueño" : "Miembro"}</p>
                      </div>
                      {member.hasPush && (
                        <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center shrink-0 shadow-inner" title="Notificaciones activas">
                          <Bell className="w-5 h-5 text-secondary" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleLeaveHouse}
                className="w-full py-4 text-destructive hover:bg-destructive/10 font-bold uppercase tracking-wider text-xs rounded-xl transition-colors"
              >
                Salir de la casa
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground font-medium py-2">No estás en ninguna casa</p>

              <button
                onClick={() => setShowCreateHouse(true)}
                className="w-full py-4 bg-primary hover:bg-primary/90 shadow-sm text-primary-foreground font-bold rounded-[16px] flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-5 h-5" />
                Crear nueva casa
              </button>

              <button
                onClick={() => setShowJoinHouse(true)}
                className="w-full py-4 bg-muted/50 hover:bg-muted text-foreground font-bold rounded-[16px] transition-all"
              >
                Unirse con código
              </button>
            </div>
          )}
        </div>

        {/* Create House Modal */}
        {showCreateHouse && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-[24px] w-full max-w-md p-6 shadow-lg border border-border/40">
              <h2 className="text-xl font-bold text-foreground mb-6 text-center">
                Crear nueva casa
              </h2>
              <form onSubmit={handleCreateHouse} className="space-y-5">
                <input
                  type="text"
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                  placeholder="Nombre de la casa"
                  required
                  className="w-full px-5 py-4 rounded-[16px] border border-border/40 bg-muted/5 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all text-foreground"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateHouse(false)}
                    className="flex-1 py-4 border border-border/40 hover:bg-muted/50 rounded-[16px] font-bold text-muted-foreground transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-primary text-primary-foreground font-bold rounded-[16px] shadow-sm hover:bg-primary/90 transition-all"
                  >
                    Crear
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Join House Modal */}
        {showJoinHouse && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-[24px] w-full max-w-md p-6 shadow-lg border border-border/40">
              <h2 className="text-xl font-bold text-foreground mb-6 text-center">
                Unirse a una casa
              </h2>
              <form onSubmit={handleJoinHouse} className="space-y-5">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Código de invitación"
                  required
                  className="w-full px-5 py-4 rounded-[16px] border border-border/40 bg-muted/5 font-mono text-center text-xl tracking-widest shadow-sm focus:outline-none focus:ring-2 focus:ring-accent transition-all text-foreground uppercase"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowJoinHouse(false)}
                    className="flex-1 py-4 border border-border/40 hover:bg-muted/50 rounded-[16px] font-bold text-muted-foreground transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-accent text-accent-foreground font-bold rounded-[16px] shadow-sm hover:bg-accent/90 transition-all"
                  >
                    Unirse
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="w-full py-4 bg-transparent text-destructive font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Cerrar sesión
        </button>
      </main>

      <BottomNav />
    </div>
  );
}
