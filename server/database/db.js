import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usePostgres = Boolean(process.env.DATABASE_URL);
const dataDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');
export const dbPath = usePostgres ? null : (process.env.DB_PATH || path.join(dataDir, 'tracker.db'));

function callPostgres(action, sql, params = []) {
  const workerPath = path.join(__dirname, 'postgres-worker.js');
  const output = execFileSync(process.execPath, [workerPath], {
    input: JSON.stringify({ action, sql, params }),
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 10 * 1024 * 1024
  });
  return JSON.parse(output);
}

function normalizePostgresRows(value) {
  if (Array.isArray(value)) return value.map(normalizePostgresRows);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    const normalized = normalizePostgresRows(entry);
    if ((key === 'id' || key.endsWith('_id')) && typeof normalized === 'string' && /^\d+$/.test(normalized)) {
      return [key, Number(normalized)];
    }
    return [key, normalized];
  }));
}

let db;

if (usePostgres) {
  db = {
    exec: (sql) => callPostgres('exec', sql),
    prepare: (sql) => ({
      get: (...params) => normalizePostgresRows(callPostgres('get', sql, params)),
      all: (...params) => normalizePostgresRows(callPostgres('all', sql, params)),
      run: (...params) => {
        const insertSql = /^\s*INSERT\b/i.test(sql) && !/\bRETURNING\b/i.test(sql)
          ? `${sql.trimEnd()} RETURNING id`
          : sql;
        return callPostgres('run', insertSql, params);
      }
    })
  };
} else {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new DatabaseSync(dbPath);

  // Enable WAL mode and Foreign Keys
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
}

// Helper for atomic transactions
db.transaction = (fn) => {
  if (usePostgres) {
    return (...args) => fn(...args);
  }
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
};

export function initDb() {
  if (usePostgres) {
    const migrationPath = path.join(__dirname, 'initial-schema.sql');
    db.exec(fs.readFileSync(migrationPath, 'utf8'));
    return;
  }

  // 1. Categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Expense', 'Income')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 2. Subcategories
  db.exec(`
    CREATE TABLE IF NOT EXISTS subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 3. Payment Methods
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 4. Items (Intelligent item tracking & history)
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      default_category_id INTEGER REFERENCES categories(id),
      default_subcategory_id INTEGER REFERENCES subcategories(id),
      usage_count INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      last_amount REAL DEFAULT 0,
      average_amount REAL DEFAULT 0,
      first_used_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
    CREATE INDEX IF NOT EXISTS idx_items_usage ON items(usage_count DESC, last_used_at DESC);
  `);

  // 5. Transactions
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('Expense', 'Income')),
      category_id INTEGER NOT NULL REFERENCES categories(id),
      subcategory_id INTEGER REFERENCES subcategories(id),
      item_name TEXT NOT NULL,
      item_id INTEGER REFERENCES items(id),
      amount REAL NOT NULL CHECK(amount > 0),
      transaction_date TEXT NOT NULL,
      payment_method_id INTEGER REFERENCES payment_methods(id),
      notes TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      vendor_or_customer TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_tx_item ON transactions(item_name);
    CREATE INDEX IF NOT EXISTS idx_tx_deleted ON transactions(deleted_at);
  `);

  // 6. Recurring Rules
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Expense', 'Income')),
      category_id INTEGER REFERENCES categories(id),
      subcategory_id INTEGER REFERENCES subcategories(id),
      item_name TEXT NOT NULL,
      expected_amount REAL NOT NULL,
      frequency_days INTEGER NOT NULL,
      frequency_label TEXT NOT NULL,
      last_occurred_date TEXT,
      next_due_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 7. Settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  seedDefaults();
}

function seedDefaults() {
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (catCount === 0) {
    const insertCat = db.prepare('INSERT INTO categories (name, type) VALUES (?, ?)');
    const insertSub = db.prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)');

    const transaction = db.transaction(() => {
      // Business Expense
      const bizExpInfo = insertCat.run('Business Expense', 'Expense');
      const bizExpId = Number(bizExpInfo.lastInsertRowid);
      const bizSubs = [
        'Raw Material', 'Electricity Bill', 'WiFi / Internet', 'Miscellaneous',
        'Printing', 'Maintenance', 'Equipment', 'Transportation', 'Labour',
        'Rent', 'Packaging', 'Stationery', 'Software', 'Marketing', 'Other'
      ];
      for (const sub of bizSubs) {
        insertSub.run(bizExpId, sub);
      }

      // Home Expense
      const homeExpInfo = insertCat.run('Home Expense', 'Expense');
      const homeExpId = Number(homeExpInfo.lastInsertRowid);
      const homeSubs = [
        'Grocery', 'Gas Bill', 'Electricity Bill', 'WiFi / Internet',
        'Travel', 'Hospital', 'Miscellaneous'
      ];
      for (const sub of homeSubs) {
        insertSub.run(homeExpId, sub);
      }

      // Business Income
      const bizIncInfo = insertCat.run('Business Income', 'Income');
      const bizIncId = Number(bizIncInfo.lastInsertRowid);
      const bizIncSubs = [
        'Printing Orders', 'Binding', 'Xerox', 'Visiting Cards',
        'Pamphlets', 'Brochures', 'Stamps', 'Other'
      ];
      for (const sub of bizIncSubs) {
        insertSub.run(bizIncId, sub);
      }

      // Other Income
      const otherIncInfo = insertCat.run('Other Income', 'Income');
      const otherIncId = Number(otherIncInfo.lastInsertRowid);
      const otherIncSubs = ['Freelance', 'Investments', 'Rental', 'Other'];
      for (const sub of otherIncSubs) {
        insertSub.run(otherIncId, sub);
      }
    });

    transaction();
  }

  const pmCount = db.prepare('SELECT COUNT(*) as count FROM payment_methods').get().count;
  if (pmCount === 0) {
    const insertPm = db.prepare('INSERT INTO payment_methods (name) VALUES (?)');
    const pms = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other'];
    for (const pm of pms) {
      insertPm.run(pm);
    }
  }

  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
  if (settingsCount === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('currency_symbol', '₹');
    insertSetting.run('currency_code', 'INR');
    insertSetting.run('app_title', 'Expense & Profit Tracker');
  }
}

export default db;
