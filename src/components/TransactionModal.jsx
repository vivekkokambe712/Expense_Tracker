import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Clock,
  Tag,
  CreditCard,
  Calendar,
  Building,
  Check,
  Plus
} from 'lucide-react';
import { api } from '../services/api.js';
import { getTodayDateString, formatCurrency } from '../utils/formatters.js';

export default function TransactionModal({
  isOpen,
  onClose,
  initialType = 'Expense',
  editTransaction = null,
  categories = [],
  paymentMethods = [],
  onSaved,
  currency = '₹'
}) {
  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [itemName, setItemName] = useState('');
  const [transactionDate, setTransactionDate] = useState(getTodayDateString());
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [vendorOrCustomer, setVendorOrCustomer] = useState('');

  // Autocomplete state
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [recentItems, setRecentItems] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successBadge, setSuccessBadge] = useState('');

  const amountInputRef = useRef(null);
  const itemInputRef = useRef(null);

  // Initialize or reset form
  useEffect(() => {
    if (isOpen) {
      if (editTransaction) {
        setType(editTransaction.type);
        setAmount(String(editTransaction.amount));
        setCategoryId(editTransaction.category_id || '');
        setSubcategoryId(editTransaction.subcategory_id || '');
        setItemName(editTransaction.item_name || '');
        setTransactionDate(editTransaction.transaction_date || getTodayDateString());
        setPaymentMethodId(editTransaction.payment_method_id || '');
        setNotes(editTransaction.notes || '');
        setTags(editTransaction.tags || '');
        setVendorOrCustomer(editTransaction.vendor_or_customer || '');
      } else {
        setType(initialType);
        setAmount('');
        setNotes('');
        setTags('');
        setVendorOrCustomer('');
        setTransactionDate(getTodayDateString());

        // Set default category based on type
        const defaultCat = categories.find(c => c.type === initialType);
        if (defaultCat) {
          setCategoryId(defaultCat.id);
          if (defaultCat.subcategories?.length > 0) {
            setSubcategoryId(defaultCat.subcategories[0].id);
          }
        }

        // Set default payment method (Cash or UPI)
        if (paymentMethods.length > 0 && !paymentMethodId) {
          const defaultPm = paymentMethods.find(p => p.name === 'UPI') || paymentMethods[0];
          setPaymentMethodId(defaultPm.id);
        }
      }

      setError('');
      setSuccessBadge('');
      loadRecentItems();

      // Focus amount on mobile & desktop
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, editTransaction, initialType, categories]);

  // Load frequent/recent items for quick selection chips
  const loadRecentItems = async () => {
    try {
      const items = await api.searchItems('', categoryId || null);
      setRecentItems(items.slice(0, 6));
    } catch {
      // ignore
    }
  };

  // Switch category list when type changes
  const availableCategories = categories.filter(c => c.type === type);
  const selectedCategory = categories.find(c => c.id === Number(categoryId));
  const availableSubcategories = selectedCategory?.subcategories || [];

  // Handle typing in item input for real-time autocomplete
  const handleItemChange = async (e) => {
    const val = e.target.value;
    setItemName(val);

    if (val.trim().length > 0) {
      try {
        const matches = await api.searchItems(val, categoryId || null);
        setItemSuggestions(matches);
        setShowSuggestions(true);
      } catch {
        setItemSuggestions([]);
      }
    } else {
      setItemSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handle selecting an autocomplete suggestion or recent chip
  const selectItemSuggestion = (item) => {
    setItemName(item.name);
    setShowSuggestions(false);

    // Auto-guess Category and Subcategory if available
    if (item.default_category_id) {
      const targetCat = categories.find(c => c.id === item.default_category_id);
      if (targetCat) {
        setType(targetCat.type);
        setCategoryId(item.default_category_id);
        if (item.default_subcategory_id) {
          setSubcategoryId(item.default_subcategory_id);
        }
      }
    }

    // If amount is empty, optionally prefill last or average amount as hint/value
    if (!amount && item.last_amount > 0) {
      setAmount(String(item.last_amount));
    }
  };

  const handleSave = async (addAnother = false) => {
    setError('');
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      amountInputRef.current?.focus();
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    const payload = {
      type,
      amount: numAmount,
      category_id: Number(categoryId),
      subcategory_id: subcategoryId ? Number(subcategoryId) : null,
      item_name: itemName.trim() || (type === 'Expense' ? 'General Expense' : 'General Income'),
      transaction_date: transactionDate,
      payment_method_id: paymentMethodId ? Number(paymentMethodId) : null,
      notes: notes.trim(),
      tags: tags.trim(),
      vendor_or_customer: vendorOrCustomer.trim()
    };

    setIsSubmitting(true);
    try {
      let saved;
      if (editTransaction) {
        const res = await api.updateTransaction(editTransaction.id, payload);
        saved = res.transaction;
      } else {
        const res = await api.createTransaction(payload);
        saved = res.transaction;
      }

      onSaved(saved, editTransaction ? 'updated' : 'created');

      if (addAnother) {
        setSuccessBadge(`${type} saved ✓`);
        setAmount('');
        setItemName('');
        setNotes('');
        setTags('');
        setVendorOrCustomer('');
        setTimeout(() => {
          setSuccessBadge('');
          amountInputRef.current?.focus();
        }, 1200);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in slide-in-from-bottom duration-200">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">
              {editTransaction ? 'Edit Transaction' : 'Record Transaction'}
            </h2>
            {successBadge && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 animate-pulse flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> {successBadge}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
              {error}
            </div>
          )}

          {/* TYPE TOGGLE: EXPENSE VS INCOME */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setType('Expense');
                const cat = categories.find(c => c.type === 'Expense');
                if (cat) {
                  setCategoryId(cat.id);
                  setSubcategoryId(cat.subcategories?.[0]?.id || '');
                }
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                type === 'Expense'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingDown className="w-4 h-4 text-rose-500" />
              Expense
            </button>
            <button
              type="button"
              onClick={() => {
                setType('Income');
                const cat = categories.find(c => c.type === 'Income');
                if (cat) {
                  setCategoryId(cat.id);
                  setSubcategoryId(cat.subcategories?.[0]?.id || '');
                }
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                type === 'Income'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Income
            </button>
          </div>

          {/* AMOUNT FIELD - PROMINENT MOBILE NUMERIC INPUT */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Amount *
            </label>
            <div className="relative rounded-2xl border border-slate-200 focus-within:border-blue-500 focus-within:ring-3 focus-within:ring-blue-100 transition-all bg-white overflow-hidden shadow-sm">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400 font-mono-num">
                {currency}
              </span>
              <input
                ref={amountInputRef}
                type="number"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-11 pr-4 py-3.5 text-3xl font-bold font-mono-num text-slate-800 placeholder:text-slate-300 focus:outline-none"
              />
            </div>
          </div>

          {/* ITEM / DESCRIPTION WITH INTELLIGENT AUTOCOMPLETE */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Item / Description
              </label>
              <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Smart suggestions
              </span>
            </div>

            <input
              ref={itemInputRef}
              type="text"
              value={itemName}
              onChange={handleItemChange}
              onFocus={() => {
                if (itemSuggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder={type === 'Expense' ? 'e.g. Chicken, Milk, Paper A4, WiFi' : 'e.g. Printing Order, Xerox, Consulting'}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />

            {/* AUTOCOMPLETE DROPDOWN */}
            {showSuggestions && itemSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-52 overflow-y-auto z-30 divide-y divide-slate-100">
                {itemSuggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItemSuggestion(item)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 flex items-center justify-between transition-colors group cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-sm text-slate-800 group-hover:text-blue-600">
                        {item.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {item.category_name} {item.subcategory_name ? `• ${item.subcategory_name}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      {item.last_amount > 0 && (
                        <div className="text-xs font-bold font-mono-num text-slate-600">
                          {formatCurrency(item.last_amount, currency)}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 justify-end">
                        <Clock className="w-2.5 h-2.5" /> {item.usage_count}x
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* RECENTLY USED CHIPS (Fast 1-tap entry) */}
            {recentItems.length > 0 && !showSuggestions && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Recent:</span>
                {recentItems.map((ritem) => (
                  <button
                    key={ritem.id}
                    type="button"
                    onClick={() => selectItemSuggestion(ritem)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 font-medium transition-colors cursor-pointer"
                  >
                    {ritem.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CATEGORY & SUBCATEGORY GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  const cat = categories.find(c => c.id === Number(e.target.value));
                  setSubcategoryId(cat?.subcategories?.[0]?.id || '');
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
              >
                <option value="">Select Category</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Subcategory
              </label>
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
              >
                <option value="">General / None</option>
                {availableSubcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* DATE & PAYMENT METHOD GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
              >
                <option value="">Select Method</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* VENDOR OR CUSTOMER (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              {type === 'Expense' ? 'Vendor / Store (Optional)' : 'Customer / Client (Optional)'}
            </label>
            <input
              type="text"
              value={vendorOrCustomer}
              onChange={(e) => setVendorOrCustomer(e.target.value)}
              placeholder={type === 'Expense' ? 'e.g. Local Mart, Amazon, Electric Board' : 'e.g. ABC Company, John Doe'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          {/* NOTES & TAGS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Tags (e.g. #monthly #urgent)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="#urgent, #monthly"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
        </div>

        {/* MODAL FOOTER WITH QUICK ACTION BUTTONS */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2">
          {!editTransaction && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(true)}
              className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Save & Add Another
            </button>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSave(false)}
            className={`w-full sm:flex-1 py-3 px-5 rounded-xl font-bold text-white text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
              type === 'Expense'
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
            }`}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            {editTransaction
              ? 'Update Transaction'
              : type === 'Expense'
              ? 'SAVE EXPENSE'
              : 'SAVE INCOME'}
          </button>
        </div>
      </div>
    </div>
  );
}
