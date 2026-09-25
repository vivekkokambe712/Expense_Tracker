import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server/index.js';
import db, { initDb } from '../server/database/db.js';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
  getTransactions,
  searchAutocompleteItems
} from '../server/services/transactionService.js';
import {
  getFinancialSummary,
  getCategoryBreakdown,
  getItemBreakdown,
  getFrequentItems,
  detectRecurringExpenses
} from '../server/services/analyticsService.js';

describe('Expense & Profit Tracker - Master Test Suite', () => {
  let homeExpCatId, bizExpCatId, bizIncCatId;
  let grocerySubId, rawMaterialSubId, printingSubId;
  let cashMethodId, upiMethodId;

  beforeAll(() => {
    initDb();
    const categories = db.prepare('SELECT * FROM categories').all();
    const subcategories = db.prepare('SELECT * FROM subcategories').all();
    const methods = db.prepare('SELECT * FROM payment_methods').all();

    homeExpCatId = categories.find(c => c.name === 'Home Expense')?.id;
    bizExpCatId = categories.find(c => c.name === 'Business Expense')?.id;
    bizIncCatId = categories.find(c => c.name === 'Business Income')?.id;

    grocerySubId = subcategories.find(s => s.name === 'Grocery' && s.category_id === homeExpCatId)?.id;
    rawMaterialSubId = subcategories.find(s => s.name === 'Raw Material' && s.category_id === bizExpCatId)?.id;
    printingSubId = subcategories.find(s => s.name === 'Printing Orders' && s.category_id === bizIncCatId)?.id;

    cashMethodId = methods.find(m => m.name === 'Cash')?.id;
    upiMethodId = methods.find(m => m.name === 'UPI')?.id;
  });

  beforeEach(() => {
    // Clear transactions and items before each test to guarantee test isolation
    db.prepare('DELETE FROM transactions').run();
    db.prepare('DELETE FROM items').run();
    db.prepare('DELETE FROM recurring_rules').run();
  });

  // 1. Transaction Calculations Test
  it('calculates Income = ₹10,000, Expense = ₹4,000, Net = ₹6,000 correctly', () => {
    createTransaction({
      type: 'Income',
      category_id: bizIncCatId,
      subcategory_id: printingSubId,
      item_name: 'Printing Order ABC',
      amount: 10000,
      transaction_date: '2026-09-24',
      payment_method_id: upiMethodId
    });

    createTransaction({
      type: 'Expense',
      category_id: bizExpCatId,
      subcategory_id: rawMaterialSubId,
      item_name: 'Paper A4',
      amount: 4000,
      transaction_date: '2026-09-24',
      payment_method_id: cashMethodId
    });

    const summary = getFinancialSummary('Custom', '2026-09-01', '2026-09-30');
    expect(summary.currentPeriod.totalIncome).toBe(10000);
    expect(summary.currentPeriod.totalExpense).toBe(4000);
    expect(summary.currentPeriod.netProfit).toBe(6000);
  });

  // 2. Business Net vs Household Spending Separation Test
  it('separates Business Net from Home Expenses properly', () => {
    // Business Income: ₹80,000
    createTransaction({
      type: 'Income',
      category_id: bizIncCatId,
      subcategory_id: printingSubId,
      item_name: 'Bulk Catalogues',
      amount: 80000,
      transaction_date: '2026-09-24'
    });

    // Business Expense: ₹30,000
    createTransaction({
      type: 'Expense',
      category_id: bizExpCatId,
      subcategory_id: rawMaterialSubId,
      item_name: 'Cardstock Paper',
      amount: 30000,
      transaction_date: '2026-09-24'
    });

    // Home Expense: ₹18,000
    createTransaction({
      type: 'Expense',
      category_id: homeExpCatId,
      subcategory_id: grocerySubId,
      item_name: 'Monthly Grocery & Vegetables',
      amount: 18000,
      transaction_date: '2026-09-24'
    });

    const summary = getFinancialSummary('Custom', '2026-09-01', '2026-09-30');
    expect(summary.currentPeriod.businessIncome).toBe(80000);
    expect(summary.currentPeriod.businessExpense).toBe(30000);
    expect(summary.currentPeriod.businessNet).toBe(50000);
    expect(summary.currentPeriod.homeExpense).toBe(18000);
    expect(summary.currentPeriod.remaining).toBe(32000);
  });

  // 3. Category & Subcategory Aggregation Test
  it('aggregates category expenses: Grocery ₹100 + ₹200 + ₹300 = ₹600', () => {
    createTransaction({
      type: 'Expense',
      category_id: homeExpCatId,
      subcategory_id: grocerySubId,
      item_name: 'Item 1',
      amount: 100,
      transaction_date: '2026-09-24'
    });
    createTransaction({
      type: 'Expense',
      category_id: homeExpCatId,
      subcategory_id: grocerySubId,
      item_name: 'Item 2',
      amount: 200,
      transaction_date: '2026-09-24'
    });
    createTransaction({
      type: 'Expense',
      category_id: homeExpCatId,
      subcategory_id: grocerySubId,
      item_name: 'Item 3',
      amount: 300,
      transaction_date: '2026-09-24'
    });

    const breakdown = getCategoryBreakdown('2026-09-01', '2026-09-30', 'Expense');
    expect(breakdown.grandTotal).toBe(600);

    const homeCat = breakdown.categories.find(c => c.id === homeExpCatId);
    expect(homeCat).toBeDefined();
    expect(homeCat.total).toBe(600);

    const grocerySub = homeCat.subcategories.find(s => s.id === grocerySubId);
    expect(grocerySub).toBeDefined();
    expect(grocerySub.total).toBe(600);
  });

  // 4. Item-Level Aggregation Test
  it('aggregates item expenses: Chicken ₹300 + ₹350 + ₹400 = ₹1,050', () => {
    createTransaction({
      type: 'Expense',
      category_id: homeExpCatId,
      subcategory_id: grocerySubId,
      item_name: 'Chicken',
      amount: 300,
      transaction_date: '2026-09-20'
    });
    createTransaction({
      type: 'Expense',
      category_id: homeExpCatId,
      subcategory_id: grocerySubId,
      item_name: 'Chicken',
      amount: 350,
      transaction_date: '2026-09-22'
    });
    createTransaction({
      type: 'Expense',
      category_id: homeExpCatId,
      subcategory_id: grocerySubId,
      item_name: 'Chicken',
      amount: 400,
      transaction_date: '2026-09-24'
    });

    const items = getItemBreakdown('2026-09-01', '2026-09-30', homeExpCatId, grocerySubId);
    const chicken = items.find(i => i.item_name.toLowerCase() === 'chicken');
    expect(chicken).toBeDefined();
    expect(chicken.total_amount).toBe(1050);
    expect(chicken.purchase_count).toBe(3);
    expect(chicken.avg_amount).toBe(350);
  });

  // 5. Date Filtering Test
  it('excludes transactions outside the date range', () => {
    createTransaction({
      type: 'Expense',
      category_id: homeExpCatId,
      subcategory_id: grocerySubId,
      item_name: 'In Range',
      amount: 500,
      transaction_date: '2026-09-15'
    });
    createTransaction({
      type: 'Expense',
      category_id: homeExpCatId,
      subcategory_id: grocerySubId,
      item_name: 'Out of Range',
      amount: 900,
      transaction_date: '2026-08-10'
    });

    const filtered = getTransactions({
      startDate: '2026-09-01',
      endDate: '2026-09-30'
    });

    expect(filtered.items.length).toBe(1);
    expect(filtered.items[0].item_name).toBe('In Range');
    expect(filtered.aggregates.totalExpense).toBe(500);
  });

  // 6. Autocomplete and Frequency Ranking Test
  it('ranks frequently used items higher in autocomplete suggestions', () => {
    // Chicken: 5 purchases
    for (let i = 0; i < 5; i++) {
      createTransaction({
        type: 'Expense',
        category_id: homeExpCatId,
        subcategory_id: grocerySubId,
        item_name: 'Chicken',
        amount: 350,
        transaction_date: '2026-09-24'
      });
    }

    // Charger: 1 purchase
    createTransaction({
      type: 'Expense',
      category_id: homeExpCatId,
      subcategory_id: grocerySubId,
      item_name: 'Charger',
      amount: 500,
      transaction_date: '2026-09-24'
    });

    const suggestions = searchAutocompleteItems('ch');
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    expect(suggestions[0].name).toBe('Chicken');
    expect(suggestions[0].usage_count).toBe(5);
    expect(suggestions[1].name).toBe('Charger');
  });

  // 7. Editing Transaction Updates Analytics Test
  it('updates analytics when a transaction is edited from ₹300 to ₹500', () => {
    const tx = createTransaction({
      type: 'Expense',
      category_id: homeExpCatId,
      subcategory_id: grocerySubId,
      item_name: 'Chicken',
      amount: 300,
      transaction_date: '2026-09-24'
    });

    let summary = getFinancialSummary('Custom', '2026-09-01', '2026-09-30');
    expect(summary.currentPeriod.totalExpense).toBe(300);

    updateTransaction(tx.id, { amount: 500 });

    summary = getFinancialSummary('Custom', '2026-09-01', '2026-09-30');
    expect(summary.currentPeriod.totalExpense).toBe(500);
  });

  // 8. Soft Delete and Undo / Restore Test
  it('soft deletes a transaction and properly undoes / restores it', () => {
    const tx = createTransaction({
      type: 'Expense',
      category_id: homeExpCatId,
      subcategory_id: grocerySubId,
      item_name: 'Milk',
      amount: 60,
      transaction_date: '2026-09-24'
    });

    let summary = getFinancialSummary('Custom', '2026-09-01', '2026-09-30');
    expect(summary.currentPeriod.totalExpense).toBe(60);

    // Soft delete
    deleteTransaction(tx.id, true);

    summary = getFinancialSummary('Custom', '2026-09-01', '2026-09-30');
    expect(summary.currentPeriod.totalExpense).toBe(0);

    // Restore (Undo)
    restoreTransaction(tx.id);

    summary = getFinancialSummary('Custom', '2026-09-01', '2026-09-30');
    expect(summary.currentPeriod.totalExpense).toBe(60);
  });

  // 9. Recurring Expense Detection Test
  it('detects periodic recurring expenses based on historical intervals', () => {
    // Simulate WiFi bills ~90 days apart
    createTransaction({
      type: 'Expense',
      category_id: bizExpCatId,
      subcategory_id: rawMaterialSubId,
      item_name: 'Office Highspeed WiFi',
      amount: 1200,
      transaction_date: '2026-03-20'
    });
    createTransaction({
      type: 'Expense',
      category_id: bizExpCatId,
      subcategory_id: rawMaterialSubId,
      item_name: 'Office Highspeed WiFi',
      amount: 1200,
      transaction_date: '2026-06-20'
    });
    createTransaction({
      type: 'Expense',
      category_id: bizExpCatId,
      subcategory_id: rawMaterialSubId,
      item_name: 'Office Highspeed WiFi',
      amount: 1200,
      transaction_date: '2026-09-20'
    });

    const candidates = detectRecurringExpenses();
    const wifiCandidate = candidates.find(c => c.item_name === 'Office Highspeed WiFi');
    expect(wifiCandidate).toBeDefined();
    expect(wifiCandidate.expected_amount).toBe(1200);
    expect(wifiCandidate.frequency_label).toContain('Quarterly');
  });

  // 10. API Integration & Export Tests
  it('exports transactions accurately in CSV format via API', async () => {
    createTransaction({
      type: 'Expense',
      category_id: homeExpCatId,
      subcategory_id: grocerySubId,
      item_name: 'Rice Basmati',
      amount: 1200,
      transaction_date: '2026-09-24',
      payment_method_id: upiMethodId,
      notes: '5kg bag'
    });

    const res = await request(app).get('/api/export/csv');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Rice Basmati');
    expect(res.text).toContain('1200');
    expect(res.text).toContain('Home Expense');
  });

  it('exports complete structured JSON backup and restores it via API', async () => {
    createTransaction({
      type: 'Income',
      category_id: bizIncCatId,
      subcategory_id: printingSubId,
      item_name: 'Visiting Cards 1000',
      amount: 2500,
      transaction_date: '2026-09-24'
    });

    const exportRes = await request(app).get('/api/export/json');
    expect(exportRes.status).toBe(200);
    const backupJson = exportRes.body;
    expect(backupJson.data.transactions.length).toBe(1);

    // Clear db
    db.prepare('DELETE FROM transactions').run();
    expect(db.prepare('SELECT COUNT(*) as c FROM transactions').get().c).toBe(0);

    // Restore from backup
    const restoreRes = await request(app)
      .post('/api/backup/restore')
      .send({ data: backupJson.data });
    expect(restoreRes.status).toBe(200);
    expect(db.prepare('SELECT COUNT(*) as c FROM transactions').get().c).toBe(1);
  });

  // 11. Edge Cases & Validation Tests
  it('rejects invalid amounts (negative, zero, or non-numeric)', () => {
    expect(() => {
      createTransaction({
        type: 'Expense',
        category_id: homeExpCatId,
        amount: -500,
        item_name: 'Invalid Negative'
      });
    }).toThrow();

    expect(() => {
      createTransaction({
        type: 'Expense',
        category_id: homeExpCatId,
        amount: 0,
        item_name: 'Invalid Zero'
      });
    }).toThrow();

    expect(() => {
      createTransaction({
        type: 'Expense',
        category_id: homeExpCatId,
        amount: 'abc',
        item_name: 'Invalid String'
      });
    }).toThrow();
  });
});
