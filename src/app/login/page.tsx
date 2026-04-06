"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, Eye, EyeOff, Home, Loader2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        setMessage({
          type: "success",
          text: "¡Cuenta creada! Revisa tu email para confirmar.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Redirect will be handled by middleware
        window.location.href = "/dashboard";
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Ocurrió un error";
      setMessage({
        type: "error",
        text: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Error con Google";
      setMessage({
        type: "error",
        text: errorMessage,
      });
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center mt-[-10vh]">
        <div className="w-20 h-20 bg-primary/10 rounded-[20px] shadow-sm flex items-center justify-center mx-auto mb-5 border border-primary/20">
          <Home className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          MitAI
        </h1>
        <p className="text-muted-foreground mt-2 font-medium">
          Gestión inteligente del hogar
        </p>
      </div>

      {/* Form Card */}
      <div className="w-full max-w-md bg-card rounded-[24px] shadow-sm p-8 border border-border/40">
        <h2 className="text-sm uppercase tracking-wider font-bold text-foreground mb-6 text-center">
          {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
        </h2>

        {message && (
          <div
            className={`mb-6 p-4 rounded-[16px] text-sm font-medium ${
              message.type === "error"
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-secondary/10 text-secondary border border-secondary/20"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full pl-12 pr-4 py-4 rounded-[16px] border border-border/40 bg-muted/5 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-12 pr-12 py-4 rounded-[16px] border border-border/40 bg-muted/5 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-[16px] shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 text-sm uppercase tracking-wider"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Cargando...
              </>
            ) : isSignUp ? (
              "Crear cuenta"
            ) : (
              "Iniciar sesión"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/40"></div>
          </div>
          <div className="relative flex justify-center text-xs font-bold uppercase tracking-wider">
            <span className="px-4 bg-card text-muted-foreground">o continuar con</span>
          </div>
        </div>

        {/* Google Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full py-4 px-4 bg-transparent border border-border/40 hover:bg-muted/30 text-foreground font-bold rounded-[16px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-sm text-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google
        </button>

        {/* Toggle Sign Up / Sign In */}
        <p className="mt-8 text-center text-sm text-muted-foreground font-medium">
          {isSignUp ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage(null);
            }}
            className="text-primary hover:text-primary/80 font-bold transition-colors"
          >
            {isSignUp ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </p>

        {/* Back to home */}
        <Link
          href="/"
          className="mt-6 block text-center text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
