import Link from "next/link";
import { Home, Receipt, TrendingUp, Scan, Settings } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <Home className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              MitAI
            </h1>
          </div>
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl shadow-green-500/10 border border-gray-100 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            ¡Bienvenido a MitAI! 🏠
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Tu asistente inteligente para administrar los gastos del hogar.
          </p>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-xl text-white">
          <p className="text-green-100 text-sm font-medium mb-1">Balance disponible</p>
          <p className="text-4xl font-bold mb-4">$0.00</p>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-green-100 text-xs">Ingresos</p>
              <p className="text-lg font-semibold">$0.00</p>
            </div>
            <div>
              <p className="text-green-100 text-xs">Gastos</p>
              <p className="text-lg font-semibold">$0.00</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Link 
            href="/expenses"
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700 hover:scale-[1.02] transition-transform group"
          >
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Receipt className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Gastos</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Registrar nuevo gasto</p>
          </Link>

          <Link 
            href="/scan"
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700 hover:scale-[1.02] transition-transform group"
          >
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Scan className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Escanear</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Escanear ticket</p>
          </Link>

          <Link 
            href="/reports"
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700 hover:scale-[1.02] transition-transform group"
          >
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Reportes</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ver estadísticas</p>
          </Link>

          <Link 
            href="/shared"
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700 hover:scale-[1.02] transition-transform group"
          >
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Home className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Compartidos</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Gastos de la casa</p>
          </Link>
        </div>

        {/* Shared Balance Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            🤝 Balance compartido
          </h3>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>Configura tu hogar para ver el balance</p>
            <button className="mt-3 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors">
              Crear hogar
            </button>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 pb-safe">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-around">
          <Link href="/" className="flex flex-col items-center gap-1 text-green-600 dark:text-green-400">
            <Home className="w-6 h-6" />
            <span className="text-xs font-medium">Inicio</span>
          </Link>
          <Link href="/expenses" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <Receipt className="w-6 h-6" />
            <span className="text-xs">Gastos</span>
          </Link>
          <Link href="/scan" className="flex flex-col items-center gap-1 -mt-4">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
              <Scan className="w-7 h-7 text-white" />
            </div>
          </Link>
          <Link href="/reports" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs">Reportes</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <Settings className="w-6 h-6" />
            <span className="text-xs">Config</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
