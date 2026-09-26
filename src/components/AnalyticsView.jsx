import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from 'recharts';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  CreditCard,
  Calendar,
  Layers,
  ShoppingBag,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatCurrency, formatDisplayDate } from '../utils/formatters.js';

export default function AnalyticsView({ categories = [], currency = '₹', refreshTrigger = 0 }) {
  const [period, setPeriod] = useState('This Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);

  // Active section tab: 'categories' | 'items' | 'trends' | 'monthly' | 'payment'
  const [activeTab, setActiveTab] = useState('categories');

  // Data states
  const [categoryData, setCategoryData] = useState({ grandTotal: 0, categories: [] });
  const [itemData, setItemData] = useState([]);
  const [selectedCatFilter, setSelectedCatFilter] = useState('');
  const [selectedSubFilter, setSelectedSubFilter] = useState('');

  const [frequentItems, setFrequentItems] = useState([]);
  const [frequentSort, setFrequentSort] = useState('frequency'); // 'frequency' | 'spending' | 'recent'

  const [trendTimeframe, setTrendTimeframe] = useState('monthly'); // 'daily' | 'weekly' | 'monthly'
  const [trendData, setTrendData] = useState([]);

  const [monthlySummary, setMonthlySummary] = useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [expandedCats, setExpandedCats] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const periods = ['This Week', 'This Month', 'Last Month', 'This Year', 'Custom'];

  // Helper to determine active date range strings
  const getDates = async () => {
    const summary = await api.getSummary(
      period === 'Custom' ? 'Custom' : period,
      period === 'Custom' ? customStart : null,
      period === 'Custom' ? customEnd : null
    );
    return { startDate: summary.startDate, endDate: summary.endDate };
  };

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const { startDate, endDate } = await getDates();

      const [cats, items, freq, trends, monthly, payments] = await Promise.all([
        api.getCategoryBreakdown(startDate, endDate, 'Expense'),
        api.getItemBreakdown(startDate, endDate, selectedCatFilter, selectedSubFilter),
        api.getFrequentItems(frequentSort, 15),
        api.getTrends(trendTimeframe),
        api.getMonthlySummary(),
        api.getPaymentMethodBreakdown(startDate, endDate)
      ]);
      setCategoryData(cats || { grandTotal: 0, categories: [] });
      setItemData(items || []);
      setFrequentItems(freq || []);
      setTrendData(trends || []);
      setMonthlySummary(monthly || []);
      setPaymentData(payments || []);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [
    period,
    customStart,
    customEnd,
    selectedCatFilter,
    selectedSubFilter,
    frequentSort,
    trendTimeframe,
    refreshTrigger
  ]);

  const toggleCategoryExpand = (catId) => {
    const next = new Set(expandedCats);
    if (next.has(catId)) next.delete(catId);
    else next.add(catId);
    setExpandedCats(next);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER & TIME PERIOD SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
            Financial Analysis
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Category drilldowns, item-level tracking, and spending trends
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
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

      {/* SUB-SECTION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-0.5">
        {[
          { id: 'categories', label: 'Categories' },
          { id: 'items', label: 'Item Drilldown' },
          { id: 'frequent', label: 'Frequent Items' },
          { id: 'trends', label: 'Trends & Charts' },
          { id: 'monthly', label: 'Monthly Summary' },
          { id: 'payment', label: 'Payment Methods' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-0.5 cursor-pointer ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: CATEGORY BREAKDOWN (Section 21) */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-base">Expense Category Breakdown</h3>
              <span className="text-xs font-bold text-slate-500 font-mono-num">
                Total: {formatCurrency(categoryData.grandTotal, currency)}
              </span>
            </div>

            {categoryData.categories.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No expense transactions found in this period.
              </div>
            ) : (
              <div className="space-y-4 divide-y divide-slate-100">
                {categoryData.categories.map((cat) => {
                  const isExpanded = expandedCats.has(cat.id);
                  return (
                    <div key={cat.id} className="pt-3 first:pt-0">
                      <div
                        onClick={() => toggleCategoryExpand(cat.id)}
                        className="flex items-center justify-between py-2 cursor-pointer hover:bg-slate-50/60 px-2 rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </span>
                          <div>
                            <span className="font-bold text-sm text-slate-800">{cat.name}</span>
                            <span className="text-xs text-slate-400 ml-2">({cat.count} tx)</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold font-mono-num text-sm text-slate-900">
                            {formatCurrency(cat.total, currency)}
                          </span>
                          <span className="text-xs text-blue-600 font-semibold ml-2">
                            {cat.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Main Category Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden my-1">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>

                      {/* Subcategories (Section 21) */}
                      {isExpanded && cat.subcategories.length > 0 && (
                        <div className="mt-2 pl-6 pr-2 space-y-2 border-l-2 border-blue-100 ml-4 mb-3">
                          {cat.subcategories.map((sub) => (
                            <div key={sub.id || sub.name} className="py-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-slate-600">{sub.name}</span>
                                <div className="space-x-2">
                                  <span className="font-mono-num font-semibold text-slate-800">
                                    {formatCurrency(sub.total, currency)}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    ({sub.percentage}%)
                                  </span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1">
                                <div
                                  className="bg-indigo-400 h-1.5 rounded-full"
                                  style={{ width: `${sub.percentage}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ITEM-LEVEL DRILLDOWN (Section 22) */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase">Filter Items by Category:</span>
            <select
              value={selectedCatFilter}
              onChange={(e) => {
                setSelectedCatFilter(e.target.value);
                setSelectedSubFilter('');
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 font-medium"
            >
              <option value="">All Categories</option>
              {categories.filter(c => c.type === 'Expense').map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">Item-Level Spending</h3>
              <p className="text-xs text-slate-500">
                Identify precisely where money is going at the individual item level
              </p>
            </div>

            {itemData.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No items recorded in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3">Category / Subcategory</th>
                      <th className="px-4 py-3 text-right">Purchases</th>
                      <th className="px-4 py-3 text-right">Avg Price</th>
                      <th className="px-4 py-3 text-right">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {itemData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {item.item_name}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {item.category_name} {item.subcategory_name ? `• ${item.subcategory_name}` : ''}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num text-slate-600">
                          {item.purchase_count}x
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num text-slate-600">
                          {formatCurrency(item.avg_amount, currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num font-bold text-slate-900">
                          {formatCurrency(item.total_amount, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FREQUENT ITEMS (Section 23) */}
      {activeTab === 'frequent' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase">Sort Frequently Purchased:</span>
            <div className="flex items-center gap-1">
              {[
                { id: 'frequency', label: 'Most Frequent' },
                { id: 'spending', label: 'Highest Spending' },
                { id: 'recent', label: 'Most Recent' }
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setFrequentSort(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    frequentSort === s.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {frequentItems.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {item.usage_count} times
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {item.category_name} {item.subcategory_name ? `• ${item.subcategory_name}` : ''}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Spent</span>
                    <span className="font-bold font-mono-num text-slate-900">
                      {formatCurrency(item.total_spent, currency)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Avg Price</span>
                    <span className="font-bold font-mono-num text-slate-700">
                      {formatCurrency(item.average_amount, currency)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SPENDING TRENDS (Section 24) */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase">View Timeframe:</span>
            <div className="flex items-center gap-1">
              {[
                { id: 'daily', label: 'Daily (30D)' },
                { id: 'weekly', label: 'Weekly (12W)' },
                { id: 'monthly', label: 'Monthly (12M)' }
              ].map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => setTrendTimeframe(tf.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    trendTimeframe === tf.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 text-base mb-4">
              Income vs Expenses Comparison ({trendTimeframe})
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey={trendTimeframe === 'daily' ? 'date' : trendTimeframe === 'weekly' ? 'week' : 'month'} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val) => formatCurrency(val, currency)}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MONTHLY SUMMARY (Section 25) */}
      {activeTab === 'monthly' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-base">Monthly Financial History</h3>
            <p className="text-xs text-slate-500">
              Dynamic month-by-month financial summary calculated from actual transaction data
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3 text-right">Income</th>
                  <th className="px-4 py-3 text-right">Business Expenses</th>
                  <th className="px-4 py-3 text-right">Home Expenses</th>
                  <th className="px-4 py-3 text-right">Total Expenses</th>
                  <th className="px-4 py-3 text-right font-bold text-blue-700">Business Net</th>
                  <th className="px-4 py-3 text-right font-bold text-emerald-700">Total Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {monthlySummary.map((m) => (
                  <tr key={m.month} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-800">
                      {m.month}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-emerald-600">
                      {formatCurrency(m.income, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-slate-700">
                      {formatCurrency(m.business_expenses, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-slate-700">
                      {formatCurrency(m.home_expenses, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-rose-600">
                      {formatCurrency(m.total_expenses, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num font-bold text-blue-700">
                      {formatCurrency(m.business_net, currency)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono-num font-bold ${
                      m.net_profit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {formatCurrency(m.net_profit, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: PAYMENT METHODS (Section 26) */}
      {activeTab === 'payment' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-slate-800 text-base">Payment Method Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {paymentData.map((pm, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-800">{pm.payment_method}</span>
                  <span className="text-xs text-slate-400">{pm.count} tx</span>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Expenses:</span>
                    <span className="font-bold font-mono-num text-rose-600">
                      {formatCurrency(pm.expense_amount, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Income:</span>
                    <span className="font-bold font-mono-num text-emerald-600">
                      {formatCurrency(pm.income_amount, currency)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
