import fs from 'node:fs';
import process from 'node:process';
import { Client } from 'pg';

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function normalizeSql(sql) {
  return sql
    .replace(/datetime\('now'(,\s*'localtime')?\)/gi, 'NOW()')
    .replace(/date\('now',\s*'-30 days'\)/gi, "CURRENT_DATE - INTERVAL '30 days'")
    .replace(/date\('now',\s*'-84 days'\)/gi, "CURRENT_DATE - INTERVAL '84 days'")
    .replace(/date\('now',\s*'-12 months',\s*'start of month'\)/gi, "date_trunc('month', CURRENT_DATE - INTERVAL '12 months')")
    .replace(/strftime\('%Y-%m',\s*([^,)]+)\)/gi, "to_char($1::date, 'YYYY-MM')")
    .replace(/strftime\('%Y-W%W',\s*([^,)]+)\)/gi, "to_char($1::date, 'IYYY-\\\"W\\\"IW')")
    .replace(/\s+COLLATE\s+NOCASE/gi, '')
    .replace(/\bTRUE\b/gi, '1')
    .replace(/\bFALSE\b/gi, '0');
}

function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

await client.connect();
try {
  const sql = normalizeSql(convertPlaceholders(input.sql));
  if (input.action === 'exec') {
    await client.query(sql);
    process.stdout.write(JSON.stringify({ ok: true }));
  } else {
    const result = await client.query(sql, input.params || []);
    if (input.action === 'run') {
      const row = result.rows[0] || {};
      process.stdout.write(JSON.stringify({ changes: result.rowCount, lastInsertRowid: row.id ?? null }));
    } else {
      process.stdout.write(JSON.stringify(input.action === 'get' ? (result.rows[0] || null) : result.rows));
    }
  }
} finally {
  await client.end();
}
