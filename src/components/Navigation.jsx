import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  Repeat,
  Settings,
  Plus
} from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, onOpenAddModal, currency = '₹' }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'analytics', label: 'Analysis', icon: BarChart3 },
    { id: 'recurring', label: 'Recurring', icon: Repeat },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* DESKTOP / TABLET SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 p-4 shrink-0 min-h-screen sticky top-0">
        <div className="flex items-center gap-3 px-3 py-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">
            {currency}
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">Expense & Profit</h1>
            <p className="text-xs text-slate-400 font-medium">Business & Household</p>
          </div>
        </div>

        {/* Add Transaction Button */}
        <button
          onClick={() => onOpenAddModal()}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all mb-6 cursor-pointer"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Add Transaction</span>
        </button>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 font-semibold border-l-4 border-blue-500 pl-3'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-800/80 px-2 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span>Persistent Database</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <p className="mt-1 text-[11px] text-slate-600">SQLite • v1.0.0</p>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 px-2 py-1 shadow-lg">
        <div className="flex items-center justify-around relative max-w-md mx-auto">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                  isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-blue-600 stroke-[2.5]' : 'stroke-2'}`} />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </button>
            );
          })}

          {/* Prominent Center "+ Add" button */}
          <div className="-mt-6 flex flex-col items-center">
            <button
              onClick={() => onOpenAddModal()}
              aria-label="Add Transaction"
              className="w-13 h-13 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-xl shadow-blue-600/40 active:scale-95 transition-transform border-4 border-white cursor-pointer"
            >
              <Plus className="w-7 h-7 stroke-[2.5]" />
            </button>
            <span className="text-[10px] font-semibold text-slate-700 mt-1">Add</span>
          </div>

          {navItems.slice(2).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                  isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-blue-600 stroke-[2.5]' : 'stroke-2'}`} />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
