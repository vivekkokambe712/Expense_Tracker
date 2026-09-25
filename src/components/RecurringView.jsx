import React, { useState, useEffect } from 'react';
import {
  Repeat,
  AlertTriangle,
  Check,
  Trash2,
  Plus,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatCurrency, formatDisplayDate } from '../utils/formatters.js';

export default function RecurringView({
  categories = [],
  onOpenAddModal,
  currency = '₹',
  refreshTrigger = 0
}) {
  const [detectedCandidates, setDetectedCandidates] = useState([]);
  const [activeRules, setActiveRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);

  // New rule form
  const [newRule, setNewRule] = useState({
    item_name: '',
    category_id: '',
    subcategory_id: '',
    expected_amount: '',
    frequency_days: 30,
    frequency_label: 'Monthly (~30 days)',
    next_due_date: new Date().toISOString().split('T')[0]
  });

  const loadRecurringData = async () => {
    setIsLoading(true);
    try {
      const candidates = await api.detectRecurring();
      setDetectedCandidates(candidates || []);

      const rules = await api.getRecurringRules();
      setActiveRules(rules || []);
    } catch (err) {
      console.error('Error loading recurring data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecurringData();
  }, [refreshTrigger]);

  const handleCreateRuleFromCandidate = async (candidate) => {
    try {
      await api.createRecurringRule({
        name: candidate.item_name,
        type: 'Expense',
        category_id: candidate.category_id,
        subcategory_id: candidate.subcategory_id,
        item_name: candidate.item_name,
        expected_amount: candidate.expected_amount,
        frequency_days: candidate.frequency_days,
        frequency_label: candidate.frequency_label,
        next_due_date: candidate.next_due_date
      });

      // Remove from candidates and reload
      setDetectedCandidates((prev) => prev.filter((c) => c.item_name !== candidate.item_name));
      loadRecurringData();
    } catch (err) {
      alert(err.message || 'Failed to create recurring rule');
    }
  };

  const handleIgnoreCandidate = (itemName) => {
    setDetectedCandidates((prev) => prev.filter((c) => c.item_name !== itemName));
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Delete this recurring rule?')) return;
    try {
      await api.deleteRecurringRule(id);
      loadRecurringData();
    } catch (err) {
      alert(err.message || 'Failed to delete rule');
    }
  };

  const handleSaveManualRule = async (e) => {
    e.preventDefault();
    if (!newRule.item_name || !newRule.expected_amount) {
      alert('Please enter item name and expected amount');
      return;
    }

    try {
      await api.createRecurringRule({
        name: newRule.item_name,
        type: 'Expense',
        category_id: newRule.category_id ? Number(newRule.category_id) : null,
        subcategory_id: newRule.subcategory_id ? Number(newRule.subcategory_id) : null,
        item_name: newRule.item_name,
        expected_amount: Number(newRule.expected_amount),
        frequency_days: Number(newRule.frequency_days),
        frequency_label: newRule.frequency_label,
        next_due_date: newRule.next_due_date
      });

      setShowAddRuleModal(false);
      setNewRule({
        item_name: '',
        category_id: '',
        subcategory_id: '',
        expected_amount: '',
        frequency_days: 30,
        frequency_label: 'Monthly (~30 days)',
        next_due_date: new Date().toISOString().split('T')[0]
      });
      loadRecurringData();
    } catch (err) {
      alert(err.message || 'Failed to save rule');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
            Recurring Expenses
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Intelligent recurring pattern detection and bill reminders
          </p>
        </div>

        <button
          onClick={() => setShowAddRuleModal(true)}
          className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Recurring Rule
        </button>
      </div>

      {/* INTELLIGENT RECURRING DETECTION NOTIFICATIONS (Section 12 & 69) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h3 className="font-bold text-slate-800 text-sm">
            AI-Driven Pattern Detections ({detectedCandidates.length})
          </h3>
        </div>

        {detectedCandidates.length === 0 ? (
          <div className="p-5 bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
            No new periodic transaction patterns detected. The system automatically inspects transaction intervals (e.g. WiFi every ~90 days, Milk every 1-2 days, Electricity every ~30 days).
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {detectedCandidates.map((cand, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-800 uppercase tracking-wide">
                        Possible recurring expense
                      </span>
                      <h4 className="text-base font-bold text-slate-900 mt-1">
                        {cand.item_name}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Approximately <strong>{formatCurrency(cand.expected_amount, currency)}</strong> • {cand.frequency_label}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Detected from {cand.tx_count} past transactions • Next estimated: {formatDisplayDate(cand.next_due_date)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleIgnoreCandidate(cand.item_name)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-amber-100/70 cursor-pointer"
                  >
                    Ignore
                  </button>
                  <button
                    onClick={() => handleCreateRuleFromCandidate(cand)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
                  >
                    Create Recurring Rule
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ACTIVE RECURRING RULES */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-800 text-sm">
          Active Recurring Rules ({activeRules.length})
        </h3>

        {activeRules.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            No active recurring rules configured yet.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {activeRules.map((rule) => (
              <div
                key={rule.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">{rule.name}</h4>
                    <p className="text-xs text-slate-400">
                      {rule.category_name} {rule.subcategory_name ? `• ${rule.subcategory_name}` : ''} • {rule.frequency_label}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <div className="font-bold font-mono-num text-sm text-slate-900">
                      ~{formatCurrency(rule.expected_amount, currency)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Next: {formatDisplayDate(rule.next_due_date)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        onOpenAddModal('Expense', {
                          item_name: rule.item_name,
                          amount: rule.expected_amount,
                          category_id: rule.category_id,
                          subcategory_id: rule.subcategory_id
                        })
                      }
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold cursor-pointer"
                      title="Log transaction now"
                    >
                      Log Now
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                      title="Delete rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MANUAL ADD RULE MODAL */}
      {showAddRuleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-base text-slate-800">Add Recurring Rule</h3>

            <form onSubmit={handleSaveManualRule} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Item / Rule Name *
                </label>
                <input
                  type="text"
                  required
                  value={newRule.item_name}
                  onChange={(e) => setNewRule({ ...newRule, item_name: e.target.value })}
                  placeholder="e.g. WiFi Bill, Electricity, Milk"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Expected Amount *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={newRule.expected_amount}
                  onChange={(e) => setNewRule({ ...newRule, expected_amount: e.target.value })}
                  placeholder="1200"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Frequency
                  </label>
                  <select
                    value={newRule.frequency_days}
                    onChange={(e) => {
                      const days = Number(e.target.value);
                      const labels = {
                        1: 'Every 1–2 days',
                        7: 'Weekly (~7 days)',
                        15: 'Bi-weekly (~15 days)',
                        30: 'Monthly (~30 days)',
                        90: 'Quarterly (~3 months)',
                        365: 'Yearly (~12 months)'
                      };
                      setNewRule({
                        ...newRule,
                        frequency_days: days,
                        frequency_label: labels[days] || `Every ${days} days`
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                  >
                    <option value="1">Every 1–2 days</option>
                    <option value="7">Weekly</option>
                    <option value="15">Bi-weekly</option>
                    <option value="30">Monthly (~30 days)</option>
                    <option value="90">Quarterly (~3 months)</option>
                    <option value="365">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Next Due Date
                  </label>
                  <input
                    type="date"
                    value={newRule.next_due_date}
                    onChange={(e) => setNewRule({ ...newRule, next_due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Category (Optional)
                </label>
                <select
                  value={newRule.category_id}
                  onChange={(e) => setNewRule({ ...newRule, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                >
                  <option value="">None / General</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
