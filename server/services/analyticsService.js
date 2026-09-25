import db from '../database/db.js';

/**
 * Get date ranges for standard periods
 */
export function getDateRange(period, customStart = null, customEnd = null) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();

  const toYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  };

  if (period === 'Today') {
    const todayStr = toYMD(now);
    return { startDate: todayStr, endDate: todayStr };
  } else if (period === 'This Week') {
    // Current week starting Monday
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(year, month, day - distanceToMonday);
    const sunday = new Date(year, month, day - distanceToMonday + 6);
    return { startDate: toYMD(monday), endDate: toYMD(sunday) };
  } else if (period === 'This Month') {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { startDate: toYMD(firstDay), endDate: toYMD(lastDay) };
  } else if (period === 'Last Month') {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    return { startDate: toYMD(firstDay), endDate: toYMD(lastDay) };
  } else if (period === 'This Year') {
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  } else if (period === 'Custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }

  // Default: This Month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return { startDate: toYMD(firstDay), endDate: toYMD(lastDay) };
}

/**
 * Section 3 & 15 & 16: Summary with Business vs Household separation
 */
export function getFinancialSummary(period = 'This Month', customStart = null, customEnd = null) {
  const { startDate, endDate } = getDateRange(period, customStart, customEnd);

  // Today metrics
  const today = new Date().toISOString().split('T')[0];
  const todaySummary = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END), 0) AS expense
    FROM transactions
    WHERE transaction_date = ? AND deleted_at IS NULL
  `).get(today);

  // Period metrics
  const periodSummary = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN t.type = 'Income' THEN t.amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN t.type = 'Expense' THEN t.amount ELSE 0 END), 0) AS total_expense,
      -- Business vs Home
      COALESCE(SUM(CASE WHEN t.type = 'Income' AND c.name = 'Business Income' THEN t.amount ELSE 0 END), 0) AS business_income,
      COALESCE(SUM(CASE WHEN t.type = 'Income' AND c.name != 'Business Income' THEN t.amount ELSE 0 END), 0) AS other_income,
      COALESCE(SUM(CASE WHEN t.type = 'Expense' AND c.name = 'Business Expense' THEN t.amount ELSE 0 END), 0) AS business_expense,
      COALESCE(SUM(CASE WHEN t.type = 'Expense' AND c.name = 'Home Expense' THEN t.amount ELSE 0 END), 0) AS home_expense,
      COALESCE(SUM(CASE WHEN t.type = 'Expense' AND c.name NOT IN ('Business Expense', 'Home Expense') THEN t.amount ELSE 0 END), 0) AS other_expense
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.transaction_date >= ? AND t.transaction_date <= ? AND t.deleted_at IS NULL
  `).get(startDate, endDate);

  // Calculate Previous Period for Comparison
  const currentDays = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1);
  const prevEnd = new Date(new Date(startDate).getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - (currentDays - 1) * 24 * 60 * 60 * 1000);
  const prevStartStr = prevStart.toISOString().split('T')[0];
  const prevEndStr = prevEnd.toISOString().split('T')[0];

  const prevSummary = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END), 0) AS total_expense
    FROM transactions
    WHERE transaction_date >= ? AND transaction_date <= ? AND deleted_at IS NULL
  `).get(prevStartStr, prevEndStr);

  const totalIncome = periodSummary.total_income;
  const totalExpense = periodSummary.total_expense;
  const netProfit = totalIncome - totalExpense;

  const businessIncome = periodSummary.business_income;
  const businessExpense = periodSummary.business_expense;
  const businessNet = businessIncome - businessExpense;
  const homeExpense = periodSummary.home_expense;
  const remaining = businessNet - homeExpense;

  return {
    period,
    startDate,
    endDate,
    today: {
      income: todaySummary.income,
      expense: todaySummary.expense,
      net: todaySummary.income - todaySummary.expense
    },
    currentPeriod: {
      totalIncome,
      totalExpense,
      netProfit,
      businessIncome,
      businessExpense,
      businessNet,
      homeExpense,
      otherIncome: periodSummary.other_income,
      otherExpense: periodSummary.other_expense,
      remaining
    },
    comparison: {
      prevStartDate: prevStartStr,
      prevEndDate: prevEndStr,
      prevIncome: prevSummary.total_income,
      prevExpense: prevSummary.total_expense,
      prevNet: prevSummary.total_income - prevSummary.total_expense,
      incomeDiff: totalIncome - prevSummary.total_income,
      expenseDiff: totalExpense - prevSummary.total_expense,
      netDiff: netProfit - (prevSummary.total_income - prevSummary.total_expense)
    }
  };
}

/**
 * Section 21: Category Breakdown & Subcategories
 */
export function getCategoryBreakdown(startDate, endDate, type = 'Expense') {
  const rows = db.prepare(`
    SELECT
      c.id AS category_id,
      c.name AS category_name,
      s.id AS subcategory_id,
      COALESCE(s.name, 'Uncategorized') AS subcategory_name,
      SUM(t.amount) AS total_amount,
      COUNT(t.id) AS transaction_count
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    LEFT JOIN subcategories s ON t.subcategory_id = s.id
    WHERE t.type = ? AND t.transaction_date >= ? AND t.transaction_date <= ? AND t.deleted_at IS NULL
    GROUP BY c.id, s.id
    ORDER BY total_amount DESC
  `).all(type, startDate, endDate);

  // Group by category
  const categoriesMap = new Map();
  let grandTotal = 0;

  for (const r of rows) {
    grandTotal += r.total_amount;
    if (!categoriesMap.has(r.category_id)) {
      categoriesMap.set(r.category_id, {
        id: r.category_id,
        name: r.category_name,
        total: 0,
        count: 0,
        subcategories: []
      });
    }
    const cat = categoriesMap.get(r.category_id);
    cat.total += r.total_amount;
    cat.count += r.transaction_count;
    cat.subcategories.push({
      id: r.subcategory_id,
      name: r.subcategory_name,
      total: r.total_amount,
      count: r.transaction_count
    });
  }

  const result = Array.from(categoriesMap.values()).map(cat => ({
    ...cat,
    percentage: grandTotal > 0 ? Number(((cat.total / grandTotal) * 100).toFixed(1)) : 0,
    subcategories: cat.subcategories.map(sub => ({
      ...sub,
      percentage: cat.total > 0 ? Number(((sub.total / cat.total) * 100).toFixed(1)) : 0
    }))
  }));

  result.sort((a, b) => b.total - a.total);

  return {
    type,
    grandTotal,
    categories: result
  };
}

/**
 * Section 22: Item-Level Drilldown
 */
export function getItemBreakdown(startDate, endDate, categoryId = null, subcategoryId = null, limit = 20) {
  const conditions = [
    "t.type = 'Expense'",
    't.transaction_date >= ?',
    't.transaction_date <= ?',
    't.deleted_at IS NULL'
  ];
  const params = [startDate, endDate];

  if (categoryId) {
    conditions.push('t.category_id = ?');
    params.push(categoryId);
  }

  if (subcategoryId) {
    conditions.push('t.subcategory_id = ?');
    params.push(subcategoryId);
  }

  const sql = `
    SELECT
      t.item_name,
      c.name AS category_name,
      s.name AS subcategory_name,
      SUM(t.amount) AS total_amount,
      COUNT(t.id) AS purchase_count,
      AVG(t.amount) AS avg_amount,
      MAX(t.transaction_date) AS last_purchase_date
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    LEFT JOIN subcategories s ON t.subcategory_id = s.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY t.item_name, t.category_id, t.subcategory_id
    ORDER BY total_amount DESC
    LIMIT ?
  `;

  params.push(limit);
  const items = db.prepare(sql).all(...params);

  return items;
}

/**
 * Section 23: Frequent Items
 */
export function getFrequentItems(sortBy = 'frequency', limit = 20) {
  let orderClause = 'i.usage_count DESC, i.last_used_at DESC';
  if (sortBy === 'spending') {
    orderClause = 'total_spent DESC, i.usage_count DESC';
  } else if (sortBy === 'recent') {
    orderClause = 'i.last_used_at DESC';
  }

  const items = db.prepare(`
    SELECT
      i.id,
      i.name,
      i.usage_count,
      i.last_used_at,
      i.last_amount,
      i.average_amount,
      c.name AS category_name,
      s.name AS subcategory_name,
      COALESCE((
        SELECT SUM(amount)
        FROM transactions
        WHERE item_name = i.name AND type = 'Expense' AND deleted_at IS NULL
      ), 0) AS total_spent
    FROM items i
    LEFT JOIN categories c ON i.default_category_id = c.id
    LEFT JOIN subcategories s ON i.default_subcategory_id = s.id
    WHERE i.usage_count > 0
    ORDER BY ${orderClause}
    LIMIT ?
  `).all(limit);

  return items;
}

/**
 * Section 24: Spending Trends (Daily, Weekly, Monthly)
 */
export function getSpendingTrends(timeframe = 'monthly') {
  if (timeframe === 'daily') {
    // Last 30 days
    const days = db.prepare(`
      SELECT
        transaction_date AS date,
        COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END), 0) AS expense
      FROM transactions
      WHERE transaction_date >= date('now', '-30 days') AND deleted_at IS NULL
      GROUP BY transaction_date
      ORDER BY transaction_date ASC
    `).all();

    return days.map(d => ({
      ...d,
      net: d.income - d.expense
    }));
  } else if (timeframe === 'weekly') {
    // Last 12 weeks
    const weeks = db.prepare(`
      SELECT
        strftime('%Y-W%W', transaction_date) AS week,
        MIN(transaction_date) AS start_date,
        COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END), 0) AS expense
      FROM transactions
      WHERE transaction_date >= date('now', '-84 days') AND deleted_at IS NULL
      GROUP BY strftime('%Y-W%W', transaction_date)
      ORDER BY week ASC
    `).all();

    return weeks.map(w => ({
      ...w,
      net: w.income - w.expense
    }));
  } else {
    // Monthly (Last 12 months)
    const months = db.prepare(`
      SELECT
        strftime('%Y-%m', t.transaction_date) AS month,
        COALESCE(SUM(CASE WHEN t.type = 'Income' THEN t.amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN t.type = 'Expense' THEN t.amount ELSE 0 END), 0) AS expense,
        COALESCE(SUM(CASE WHEN t.type = 'Expense' AND c.name = 'Business Expense' THEN t.amount ELSE 0 END), 0) AS business_expense,
        COALESCE(SUM(CASE WHEN t.type = 'Expense' AND c.name = 'Home Expense' THEN t.amount ELSE 0 END), 0) AS home_expense
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.transaction_date >= date('now', '-12 months', 'start of month') AND t.deleted_at IS NULL
      GROUP BY strftime('%Y-%m', t.transaction_date)
      ORDER BY month ASC
    `).all();

    return months.map(m => ({
      ...m,
      net: m.income - m.expense,
      businessNet: (m.income) - m.business_expense
    }));
  }
}

/**
 * Section 25: Monthly Financial Summary (All historical months)
 */
export function getMonthlyFinancialSummary() {
  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m', t.transaction_date) AS month,
      COALESCE(SUM(CASE WHEN t.type = 'Income' THEN t.amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN t.type = 'Expense' AND c.name = 'Business Expense' THEN t.amount ELSE 0 END), 0) AS business_expenses,
      COALESCE(SUM(CASE WHEN t.type = 'Expense' AND c.name = 'Home Expense' THEN t.amount ELSE 0 END), 0) AS home_expenses,
      COALESCE(SUM(CASE WHEN t.type = 'Expense' THEN t.amount ELSE 0 END), 0) AS total_expenses
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.deleted_at IS NULL
    GROUP BY strftime('%Y-%m', t.transaction_date)
    ORDER BY month DESC
  `).all();

  return rows.map(r => ({
    ...r,
    business_net: r.income - r.business_expenses,
    net_profit: r.income - r.total_expenses,
    remaining: (r.income - r.business_expenses) - r.home_expenses
  }));
}

/**
 * Section 26: Payment Method Breakdown
 */
export function getPaymentMethodBreakdown(startDate, endDate) {
  return db.prepare(`
    SELECT
      COALESCE(p.name, 'Unspecified') AS payment_method,
      COALESCE(SUM(CASE WHEN t.type = 'Expense' THEN t.amount ELSE 0 END), 0) AS expense_amount,
      COALESCE(SUM(CASE WHEN t.type = 'Income' THEN t.amount ELSE 0 END), 0) AS income_amount,
      COUNT(t.id) AS count
    FROM transactions t
    LEFT JOIN payment_methods p ON t.payment_method_id = p.id
    WHERE t.transaction_date >= ? AND t.transaction_date <= ? AND t.deleted_at IS NULL
    GROUP BY p.name
    ORDER BY expense_amount DESC
  `).all(startDate, endDate);
}

/**
 * Section 12 & 69: Recurring Expense Detection Algorithm
 * Analyzes intervals between past transactions for each item to identify periodic patterns.
 */
export function detectRecurringExpenses() {
  // Query distinct items with at least 2 expense transactions
  const items = db.prepare(`
    SELECT
      item_name,
      category_id,
      subcategory_id,
      COUNT(id) AS tx_count,
      AVG(amount) AS avg_amount,
      MIN(amount) AS min_amount,
      MAX(amount) AS max_amount,
      MAX(transaction_date) AS last_date
    FROM transactions
    WHERE type = 'Expense' AND deleted_at IS NULL
    GROUP BY item_name
    HAVING COUNT(id) >= 2
  `).all();

  const candidates = [];

  // Check existing active rules to avoid duplicate suggestions
  const existingRules = db.prepare('SELECT LOWER(item_name) AS item_name FROM recurring_rules WHERE is_active = 1').all();
  const ruleSet = new Set(existingRules.map(r => r.item_name));

  for (const item of items) {
    if (ruleSet.has(item.item_name.toLowerCase())) {
      continue;
    }

    // Get all dates for this item in chronological order
    const txDates = db.prepare(`
      SELECT transaction_date, amount
      FROM transactions
      WHERE item_name = ? AND type = 'Expense' AND deleted_at IS NULL
      ORDER BY transaction_date ASC
    `).all(item.item_name);

    if (txDates.length < 2) continue;

    // Calculate intervals between consecutive transactions in days
    const intervals = [];
    for (let i = 1; i < txDates.length; i++) {
      const d1 = new Date(txDates[i - 1].transaction_date);
      const d2 = new Date(txDates[i].transaction_date);
      const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        intervals.push(diffDays);
      }
    }

    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Amount consistency check: variance should not be wild
    const amountSpread = item.max_amount - item.min_amount;
    const amountConsistency = item.avg_amount > 0 ? (amountSpread / item.avg_amount) : 1;

    let frequencyLabel = '';
    let frequencyDays = 0;
    let confidence = 'Low';

    if (avgInterval >= 0.8 && avgInterval <= 2.5) {
      frequencyLabel = 'Every 1–2 days';
      frequencyDays = 1;
      confidence = 'High';
    } else if (avgInterval >= 5 && avgInterval <= 9) {
      frequencyLabel = 'Weekly (~7 days)';
      frequencyDays = 7;
      confidence = 'High';
    } else if (avgInterval >= 12 && avgInterval <= 18) {
      frequencyLabel = 'Bi-weekly (~15 days)';
      frequencyDays = 15;
      confidence = 'Medium';
    } else if (avgInterval >= 25 && avgInterval <= 35) {
      frequencyLabel = 'Monthly (~30 days)';
      frequencyDays = 30;
      confidence = 'High';
    } else if (avgInterval >= 75 && avgInterval <= 105) {
      frequencyLabel = 'Quarterly (~3 months)';
      frequencyDays = 90;
      confidence = 'Medium';
    } else if (avgInterval >= 340 && avgInterval <= 390) {
      frequencyLabel = 'Yearly (~12 months)';
      frequencyDays = 365;
      confidence = 'Medium';
    }

    if (frequencyLabel) {
      // Calculate estimated next due date
      const lastD = new Date(item.last_date);
      const nextDue = new Date(lastD.getTime() + frequencyDays * 24 * 60 * 60 * 1000);

      // Get category and subcategory names
      const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(item.category_id);
      const sub = item.subcategory_id ? db.prepare('SELECT name FROM subcategories WHERE id = ?').get(item.subcategory_id) : null;

      candidates.push({
        item_name: item.item_name,
        category_id: item.category_id,
        category_name: cat ? cat.name : '',
        subcategory_id: item.subcategory_id,
        subcategory_name: sub ? sub.name : '',
        expected_amount: Math.round(item.avg_amount),
        frequency_days: frequencyDays,
        frequency_label: frequencyLabel,
        confidence,
        last_occurred_date: item.last_date,
        next_due_date: nextDue.toISOString().split('T')[0],
        tx_count: item.tx_count
      });
    }
  }

  return candidates;
}
