const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  const response = await fetch(url, config);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  getInitialMetadata: () => request('/metadata'),

  // Summary
  getSummary: (period, startDate, endDate) => {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return request(`/analytics/summary?${params.toString()}`);
  },

  // Transactions
  getTransactions: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, val);
      }
    });
    return request(`/transactions?${params.toString()}`);
  },

  getTransactionById: (id) => request(`/transactions/${id}`),

  createTransaction: (data) =>
    request('/transactions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateTransaction: (id, data) =>
    request(`/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  deleteTransaction: (id, permanent = false) =>
    request(`/transactions/${id}?permanent=${permanent}`, {
      method: 'DELETE'
    }),

  restoreTransaction: (id) =>
    request(`/transactions/${id}/restore`, {
      method: 'POST'
    }),

  // Categories & Subcategories
  getCategories: (includeArchived = false) =>
    request(`/categories?includeArchived=${includeArchived}`),

  createCategory: (data) =>
    request('/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateCategory: (id, data) =>
    request(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  deleteCategory: (id) =>
    request(`/categories/${id}`, {
      method: 'DELETE'
    }),

  addSubcategory: (categoryId, name) =>
    request(`/categories/${categoryId}/subcategories`, {
      method: 'POST',
      body: JSON.stringify({ name })
    }),

  updateSubcategory: (id, data) =>
    request(`/subcategories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  deleteSubcategory: (id) =>
    request(`/subcategories/${id}`, {
      method: 'DELETE'
    }),

  // Item Intelligence & Autocomplete
  searchItems: (q = '', category_id = null) => {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (category_id) params.append('category_id', category_id);
    return request(`/items?${params.toString()}`);
  },

  // Payment Methods
  getPaymentMethods: () => request('/payment-methods'),
  addPaymentMethod: (name) =>
    request('/payment-methods', {
      method: 'POST',
      body: JSON.stringify({ name })
    }),

  // Analytics
  getCategoryBreakdown: (startDate, endDate, type = 'Expense') =>
    request(`/analytics/categories?startDate=${startDate}&endDate=${endDate}&type=${type}`),

  getItemBreakdown: (startDate, endDate, categoryId = '', subcategoryId = '') => {
    const params = new URLSearchParams({ startDate, endDate });
    if (categoryId) params.append('categoryId', categoryId);
    if (subcategoryId) params.append('subcategoryId', subcategoryId);
    return request(`/analytics/items?${params.toString()}`);
  },

  getFrequentItems: (sortBy = 'frequency', limit = 20) =>
    request(`/analytics/frequent-items?sortBy=${sortBy}&limit=${limit}`),

  getTrends: (timeframe = 'monthly') =>
    request(`/analytics/trends?timeframe=${timeframe}`),

  getMonthlySummary: () => request('/analytics/monthly-summary'),

  getPaymentMethodBreakdown: (startDate, endDate) =>
    request(`/analytics/payment-methods?startDate=${startDate}&endDate=${endDate}`),

  // Recurring detection & rules
  detectRecurring: () => request('/recurring/detect'),
  getRecurringRules: () => request('/recurring'),
  createRecurringRule: (data) =>
    request('/recurring', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  deleteRecurringRule: (id) =>
    request(`/recurring/${id}`, {
      method: 'DELETE'
    }),

  // Settings
  getSettings: () => request('/settings'),
  saveSettings: (data) =>
    request('/settings', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Export URLs & Backup Restore
  csvExportUrl: `${BASE_URL}/export/csv`,
  jsonExportUrl: `${BASE_URL}/export/json`,
  restoreBackup: (backupData) =>
    request('/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ data: backupData })
    })
};
