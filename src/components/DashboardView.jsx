import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Calendar,
  Building2,
  Home,
  AlertTriangle,
  Receipt,
  Download,
  ChevronRight,
  Layers
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatCurrency, formatDisplayDate } from '../utils/formatters.js';

export default function DashboardView({
  onOpenAddModal,
  onNavigateTo,
  onEditTransaction,
  onDeleteTransaction,
  currency = '₹',
  refreshTrigger = 0
}) {
  const [period, setPeriod] = useState('This Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [summary, setSummary] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [recurringSuggestions, setRecurringSuggestions] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const periods = ['Today', 'This Week', 'This Month', 'Last Month', 'This Year', 'Custom'];

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const summaryData = await api.getSummary(
        period === 'Custom' ? 'Custom' : period,
        period === 'Custom' ? customStart : null,
        period === 'Custom' ? customEnd : null
      );
      setSummary(summaryData);

      const [txData, recurring, catData] = await Promise.all([
        api.getTransactions({ limit: 6 }),
        api.detectRecurring(),
        api.getCategoryBreakdown(summaryData.startDate, summaryData.endDate, 'Expense')
      ]);
      setRecentTransactions(txData.items || []);
      setRecurringSuggestions(recurring || []);
      if (catData) {
        setCategoryBreakdown(catData.categories?.slice(0, 4) || []);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [period, customStart, customEnd, refreshTrigger]);

  const current = summary?.currentPeriod || {};
  const today = summary?.today || {};
  const comparison = summary?.comparison || {};

  return (
    <div className="space-y-6 pb-12">
      
      {/* GREETING & PERIOD SWITCHER HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
            Financial Dashboard 👋
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Overview of your business & household finances
          </p>
        </div>

        {/* TIME PERIOD SELECTOR PILLS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                if (p === 'Custom') setShowCustomRange(true);
                else setShowCustomRange(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                period === p
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* CUSTOM DATE RANGE PICKER (If selected) */}
      {showCustomRange && (
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
            />
          </div>
        </div>
      )}

      {/* RECURRING EXPENSE NOTIFICATION BANNER (Section 12) */}
      {recurringSuggestions.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                Possible recurring expense detected
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                <strong>{recurringSuggestions[0].item_name}</strong> (~{formatCurrency(recurringSuggestions[0].expected_amount, currency)}) appears periodic ({recurringSuggestions[0].frequency_label}).
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTo('recurring')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer"
          >
            Review ({recurringSuggestions.length})
          </button>
        </div>
      )}

      {/* TODAY'S SNAPSHOT STRIP (Section 3) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 sm:p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="text-center sm:text-left">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
            Today's Income
          </span>
          <span className="text-sm sm:text-lg font-bold font-mono-num text-emerald-600">
            {formatCurrency(today.income || 0, currency)}
          </span>
        </div>
        <div className="text-center sm:text-left border-x border-slate-100 px-2 sm:px-4">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
            Today's Expense
          </span>
          <span className="text-sm sm:text-lg font-bold font-mono-num text-rose-600">
            {formatCurrency(today.expense || 0, currency)}
          </span>
        </div>
        <div className="text-center sm:text-left">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
            Today's Net
          </span>
          <span className={`text-sm sm:text-lg font-bold font-mono-num ${
            (today.net || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {formatCurrency(today.net || 0, currency)}
          </span>
        </div>
      </div>

      {/* CORE FINANCIAL SUMMARY CARDS (Income, Expense, Net Profit) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Income Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Income
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono-num text-slate-900">
              {formatCurrency(current.totalIncome || 0, currency)}
            </div>
            {comparison.incomeDiff !== undefined && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
                {comparison.incomeDiff >= 0 ? (
                  <span className="text-emerald-600 flex items-center">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +{formatCurrency(comparison.incomeDiff, currency)}
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center">
                    <ArrowDownRight className="w-3.5 h-3.5" /> {formatCurrency(comparison.incomeDiff, currency)}
                  </span>
                )}
                <span className="text-slate-400 font-normal">vs prev period</span>
              </div>
            )}
          </div>
        </div>

        {/* Expenses Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm relative overflow-hidden group hover:border-rose-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Expenses
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono-num text-slate-900">
              {formatCurrency(current.totalExpense || 0, currency)}
            </div>
            {comparison.expenseDiff !== undefined && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
                {comparison.expenseDiff <= 0 ? (
                  <span className="text-emerald-600 flex items-center">
                    <ArrowDownRight className="w-3.5 h-3.5" /> {formatCurrency(comparison.expenseDiff, currency)}
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +{formatCurrency(comparison.expenseDiff, currency)}
                  </span>
                )}
                <span className="text-slate-400 font-normal">vs prev period</span>
              </div>
            )}
          </div>
        </div>

        {/* Net Profit Card */}
        <div className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden transition-all ${
          (current.netProfit || 0) >= 0
            ? 'bg-gradient-to-br from-emerald-500/10 via-white to-white border-emerald-200'
            : 'bg-gradient-to-br from-rose-500/10 via-white to-white border-rose-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Net Profit / Result
            </span>
            <div className={`p-2 rounded-xl ${
              (current.netProfit || 0) >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}>
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono-num ${
              (current.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {formatCurrency(current.netProfit || 0, currency)}
            </div>
            <div className="mt-2 text-xs text-slate-500 font-medium">
              Total Income - Total Expenses
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 16: BUSINESS PROFIT VS HOUSEHOLD SPENDING SEPARATION */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-base">
              Business vs Household Separation
            </h3>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {period}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Business Net */}
          <div className="pt-2 md:pt-0 md:pr-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span>Business Net</span>
            </div>
            <div className="text-xl font-bold font-mono-num text-slate-900">
              {formatCurrency(current.businessNet || 0, currency)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Income: {formatCurrency(current.businessIncome || 0, currency)} • Expenses: {formatCurrency(current.businessExpense || 0, currency)}
            </div>
          </div>

          {/* Household Expenses */}
          <div className="pt-3 md:pt-0 md:px-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <Home className="w-4 h-4 text-amber-500" />
              <span>Home Expenses</span>
            </div>
            <div className="text-xl font-bold font-mono-num text-slate-900">
              {formatCurrency(current.homeExpense || 0, currency)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Groceries, Utilities, Household bills
            </div>
          </div>

          {/* Remaining Available (Clear Terminology - Section 16) */}
          <div className="pt-3 md:pt-0 md:pl-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span>Remaining Available</span>
            </div>
            <div className={`text-xl font-bold font-mono-num ${
              (current.remaining || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {formatCurrency(current.remaining || 0, currency)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Business Net - Home Expenses
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS BUTTONS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          onClick={() => onOpenAddModal('Expense')}
          className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-sm border border-rose-200/60 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        >
          <TrendingDown className="w-4 h-4" />
          + Add Expense
        </button>
        <button
          onClick={() => onOpenAddModal('Income')}
          className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-sm border border-emerald-200/60 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        >
          <TrendingUp className="w-4 h-4" />
          + Add Income
        </button>
        <a
          href={api.csvExportUrl}
          download
          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm border border-slate-200 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        >
          <Download className="w-4 h-4 text-slate-500" />
          Export CSV
        </a>
      </div>

      {/* TWO COLUMN SECTION: TOP EXPENSES BREAKDOWN & RECENT TRANSACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Expense Categories Breakdown */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-base">Top Categories</h3>
              <button
                onClick={() => onNavigateTo('analytics')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center cursor-pointer"
              >
                Full Analysis <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {categoryBreakdown.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No expense data in this period
              </div>
            ) : (
              <div className="space-y-4">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{cat.name}</span>
                      <span className="font-bold font-mono-num text-slate-900">
                        {formatCurrency(cat.total, currency)} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Period total:</span>
            <span className="font-bold font-mono-num text-slate-800">
              {formatCurrency(current.totalExpense || 0, currency)}
            </span>
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-slate-600" />
                <h3 className="font-bold text-slate-800 text-base">Recent Transactions</h3>
              </div>
              <button
                onClick={() => onNavigateTo('transactions')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center cursor-pointer"
              >
                View All <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <p className="text-slate-500 text-sm">No transactions logged yet.</p>
                <button
                  onClick={() => onOpenAddModal('Expense')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 cursor-pointer"
                >
                  Record Your First Transaction
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentTransactions.map((tx) => {
                  const isExpense = tx.type === 'Expense';
                  return (
                    <div
                      key={tx.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isExpense ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {isExpense ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-800 truncate">
                            {tx.item_name}
                          </div>
                          <div className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                            <span>{tx.category_name}</span>
                            {tx.subcategory_name && <span>• {tx.subcategory_name}</span>}
                            <span>• {formatDisplayDate(tx.transaction_date)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className={`font-bold font-mono-num text-sm sm:text-base ${
                            isExpense ? 'text-slate-800' : 'text-emerald-600'
                          }`}>
                            {isExpense ? '-' : '+'}{formatCurrency(tx.amount, currency)}
                          </div>
                          {tx.payment_method_name && (
                            <div className="text-[10px] text-slate-400 font-medium">
                              {tx.payment_method_name}
                            </div>
                          )}
                        </div>

                        {/* Quick edit & delete triggers */}
                        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteTransaction(tx.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
