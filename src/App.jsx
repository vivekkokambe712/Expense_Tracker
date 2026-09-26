import React, { useState, useEffect } from 'react';
import Navigation from './components/Navigation.jsx';
import DashboardView from './components/DashboardView.jsx';
import TransactionsView from './components/TransactionsView.jsx';
import AnalyticsView from './components/AnalyticsView.jsx';
import RecurringView from './components/RecurringView.jsx';
import SettingsView from './components/SettingsView.jsx';
import TransactionModal from './components/TransactionModal.jsx';
import Toast from './components/Toast.jsx';
import { api } from './services/api.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [currency, setCurrency] = useState('₹');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('Expense');
  const [editingTransaction, setEditingTransaction] = useState(null);

  // Refresh trigger to keep all views in sync
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Toast state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success', undoAction = null) => {
    setToast({ message, type, undoAction });
    if (!undoAction) {
      setTimeout(() => {
        setToast((current) => (current?.message === message ? null : current));
      }, 3500);
    }
  };

  const loadInitialData = async () => {
    try {
      const metadata = await api.getInitialMetadata();
      setCategories(metadata.categories || []);
      setPaymentMethods(metadata.paymentMethods || []);
      const settings = metadata.settings || {};
      if (settings?.currency_symbol) {
        setCurrency(settings.currency_symbol);
      }
    } catch (err) {
      console.error('Error loading initial metadata:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Open add transaction modal
  const handleOpenAddModal = (type = 'Expense', prefill = null) => {
    setModalType(type);
    if (prefill) {
      setEditingTransaction({
        type,
        ...prefill
      });
    } else {
      setEditingTransaction(null);
    }
    setIsModalOpen(true);
  };

  // Open edit modal
  const handleEditTransaction = (tx) => {
    setEditingTransaction(tx);
    setModalType(tx.type);
    setIsModalOpen(true);
  };

  // Delete transaction with UNDO support (Section 35 & 36)
  const handleDeleteTransaction = async (id) => {
    try {
      await api.deleteTransaction(id, false); // soft delete
      triggerRefresh();

      showToast('Transaction deleted', 'info', {
        type: 'restore_transaction',
        id
      });
    } catch (err) {
      showToast(err.message || 'Failed to delete transaction', 'error');
    }
  };

  // Undo deletion
  const handleUndo = async (action) => {
    if (action.type === 'restore_transaction') {
      try {
        await api.restoreTransaction(action.id);
        triggerRefresh();
        showToast('Transaction restored ✓', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to undo deletion', 'error');
      }
    }
  };

  const handleTransactionSaved = (transaction, actionType) => {
    triggerRefresh();
    showToast(
      actionType === 'updated' ? 'Transaction updated ✓' : `${transaction.type} recorded ✓`,
      'success'
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900">
      
      {/* NAVIGATION (SIDEBAR ON DESKTOP, BOTTOM BAR ON MOBILE) */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddModal={handleOpenAddModal}
        currency={currency}
      />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0 px-4 py-5 sm:px-8 sm:py-7 max-w-7xl mx-auto w-full">
        {activeTab === 'dashboard' && (
          <DashboardView
            onOpenAddModal={handleOpenAddModal}
            onNavigateTo={setActiveTab}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            currency={currency}
            refreshTrigger={refreshTrigger}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            categories={categories}
            paymentMethods={paymentMethods}
            onOpenAddModal={handleOpenAddModal}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            currency={currency}
            refreshTrigger={refreshTrigger}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            categories={categories}
            currency={currency}
            refreshTrigger={refreshTrigger}
          />
        )}

        {activeTab === 'recurring' && (
          <RecurringView
            categories={categories}
            onOpenAddModal={handleOpenAddModal}
            currency={currency}
            refreshTrigger={refreshTrigger}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            categories={categories}
            paymentMethods={paymentMethods}
            onCategoriesUpdated={() => {
              loadInitialData();
              triggerRefresh();
            }}
            currency={currency}
            onCurrencyUpdated={async (newCurr) => {
              setCurrency(newCurr);
              await api.saveSettings({ currency_symbol: newCurr });
            }}
          />
        )}
      </main>

      {/* TRANSACTION INPUT MODAL */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialType={modalType}
        editTransaction={editingTransaction}
        categories={categories}
        paymentMethods={paymentMethods}
        onSaved={handleTransactionSaved}
        currency={currency}
      />

      {/* FLOATING TOAST NOTIFICATION WITH UNDO */}
      <Toast
        toast={toast}
        onClose={() => setToast(null)}
        onUndo={handleUndo}
      />
    </div>
  );
}
