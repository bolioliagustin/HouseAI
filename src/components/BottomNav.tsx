"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, Scan, TrendingUp, Settings } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/60 backdrop-blur-3xl border-t border-muted/50 pb-safe">
      <div className="max-w-4xl mx-auto px-4 py-3 flex text-center justify-between items-center bg-white/30">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center gap-1 flex-1 transition-colors ${
            pathname === "/dashboard" 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Home className={`w-5 h-5 ${pathname === "/dashboard" ? "fill-primary/20" : ""}`} />
          <span className="text-[10px] font-medium tracking-wide">Home</span>
        </Link>
        <Link
          href="/expenses"
          className={`flex flex-col items-center gap-1 flex-1 transition-colors ${
            pathname === "/expenses" 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Receipt className={`w-5 h-5 ${pathname === "/expenses" ? "fill-primary/20" : ""}`} />
          <span className="text-[10px] font-medium tracking-wide">Gastos</span>
        </Link>
        <Link
          href="/scan"
          className={`flex flex-col items-center gap-1 flex-1 transition-colors ${
            pathname === "/scan" 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Scan className={`w-5 h-5 ${pathname === "/scan" ? "fill-primary/20" : ""}`} />
          <span className="text-[10px] font-medium tracking-wide">Scan</span>
        </Link>
        <Link
          href="/reports"
          className={`flex flex-col items-center gap-1 flex-1 transition-colors ${
            pathname === "/reports" 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp className={`w-5 h-5 ${pathname === "/reports" ? "fill-primary/20" : ""}`} />
          <span className="text-[10px] font-medium tracking-wide">Reportes</span>
        </Link>
        <Link
          href="/settings"
          className={`flex flex-col items-center gap-1 flex-1 transition-colors ${
            pathname === "/settings" 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className={`w-5 h-5 ${pathname === "/settings" ? "fill-primary/20" : ""}`} />
          <span className="text-[10px] font-medium tracking-wide">Config</span>
        </Link>
      </div>
    </nav>
  );
}
