import React, { useState } from 'react';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  Coins,
  CreditCard,
  Check,
  AlertCircle,
  ShieldCheck,
  Archive
} from 'lucide-react';
import { api } from '../services/api.js';

export default function SettingsView({
  categories = [],
  paymentMethods = [],
  onCategoriesUpdated,
  currency = '₹',
  onCurrencyUpdated
}) {
  const [activeTab, setActiveTab] = useState('categories'); // 'categories' | 'payment' | 'data' | 'preferences'

  // New category state
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState('Expense');

  // Subcategory modal state
  const [targetCatForSub, setTargetCatForSub] = useState(null);
  const [newSubName, setNewSubName] = useState('');

  // Payment method state
  const [newPaymentName, setNewPaymentName] = useState('');

  // Backup restore state
  const [restoreStatus, setRestoreStatus] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  // Handle adding new category
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      await api.createCategory({ name: newCatName.trim(), type: newCatType });
      setNewCatName('');
      setShowAddCat(false);
      onCategoriesUpdated();
    } catch (err) {
      alert(err.message || 'Failed to add category');
    }
  };

  // Handle soft deleting / archiving category
  const handleArchiveCategory = async (id, name) => {
    if (!window.confirm(`Archive category "${name}"? Historical transactions will remain safe and intact.`)) {
      return;
    }
    try {
      await api.deleteCategory(id);
      onCategoriesUpdated();
    } catch (err) {
      alert(err.message || 'Failed to archive category');
    }
  };

  // Handle adding subcategory
  const handleAddSubcategory = async (e) => {
    e.preventDefault();
    if (!newSubName.trim() || !targetCatForSub) return;

    try {
      await api.addSubcategory(targetCatForSub.id, newSubName.trim());
      setNewSubName('');
      setTargetCatForSub(null);
      onCategoriesUpdated();
    } catch (err) {
      alert(err.message || 'Failed to add subcategory');
    }
  };

  // Handle adding payment method
  const handleAddPaymentMethod = async (e) => {
    e.preventDefault();
    if (!newPaymentName.trim()) return;

    try {
      await api.addPaymentMethod(newPaymentName.trim());
      setNewPaymentName('');
      onCategoriesUpdated();
    } catch (err) {
      alert(err.message || 'Failed to add payment method');
    }
  };

  // Handle JSON backup file upload
  const handleRestoreFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Restoring will replace the database with the backup data. Continue?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsRestoring(true);
        setRestoreStatus('Restoring backup...');
        const json = JSON.parse(event.target.result);
        await api.restoreBackup(json.data || json);
        setRestoreStatus('Backup restored successfully ✓');
        onCategoriesUpdated();
        setTimeout(() => setRestoreStatus(''), 4000);
      } catch (err) {
        setRestoreStatus('Failed to restore backup: ' + err.message);
      } finally {
        setIsRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
          Settings & Preferences
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Manage categories, payment methods, data export and backup
        </p>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-0.5">
        {[
          { id: 'categories', label: 'Categories & Subcategories' },
          { id: 'payment', label: 'Payment Methods' },
          { id: 'data', label: 'Export & Backup' },
          { id: 'preferences', label: 'Currency & Display' }
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

      {/* TAB 1: CATEGORY MANAGEMENT (Section 30) */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">
              Custom Categories ({categories.length})
            </h3>
            <button
              onClick={() => setShowAddCat(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Category
            </button>
          </div>

          {/* Add Category Form Modal */}
          {showAddCat && (
            <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-3">
              <h4 className="font-bold text-xs text-blue-900 uppercase">Create New Category</h4>
              <form onSubmit={handleAddCategory} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder="Category Name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white flex-1 min-w-[160px]"
                />
                <select
                  value={newCatType}
                  onChange={(e) => setNewCatType(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white font-medium"
                >
                  <option value="Expense">Expense</option>
                  <option value="Income">Income</option>
                </select>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddCat(false)}
                    className="px-3 py-1.5 text-slate-600 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Add Subcategory Modal */}
          {targetCatForSub && (
            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-3">
              <h4 className="font-bold text-xs text-indigo-900 uppercase">
                Add Subcategory to "{targetCatForSub.name}"
              </h4>
              <form onSubmit={handleAddSubcategory} className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder="Subcategory Name (e.g. Raw Material, Grocery)"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white flex-1"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setTargetCatForSub(null)}
                  className="px-3 py-1.5 text-slate-600 text-xs font-semibold"
                >
                  Cancel
                </button>
              </form>
            </div>
          )}

          {/* Categories List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        cat.type === 'Expense' ? 'bg-rose-500' : 'bg-emerald-500'
                      }`} />
                      <h4 className="font-bold text-sm text-slate-800">{cat.name}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold uppercase">
                        {cat.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setTargetCatForSub(cat)}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-50 cursor-pointer"
                        title="Add Subcategory"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleArchiveCategory(cat.id, cat.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 cursor-pointer"
                        title="Archive Category"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subcategories tag list */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {cat.subcategories && cat.subcategories.length > 0 ? (
                      cat.subcategories.map((sub) => (
                        <span
                          key={sub.id}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                        >
                          {sub.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">No subcategories</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENT METHODS (Section 26) */}
      {activeTab === 'payment' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">Add Payment Method</h3>
            <form onSubmit={handleAddPaymentMethod} className="flex items-center gap-2 max-w-md">
              <input
                type="text"
                required
                placeholder="Method Name (e.g. Google Pay, Cheque)"
                value={newPaymentName}
                onChange={(e) => setNewPaymentName(e.target.value)}
                className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white flex-1"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Add Method
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {paymentMethods.map((pm) => (
              <div
                key={pm.id}
                className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-xs text-slate-800">{pm.name}</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: EXPORT & BACKUP (Section 37 & 76) */}
      {activeTab === 'data' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Export CSV Card */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Download className="w-5 h-5 text-blue-600" />
                  Export Data to CSV
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Downloads all transactions with structured columns (Date, Type, Category, Subcategory, Item, Amount, Notes, Tags, Vendor/Customer). Perfect for Excel or spreadsheets.
                </p>
              </div>
              <a
                href={api.csvExportUrl}
                download
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </a>
            </div>

            {/* Export JSON Backup Card */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Complete JSON Backup
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Exports complete structured financial state (transactions, categories, items intelligence, recurring rules, settings) for future migration or AI analysis.
                </p>
              </div>
              <a
                href={api.jsonExportUrl}
                download
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all"
              >
                <Download className="w-4 h-4" />
                Download JSON Backup
              </a>
            </div>
          </div>

          {/* RESTORE FROM BACKUP */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Restore Database from JSON Backup
            </h3>
            <p className="text-xs text-slate-500">
              Upload a previously exported JSON backup file to restore all transactions, categories, and rules.
            </p>

            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all">
                <Upload className="w-4 h-4" />
                Select Backup JSON File
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFile}
                  disabled={isRestoring}
                  className="hidden"
                />
              </label>

              {restoreStatus && (
                <span className="text-xs font-semibold text-emerald-600">
                  {restoreStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PREFERENCES & CURRENCY (Section 52) */}
      {activeTab === 'preferences' && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 max-w-md">
          <h3 className="font-bold text-slate-800 text-base">Currency Settings</h3>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Active Currency Symbol
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={currency}
                onChange={(e) => onCurrencyUpdated(e.target.value)}
                className="w-20 px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-center font-mono-num"
              />
              <span className="text-xs text-slate-500">
                Default: ₹ (Indian Rupee with Indian number formatting)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
