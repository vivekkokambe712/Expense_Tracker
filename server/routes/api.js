import express from 'express';
import db from '../database/db.js';
import {
  createTransaction,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
  getTransactions,
  searchAutocompleteItems
} from '../services/transactionService.js';
import {
  getFinancialSummary,
  getCategoryBreakdown,
  getItemBreakdown,
  getFrequentItems,
  getSpendingTrends,
  getMonthlyFinancialSummary,
  getPaymentMethodBreakdown,
  detectRecurringExpenses
} from '../services/analyticsService.js';

const router = express.Router();

// ==========================================
// TRANSACTIONS
// ==========================================

router.get('/transactions', (req, res) => {
  try {
    const data = getTransactions(req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to retrieve transactions' });
  }
});

router.post('/transactions', (req, res) => {
  try {
    const transaction = createTransaction(req.body);
    res.status(201).json({
      message: 'Transaction saved successfully',
      transaction
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to create transaction' });
  }
});

router.get('/transactions/:id', (req, res) => {
  try {
    const transaction = getTransactionById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch transaction' });
  }
});

router.patch('/transactions/:id', (req, res) => {
  try {
    const updated = updateTransaction(req.params.id, req.body);
    res.json({
      message: 'Transaction updated successfully',
      transaction: updated
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update transaction' });
  }
});

router.delete('/transactions/:id', (req, res) => {
  try {
    const isPermanent = req.query.permanent === 'true';
    const success = deleteTransaction(req.params.id, !isPermanent);
    if (!success) {
      return res.status(404).json({ error: 'Transaction not found or already deleted' });
    }
    res.json({ message: 'Transaction deleted successfully', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete transaction' });
  }
});

router.post('/transactions/:id/restore', (req, res) => {
  try {
    const restored = restoreTransaction(req.params.id);
    if (!restored) {
      return res.status(404).json({ error: 'Transaction not found or not deleted' });
    }
    res.json({
      message: 'Transaction restored successfully',
      transaction: restored
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to restore transaction' });
  }
});

// ==========================================
// CATEGORIES & SUBCATEGORIES
// ==========================================

router.get('/categories', (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const whereClause = includeArchived ? '' : 'WHERE is_active = 1';

    const categories = db.prepare(`SELECT * FROM categories ${whereClause} ORDER BY type, name`).all();
    const subcategories = db.prepare(`SELECT * FROM subcategories ${whereClause} ORDER BY name`).all();

    const result = categories.map(cat => ({
      ...cat,
      subcategories: subcategories.filter(sub => sub.category_id === cat.id)
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch categories' });
  }
});

router.post('/categories', (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    if (!['Expense', 'Income'].includes(type)) {
      return res.status(400).json({ error: 'Category type must be Expense or Income' });
    }

    const info = db.prepare('INSERT INTO categories (name, type) VALUES (?, ?)').run(name.trim(), type);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ message: 'Category created', category: { ...category, subcategories: [] } });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create category' });
  }
});

router.patch('/categories/:id', (req, res) => {
  try {
    const { name, is_active } = req.body;
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    db.prepare(`
      UPDATE categories
      SET name = COALESCE(?, name),
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(name !== undefined ? name.trim() : null, is_active !== undefined ? is_active : null, req.params.id);

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    res.json({ message: 'Category updated', category: updated });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update category' });
  }
});

router.delete('/categories/:id', (req, res) => {
  try {
    // Soft delete / archive to protect historical transactions
    db.prepare('UPDATE categories SET is_active = 0, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(req.params.id);
    res.json({ message: 'Category archived successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to archive category' });
  }
});

router.post('/categories/:id/subcategories', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Subcategory name is required' });
    }

    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    const info = db.prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)').run(req.params.id, name.trim());
    const subcategory = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ message: 'Subcategory added', subcategory });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to add subcategory' });
  }
});

router.patch('/subcategories/:id', (req, res) => {
  try {
    const { name, is_active } = req.body;
    db.prepare(`
      UPDATE subcategories
      SET name = COALESCE(?, name),
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(name !== undefined ? name.trim() : null, is_active !== undefined ? is_active : null, req.params.id);

    const sub = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(req.params.id);
    res.json({ message: 'Subcategory updated', subcategory: sub });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update subcategory' });
  }
});

router.delete('/subcategories/:id', (req, res) => {
  try {
    db.prepare('UPDATE subcategories SET is_active = 0, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(req.params.id);
    res.json({ message: 'Subcategory archived' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to archive subcategory' });
  }
});

// ==========================================
// ITEMS & AUTOCOMPLETE INTELLIGENCE
// ==========================================

router.get('/items', (req, res) => {
  try {
    const { q, category_id } = req.query;
    const items = searchAutocompleteItems(q, category_id ? Number(category_id) : null);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to search items' });
  }
});

// ==========================================
// PAYMENT METHODS
// ==========================================

router.get('/payment-methods', (req, res) => {
  try {
    const methods = db.prepare('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY id ASC').all();
    res.json(methods);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch payment methods' });
  }
});

router.post('/payment-methods', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    const info = db.prepare('INSERT INTO payment_methods (name) VALUES (?)').run(name.trim());
    const pm = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ message: 'Payment method created', paymentMethod: pm });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to add payment method' });
  }
});

// ==========================================
// ANALYTICS
// ==========================================

router.get('/analytics/summary', (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const summary = getFinancialSummary(period, startDate, endDate);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate financial summary' });
  }
});

router.get('/analytics/categories', (req, res) => {
  try {
    const { startDate, endDate, type = 'Expense' } = req.query;
    const breakdown = getCategoryBreakdown(startDate, endDate, type);
    res.json(breakdown);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch category breakdown' });
  }
});

router.get('/analytics/items', (req, res) => {
  try {
    const { startDate, endDate, categoryId, subcategoryId, limit } = req.query;
    const items = getItemBreakdown(startDate, endDate, categoryId, subcategoryId, limit ? Number(limit) : 20);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch item breakdown' });
  }
});

router.get('/analytics/frequent-items', (req, res) => {
  try {
    const { sortBy = 'frequency', limit = 20 } = req.query;
    const items = getFrequentItems(sortBy, Number(limit));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch frequent items' });
  }
});

router.get('/analytics/trends', (req, res) => {
  try {
    const { timeframe = 'monthly' } = req.query;
    const trends = getSpendingTrends(timeframe);
    res.json(trends);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch trends' });
  }
});

router.get('/analytics/monthly-summary', (req, res) => {
  try {
    const monthly = getMonthlyFinancialSummary();
    res.json(monthly);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch monthly summary' });
  }
});

router.get('/analytics/payment-methods', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const breakdown = getPaymentMethodBreakdown(startDate, endDate);
    res.json(breakdown);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch payment method analytics' });
  }
});

// ==========================================
// RECURRING EXPENSE DETECTION & RULES
// ==========================================

router.get('/recurring/detect', (req, res) => {
  try {
    const suggestions = detectRecurringExpenses();
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to detect recurring expenses' });
  }
});

router.get('/recurring', (req, res) => {
  try {
    const rules = db.prepare(`
      SELECT
        r.*,
        c.name AS category_name,
        s.name AS subcategory_name
      FROM recurring_rules r
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN subcategories s ON r.subcategory_id = s.id
      ORDER BY r.next_due_date ASC
    `).all();
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch recurring rules' });
  }
});

router.post('/recurring', (req, res) => {
  try {
    const {
      name,
      type = 'Expense',
      category_id,
      subcategory_id,
      item_name,
      expected_amount,
      frequency_days,
      frequency_label,
      next_due_date
    } = req.body;

    if (!item_name || !expected_amount || !frequency_days) {
      return res.status(400).json({ error: 'Item name, expected amount, and frequency are required' });
    }

    const info = db.prepare(`
      INSERT INTO recurring_rules (
        name, type, category_id, subcategory_id, item_name,
        expected_amount, frequency_days, frequency_label, next_due_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name || item_name,
      type,
      category_id || null,
      subcategory_id || null,
      item_name,
      expected_amount,
      frequency_days,
      frequency_label || `Every ${frequency_days} days`,
      next_due_date || new Date().toISOString().split('T')[0]
    );

    const rule = db.prepare('SELECT * FROM recurring_rules WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ message: 'Recurring rule created', rule });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create recurring rule' });
  }
});

router.delete('/recurring/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM recurring_rules WHERE id = ?').run(req.params.id);
    res.json({ message: 'Recurring rule deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete recurring rule' });
  }
});

// ==========================================
// EXPORTS & BACKUP
// ==========================================

router.get('/export/csv', (req, res) => {
  try {
    const txs = db.prepare(`
      SELECT
        t.id,
        t.transaction_date,
        t.type,
        c.name AS category,
        COALESCE(s.name, '') AS subcategory,
        t.item_name,
        t.amount,
        COALESCE(p.name, '') AS payment_method,
        COALESCE(t.notes, '') AS notes,
        COALESCE(t.tags, '') AS tags,
        COALESCE(t.vendor_or_customer, '') AS vendor_or_customer,
        t.created_at
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN subcategories s ON t.subcategory_id = s.id
      LEFT JOIN payment_methods p ON t.payment_method_id = p.id
      WHERE t.deleted_at IS NULL
      ORDER BY t.transaction_date DESC, t.id DESC
    `).all();

    const headers = ['ID', 'Date', 'Type', 'Category', 'Subcategory', 'Item', 'Amount', 'Payment Method', 'Notes', 'Tags', 'Vendor/Customer', 'Created At'];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLines = [headers.join(',')];
    for (const tx of txs) {
      csvLines.push([
        tx.id,
        escapeCsv(tx.transaction_date),
        escapeCsv(tx.type),
        escapeCsv(tx.category),
        escapeCsv(tx.subcategory),
        escapeCsv(tx.item_name),
        tx.amount,
        escapeCsv(tx.payment_method),
        escapeCsv(tx.notes),
        escapeCsv(tx.tags),
        escapeCsv(tx.vendor_or_customer),
        escapeCsv(tx.created_at)
      ].join(','));
    }

    const csvContent = csvLines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to export CSV' });
  }
});

router.get('/export/json', (req, res) => {
  try {
    const transactions = db.prepare('SELECT * FROM transactions WHERE deleted_at IS NULL').all();
    const categories = db.prepare('SELECT * FROM categories').all();
    const subcategories = db.prepare('SELECT * FROM subcategories').all();
    const items = db.prepare('SELECT * FROM items').all();
    const paymentMethods = db.prepare('SELECT * FROM payment_methods').all();
    const recurringRules = db.prepare('SELECT * FROM recurring_rules').all();
    const settings = db.prepare('SELECT * FROM settings').all();

    const backupData = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        transactions,
        categories,
        subcategories,
        items,
        paymentMethods,
        recurringRules,
        settings
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="expense_tracker_backup_${new Date().toISOString().split('T')[0]}.json"`);
    res.json(backupData);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to export JSON' });
  }
});

router.post('/backup/restore', (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !data.transactions) {
      return res.status(400).json({ error: 'Invalid backup JSON data structure' });
    }

    db.exec('PRAGMA foreign_keys = OFF;');
    try {
      const restoreTx = db.transaction(() => {
        // Clear current tables
        db.prepare('DELETE FROM transactions').run();
        db.prepare('DELETE FROM recurring_rules').run();
        db.prepare('DELETE FROM items').run();
        db.prepare('DELETE FROM subcategories').run();
        db.prepare('DELETE FROM categories').run();

        // Restore categories
        if (data.categories && data.categories.length > 0) {
          const insertCat = db.prepare('INSERT INTO categories (id, name, type, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
          for (const c of data.categories) {
            insertCat.run(c.id, c.name, c.type, c.is_active ?? 1, c.created_at || new Date().toISOString(), c.updated_at || new Date().toISOString());
          }
        }

        // Restore subcategories
        if (data.subcategories && data.subcategories.length > 0) {
          const insertSub = db.prepare('INSERT INTO subcategories (id, category_id, name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
          for (const s of data.subcategories) {
            insertSub.run(s.id, s.category_id, s.name, s.is_active ?? 1, s.created_at || new Date().toISOString(), s.updated_at || new Date().toISOString());
          }
        }

        // Restore items
        if (data.items && data.items.length > 0) {
          const insertItem = db.prepare(`
            INSERT INTO items (id, name, default_category_id, default_subcategory_id, usage_count, last_used_at, last_amount, average_amount, first_used_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const i of data.items) {
            insertItem.run(i.id, i.name, i.default_category_id, i.default_subcategory_id, i.usage_count, i.last_used_at, i.last_amount, i.average_amount, i.first_used_at, i.created_at, i.updated_at);
          }
        }

        // Restore transactions
        if (data.transactions && data.transactions.length > 0) {
          const insertTx = db.prepare(`
            INSERT INTO transactions (id, type, category_id, subcategory_id, item_name, item_id, amount, transaction_date, payment_method_id, notes, tags, vendor_or_customer, deleted_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const t of data.transactions) {
            insertTx.run(t.id, t.type, t.category_id, t.subcategory_id, t.item_name, t.item_id, t.amount, t.transaction_date, t.payment_method_id, t.notes, t.tags, t.vendor_or_customer, t.deleted_at, t.created_at, t.updated_at);
          }
        }

        // Restore recurring rules
        if (data.recurringRules && data.recurringRules.length > 0) {
          const insertRule = db.prepare(`
            INSERT INTO recurring_rules (id, name, type, category_id, subcategory_id, item_name, expected_amount, frequency_days, frequency_label, last_occurred_date, next_due_date, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const r of data.recurringRules) {
            insertRule.run(r.id, r.name, r.type, r.category_id, r.subcategory_id, r.item_name, r.expected_amount, r.frequency_days, r.frequency_label, r.last_occurred_date, r.next_due_date, r.is_active ?? 1, r.created_at);
          }
        }
      });

      restoreTx();
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }

    res.json({ message: 'Backup restored successfully' });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: err.message || 'Failed to restore backup' });
  }
});

// ==========================================
// SETTINGS
// ==========================================

router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch settings' });
  }
});

router.post('/settings', (req, res) => {
  try {
    const update = db.transaction(() => {
      const upsert = db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
      for (const [k, v] of Object.entries(req.body)) {
        upsert.run(k, String(v));
      }
    });
    update();
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save settings' });
  }
});

export default router;
