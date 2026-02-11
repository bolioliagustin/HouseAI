"use client";

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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Configuración</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Account Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Cuenta</h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-600 dark:text-gray-300">Email</span>
              <span className="text-gray-900 dark:text-white font-medium">{userEmail}</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-gray-600 dark:text-gray-300">Modo oscuro</span>
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 transition-colors"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificaciones
          </h2>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-gray-900 dark:text-white font-medium">Activar alertas</p>
              <p className="text-sm text-gray-500">Recibir avisos de gastos y deudas</p>
            </div>
            {isLoadingPush ? (
              <div className="w-12 h-6 bg-gray-100 rounded-full animate-pulse" />
            ) : (
              <button
                onClick={handleTogglePush}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  subscription ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                    subscription ? "left-7" : "left-1"
                  }`}
                />
              </button>
            )}
          </div>

          {subscription && (
            <div className="flex justify-end mt-2">
              <button
                onClick={handleTestPush}
                className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center gap-1"
              >
                <span>Enviar prueba</span>
                <span className="text-xs">🚀</span>
              </button>
            </div>
          )}

          {pushError && !subscription && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              ⚠️ {pushError}
            </p>
          )}
        </div>

        {/* House Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Home className="w-5 h-5" />
            Mi Casa
          </h2>

          {isLoading ? (
            <p className="text-gray-500 py-4">Cargando...</p>
          ) : house ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-600 dark:text-green-400">Casa actual</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                  {house.name}
                </p>
              </div>

              {/* Invite Code */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Código de invitación</p>
                  <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                    {house.invite_code}
                  </p>
                </div>
                <button
                  onClick={copyInviteCode}
                  className="p-3 bg-white dark:bg-gray-600 rounded-xl shadow-sm hover:shadow transition-all"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-500" />
                  )}
                </button>
              </div>

              {/* Members */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Miembros ({members.length})
                </p>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
                        {(member.users.name || member.users.email)[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {member.users.name || member.users.email}
                        </p>
                        <p className="text-xs text-gray-500">{member.role === "owner" ? "Dueño" : "Miembro"}</p>
                      </div>
                      {member.hasPush && (
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center" title="Notificaciones activas">
                          <Bell className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleLeaveHouse}
                className="w-full py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
              >
                Salir de la casa
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-500 dark:text-gray-400">No estás en ninguna casa</p>

              <button
                onClick={() => setShowCreateHouse(true)}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-xl flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Crear nueva casa
              </button>

              <button
                onClick={() => setShowJoinHouse(true)}
                className="w-full py-3 border-2 border-green-500 text-green-600 dark:text-green-400 font-medium rounded-xl"
              >
                Unirse con código
              </button>
            </div>
          )}
        </div>

        {/* Create House Modal */}
        {showCreateHouse && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Crear nueva casa
              </h2>
              <form onSubmit={handleCreateHouse} className="space-y-4">
                <input
                  type="text"
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                  placeholder="Nombre de la casa"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateHouse(false)}
                    className="flex-1 py-3 border border-gray-300 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-green-500 text-white font-medium rounded-xl"
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
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Unirse a una casa
              </h2>
              <form onSubmit={handleJoinHouse} className="space-y-4">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Código de invitación"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 font-mono text-center text-lg"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowJoinHouse(false)}
                    className="flex-1 py-3 border border-gray-300 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-green-500 text-white font-medium rounded-xl"
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
          className="w-full py-3 bg-white dark:bg-gray-800 text-red-500 font-medium rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Cerrar sesión
        </button>
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
          <Link
            href="/settings"
            className="flex flex-col items-center gap-1 text-green-600 dark:text-green-400"
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs font-medium">Config</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
