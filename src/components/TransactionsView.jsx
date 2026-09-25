import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  SlidersHorizontal,
  X,
  TrendingDown,
  TrendingUp,
  Calendar,
  CreditCard,
  Tag,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  RotateCcw,
  Plus
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatCurrency, formatDisplayDate } from '../utils/formatters.js';

export default function TransactionsView({
  categories = [],
  paymentMethods = [],
  onOpenAddModal,
  onEditTransaction,
  onDeleteTransaction,
  currency = '₹',
  refreshTrigger = 0
}) {
  const [transactions, setTransactions] = useState([]);
  const [aggregates, setAggregates] = useState({ totalIncome: 0, totalExpense: 0, net: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [tag, setTag] = useState('');

  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount = [
    type,
    categoryId,
    subcategoryId,
    paymentMethodId,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    tag
  ].filter(Boolean).length;

  const loadTransactions = async (page = 1) => {
    setIsLoading(true);
    try {
      const data = await api.getTransactions({
        page,
        limit: pagination.limit,
        search,
        type,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        payment_method_id: paymentMethodId,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        tag
      });

      setTransactions(data.items || []);
      setAggregates(data.aggregates || { totalIncome: 0, totalExpense: 0, net: 0 });
      setPagination(data.pagination || { page: 1, limit: 30, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions(1);
  }, [
    search,
    type,
    categoryId,
    subcategoryId,
    paymentMethodId,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    tag,
    refreshTrigger
  ]);

  const clearFilters = () => {
    setType('');
    setCategoryId('');
    setSubcategoryId('');
    setPaymentMethodId('');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setTag('');
    setSearch('');
  };

  const selectedCategory = categories.find((c) => c.id === Number(categoryId));
  const availableSubcategories = selectedCategory?.subcategories || [];

  return (
    <div className="space-y-4 pb-12">
      {/* HEADER & QUICK ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
            Transactions History
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Search, filter, and audit all financial records
          </p>
        </div>

        <button
          onClick={() => onOpenAddModal('Expense')}
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Transaction
        </button>
      </div>

      {/* SEARCH BAR & FILTER TOGGLE */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item, category, note, vendor, tag, amount..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer shadow-xs ${
            showFilters || activeFiltersCount > 0
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* EXPANDABLE FILTER DRAWER (Section 19) */}
      {showFilters && (
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              Filter Transactions
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Type */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="Expense">Expense Only</option>
                <option value="Income">Income Only</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSubcategoryId('');
                }}
                className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Subcategory */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Subcategory
              </label>
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                disabled={!categoryId}
                className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-none disabled:bg-slate-50"
              >
                <option value="">All Subcategories</option>
                {availableSubcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-none"
              >
                <option value="">All Methods</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Start */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white"
              />
            </div>

            {/* Date End */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white"
              />
            </div>

            {/* Min Amount */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Min Amount
              </label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="0"
                className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white"
              />
            </div>

            {/* Max Amount */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Max Amount
              </label>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="No limit"
                className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* FILTER SUMMARY BAR (Section 19: Shows totals for the filtered query) */}
      <div className="bg-slate-100/90 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-600">
            {pagination.total} transaction{pagination.total === 1 ? '' : 's'}
          </span>
          <span className="text-slate-400">|</span>
          <div>
            <span className="text-slate-500">Income: </span>
            <span className="font-bold font-mono-num text-emerald-600">
              +{formatCurrency(aggregates.totalIncome, currency)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Expenses: </span>
            <span className="font-bold font-mono-num text-rose-600">
              -{formatCurrency(aggregates.totalExpense, currency)}
            </span>
          </div>
        </div>

        <div>
          <span className="text-slate-500">Filtered Net: </span>
          <span className={`font-bold font-mono-num text-sm ${
            aggregates.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {formatCurrency(aggregates.net, currency)}
          </span>
        </div>
      </div>

      {/* TRANSACTIONS LIST */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Loading transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-slate-600 font-medium">No transactions found matching your criteria.</p>
            <p className="text-xs text-slate-400">Try adjusting your filters or record a new transaction.</p>
            <button
              onClick={() => onOpenAddModal('Expense')}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 cursor-pointer shadow-sm"
            >
              Add Expense
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => {
              const isExpense = tx.type === 'Expense';
              return (
                <div
                  key={tx.id}
                  className="p-4 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      isExpense ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {isExpense ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800 truncate">
                          {tx.item_name}
                        </span>
                        {tx.vendor_or_customer && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium truncate max-w-[140px]">
                            {tx.vendor_or_customer}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="font-medium text-slate-600">{tx.category_name}</span>
                        {tx.subcategory_name && <span>• {tx.subcategory_name}</span>}
                        <span>• {formatDisplayDate(tx.transaction_date)}</span>
                        {tx.payment_method_name && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 font-medium">
                            {tx.payment_method_name}
                          </span>
                        )}
                      </div>

                      {tx.notes && (
                        <p className="text-xs text-slate-500 mt-1 italic line-clamp-1">
                          "{tx.notes}"
                        </p>
                      )}

                      {tx.tags && (
                        <div className="flex items-center gap-1 mt-1">
                          {tx.tags.split(',').map((t, idx) => (
                            <span key={idx} className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                              {t.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className={`font-bold font-mono-num text-base sm:text-lg ${
                        isExpense ? 'text-slate-900' : 'text-emerald-600'
                      }`}>
                        {isExpense ? '-' : '+'}{formatCurrency(tx.amount, currency)}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditTransaction(tx)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                        title="Edit transaction"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PAGINATION BAR */}
        {pagination.totalPages > 1 && (
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadTransactions(pagination.page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadTransactions(pagination.page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
