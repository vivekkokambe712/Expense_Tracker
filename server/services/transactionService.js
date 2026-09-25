import db from '../database/db.js';

export function recordItemUsage(name, category_id, subcategory_id, amount) {
  const cleanName = name.trim();
  if (!cleanName) return null;

  const existing = db.prepare('SELECT * FROM items WHERE name = ? COLLATE NOCASE').get(cleanName);

  if (existing) {
    const newUsage = existing.usage_count + 1;
    const newAvg = ((existing.average_amount * existing.usage_count) + Number(amount)) / newUsage;

    db.prepare(`
      UPDATE items
      SET usage_count = ?,
          last_used_at = datetime('now', 'localtime'),
          last_amount = ?,
          average_amount = ?,
          default_category_id = COALESCE(?, default_category_id),
          default_subcategory_id = COALESCE(?, default_subcategory_id),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(newUsage, amount, newAvg, category_id, subcategory_id, existing.id);

    return existing.id;
  } else {
    const info = db.prepare(`
      INSERT INTO items (
        name, default_category_id, default_subcategory_id,
        usage_count, last_used_at, last_amount, average_amount, first_used_at
      ) VALUES (?, ?, ?, 1, datetime('now', 'localtime'), ?, ?, datetime('now', 'localtime'))
    `).run(cleanName, category_id, subcategory_id, amount, amount);

    return info.lastInsertRowid;
  }
}

export function createTransaction(data) {
  const {
    type,
    category_id,
    subcategory_id,
    item_name,
    amount,
    transaction_date,
    payment_method_id,
    notes = '',
    tags = '',
    vendor_or_customer = ''
  } = data;

  if (!type || !['Expense', 'Income'].includes(type)) {
    throw new Error('Valid transaction type (Expense or Income) is required');
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Amount must be a positive number greater than 0');
  }

  if (!category_id) {
    throw new Error('Category is required');
  }

  const cleanItem = (item_name || 'General').trim();
  const dateStr = transaction_date || new Date().toISOString().split('T')[0];

  const runTx = db.transaction(() => {
    const itemId = recordItemUsage(cleanItem, category_id, subcategory_id, numAmount);

    const info = db.prepare(`
      INSERT INTO transactions (
        type, category_id, subcategory_id, item_name, item_id,
        amount, transaction_date, payment_method_id, notes, tags,
        vendor_or_customer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      type,
      category_id,
      subcategory_id || null,
      cleanItem,
      itemId,
      numAmount,
      dateStr,
      payment_method_id || null,
      notes.trim(),
      tags.trim(),
      vendor_or_customer.trim()
    );

    return getTransactionById(info.lastInsertRowid);
  });

  return runTx();
}

export function getTransactionById(id) {
  return db.prepare(`
    SELECT
      t.*,
      c.name AS category_name,
      c.type AS category_type,
      s.name AS subcategory_name,
      p.name AS payment_method_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN subcategories s ON t.subcategory_id = s.id
    LEFT JOIN payment_methods p ON t.payment_method_id = p.id
    WHERE t.id = ?
  `).get(id);
}

export function updateTransaction(id, data) {
  const existing = getTransactionById(id);
  if (!existing) {
    throw new Error('Transaction not found');
  }

  const type = data.type || existing.type;
  if (!['Expense', 'Income'].includes(type)) {
    throw new Error('Valid transaction type is required');
  }

  const amount = data.amount !== undefined ? Number(data.amount) : existing.amount;
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number greater than 0');
  }

  const category_id = data.category_id !== undefined ? data.category_id : existing.category_id;
  const subcategory_id = data.subcategory_id !== undefined ? (data.subcategory_id || null) : existing.subcategory_id;
  const item_name = (data.item_name !== undefined ? data.item_name : existing.item_name).trim();
  const transaction_date = data.transaction_date || existing.transaction_date;
  const payment_method_id = data.payment_method_id !== undefined ? (data.payment_method_id || null) : existing.payment_method_id;
  const notes = data.notes !== undefined ? data.notes.trim() : existing.notes;
  const tags = data.tags !== undefined ? data.tags.trim() : existing.tags;
  const vendor_or_customer = data.vendor_or_customer !== undefined ? data.vendor_or_customer.trim() : existing.vendor_or_customer;

  const runTx = db.transaction(() => {
    let itemId = existing.item_id;
    if (item_name && item_name !== existing.item_name) {
      itemId = recordItemUsage(item_name, category_id, subcategory_id, amount);
    }

    db.prepare(`
      UPDATE transactions
      SET type = ?,
          category_id = ?,
          subcategory_id = ?,
          item_name = ?,
          item_id = ?,
          amount = ?,
          transaction_date = ?,
          payment_method_id = ?,
          notes = ?,
          tags = ?,
          vendor_or_customer = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      type,
      category_id,
      subcategory_id,
      item_name,
      itemId,
      amount,
      transaction_date,
      payment_method_id,
      notes,
      tags,
      vendor_or_customer,
      id
    );

    return getTransactionById(id);
  });

  return runTx();
}

export function deleteTransaction(id, soft = true) {
  if (soft) {
    const info = db.prepare(`
      UPDATE transactions
      SET deleted_at = datetime('now', 'localtime')
      WHERE id = ? AND deleted_at IS NULL
    `).run(id);
    return info.changes > 0;
  } else {
    const info = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    return info.changes > 0;
  }
}

export function restoreTransaction(id) {
  const info = db.prepare(`
    UPDATE transactions
    SET deleted_at = NULL
    WHERE id = ? AND deleted_at IS NOT NULL
  `).run(id);
  return info.changes > 0 ? getTransactionById(id) : null;
}

export function getTransactions(params = {}) {
  const {
    type,
    category_id,
    subcategory_id,
    item_name,
    search,
    startDate,
    endDate,
    payment_method_id,
    minAmount,
    maxAmount,
    tag,
    page = 1,
    limit = 50,
    includeDeleted = false
  } = params;

  const conditions = [];
  const queryParams = [];

  if (!includeDeleted) {
    conditions.push('t.deleted_at IS NULL');
  }

  if (type) {
    conditions.push('t.type = ?');
    queryParams.push(type);
  }

  if (category_id) {
    conditions.push('t.category_id = ?');
    queryParams.push(category_id);
  }

  if (subcategory_id) {
    conditions.push('t.subcategory_id = ?');
    queryParams.push(subcategory_id);
  }

  if (item_name) {
    conditions.push('t.item_name LIKE ?');
    queryParams.push(`%${item_name}%`);
  }

  if (startDate) {
    conditions.push('t.transaction_date >= ?');
    queryParams.push(startDate);
  }

  if (endDate) {
    conditions.push('t.transaction_date <= ?');
    queryParams.push(endDate);
  }

  if (payment_method_id) {
    conditions.push('t.payment_method_id = ?');
    queryParams.push(payment_method_id);
  }

  if (minAmount !== undefined && minAmount !== '') {
    conditions.push('t.amount >= ?');
    queryParams.push(Number(minAmount));
  }

  if (maxAmount !== undefined && maxAmount !== '') {
    conditions.push('t.amount <= ?');
    queryParams.push(Number(maxAmount));
  }

  if (tag) {
    conditions.push('t.tags LIKE ?');
    queryParams.push(`%${tag}%`);
  }

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    conditions.push(`(
      t.item_name LIKE ? OR
      c.name LIKE ? OR
      s.name LIKE ? OR
      t.notes LIKE ? OR
      t.vendor_or_customer LIKE ? OR
      t.tags LIKE ? OR
      CAST(t.amount AS TEXT) LIKE ?
    )`);
    queryParams.push(s, s, s, s, s, s, s);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count & aggregates
  const countRow = db.prepare(`
    SELECT
      COUNT(*) AS total_count,
      COALESCE(SUM(CASE WHEN t.type = 'Income' THEN t.amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN t.type = 'Expense' THEN t.amount ELSE 0 END), 0) AS total_expense
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN subcategories s ON t.subcategory_id = s.id
    ${whereClause}
  `).get(...queryParams);

  const total = countRow.total_count;
  const numLimit = Math.max(1, Number(limit));
  const numPage = Math.max(1, Number(page));
  const offset = (numPage - 1) * numLimit;

  const items = db.prepare(`
    SELECT
      t.*,
      c.name AS category_name,
      c.type AS category_type,
      s.name AS subcategory_name,
      p.name AS payment_method_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN subcategories s ON t.subcategory_id = s.id
    LEFT JOIN payment_methods p ON t.payment_method_id = p.id
    ${whereClause}
    ORDER BY t.transaction_date DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(...queryParams, numLimit, offset);

  return {
    items,
    pagination: {
      total,
      page: numPage,
      limit: numLimit,
      totalPages: Math.ceil(total / numLimit) || 1
    },
    aggregates: {
      totalIncome: countRow.total_income,
      totalExpense: countRow.total_expense,
      net: countRow.total_income - countRow.total_expense
    }
  };
}

export function searchAutocompleteItems(query, category_id = null) {
  const cleanQ = (query || '').trim();

  // If query is empty, return top frequent & recently used items
  if (!cleanQ) {
    let sql = `
      SELECT
        i.*,
        c.name AS category_name,
        c.type AS category_type,
        s.name AS subcategory_name
      FROM items i
      LEFT JOIN categories c ON i.default_category_id = c.id
      LEFT JOIN subcategories s ON i.default_subcategory_id = s.id
    `;
    const params = [];
    if (category_id) {
      sql += ' WHERE i.default_category_id = ?';
      params.push(category_id);
    }
    sql += ' ORDER BY i.usage_count DESC, i.last_used_at DESC LIMIT 10';
    return db.prepare(sql).all(...params);
  }

  // Section 9: Sort intelligently by:
  // 1. Exact match (case-insensitive)
  // 2. Prefix match
  // 3. Frequency of previous usage (usage_count DESC)
  // 4. Recency of usage (last_used_at DESC)
  const pattern = `%${cleanQ}%`;
  const prefix = `${cleanQ}%`;

  let sql = `
    SELECT
      i.*,
      c.name AS category_name,
      c.type AS category_type,
      s.name AS subcategory_name,
      CASE
        WHEN LOWER(i.name) = LOWER(?) THEN 1
        WHEN LOWER(i.name) LIKE LOWER(?) THEN 2
        ELSE 3
      END AS match_priority
    FROM items i
    LEFT JOIN categories c ON i.default_category_id = c.id
    LEFT JOIN subcategories s ON i.default_subcategory_id = s.id
    WHERE i.name LIKE ?
  `;

  const params = [cleanQ, prefix, pattern];

  if (category_id) {
    sql += ' AND (i.default_category_id = ? OR i.default_category_id IS NULL)';
    params.push(category_id);
  }

  sql += `
    ORDER BY
      match_priority ASC,
      i.usage_count DESC,
      i.last_used_at DESC
    LIMIT 15
  `;

  return db.prepare(sql).all(...params);
}
