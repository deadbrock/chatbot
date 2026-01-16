/**
 * Migração genérica de dados: SQLite (arquivo) -> PostgreSQL (AWS RDS)
 *
 * Pré-requisitos:
 * - Subir o app apontando para Postgres pelo menos 1x para o Sequelize criar as tabelas (sequelize.sync)
 * - Ajustar .env com DB_DIALECT=postgres e credenciais (ou DATABASE_URL)
 *
 * Uso:
 *   node scripts/migrate-sqlite-to-postgres.js
 *
 * Variáveis:
 * - SQLITE_PATH (opcional): caminho do arquivo SQLite (default: ./database.sqlite)
 * - DATABASE_URL (opcional) OU DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD
 * - DB_SSL (true/false)
 */

require('dotenv').config();

const path = require('path');
const sqlite3 = require('sqlite3');
const { Client } = require('pg');

function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
}

function buildPostgresConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const db = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const pass = process.env.DB_PASSWORD;
  if (!host || !db || !user) return null;
  const auth = pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}` : encodeURIComponent(user);
  return `postgres://${auth}@${host}:${port}/${db}`;
}

function quoteIdent(ident) {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function main() {
  const sqlitePath = process.env.SQLITE_PATH
    ? path.resolve(process.env.SQLITE_PATH)
    : path.resolve(process.cwd(), 'database.sqlite');

  const pgConnStr = buildPostgresConnectionString();
  if (!pgConnStr) {
    throw new Error(
      'Credenciais do Postgres ausentes. Configure DATABASE_URL ou DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD no .env.'
    );
  }

  const sslEnabled = parseBool(process.env.DB_SSL, false);

  const sqliteDb = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY);
  const pg = new Client({
    connectionString: pgConnStr,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  });

  console.log(`[migrate] SQLite: ${sqlitePath}`);
  console.log(`[migrate] Postgres: ${process.env.DB_HOST || 'via DATABASE_URL'} (ssl=${sslEnabled})`);

  await pg.connect();

  const tables = await sqliteAll(
    sqliteDb,
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );

  const tableNames = tables
    .map((t) => t.name)
    .filter((name) => name && name !== 'SequelizeMeta');

  // Dependências via foreign keys (para tentar inserir "pais" antes de "filhos")
  const deps = new Map(); // table -> Set(referencedTable)
  for (const table of tableNames) {
    const fkRows = await sqliteAll(sqliteDb, `PRAGMA foreign_key_list(${quoteIdent(table)})`);
    deps.set(
      table,
      new Set(
        fkRows
          .map((r) => r.table)
          .filter((x) => x && x !== table)
      )
    );
  }

  // Topological sort (Kahn)
  const inDegree = new Map(tableNames.map((t) => [t, 0]));
  for (const [t, set] of deps.entries()) {
    for (const dep of set) {
      if (inDegree.has(dep)) inDegree.set(t, (inDegree.get(t) || 0) + 1);
    }
  }
  const queue = tableNames.filter((t) => (inDegree.get(t) || 0) === 0);
  const ordered = [];
  while (queue.length) {
    const t = queue.shift();
    ordered.push(t);
    for (const child of tableNames) {
      const childDeps = deps.get(child);
      if (!childDeps || !childDeps.has(t)) continue;
      inDegree.set(child, (inDegree.get(child) || 0) - 1);
      if ((inDegree.get(child) || 0) === 0) queue.push(child);
    }
  }
  const remaining = tableNames.filter((t) => !ordered.includes(t));
  const insertOrder = ordered.length ? ordered.concat(remaining) : tableNames;

  console.log(`[migrate] Tabelas encontradas no SQLite: ${tableNames.length}`);
  console.log(`[migrate] Ordem de inserção (heurística FK): ${insertOrder.length}`);

  for (const table of insertOrder) {
    // Confirma se a tabela existe no Postgres (criada via sequelize.sync)
    const reg = await pg.query('SELECT to_regclass($1) as reg', [table]);
    if (!reg.rows[0] || !reg.rows[0].reg) {
      console.warn(`[migrate] SKIP: tabela não existe no Postgres: ${table} (rode o app 1x com Postgres para criar)`);
      continue;
    }

    const sqliteCols = await sqliteAll(sqliteDb, `PRAGMA table_info(${quoteIdent(table)})`);
    const sqliteColNames = sqliteCols.map((c) => c.name).filter(Boolean);

    const pgColsRes = await pg.query(
      `SELECT column_name, data_type, udt_name
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1`,
      [table]
    );
    const pgCols = new Map(pgColsRes.rows.map((r) => [r.column_name, r]));
    const commonCols = sqliteColNames.filter((c) => pgCols.has(c));

    if (!commonCols.length) {
      console.warn(`[migrate] SKIP: sem colunas compatíveis em ${table}`);
      continue;
    }

    const rows = await sqliteAll(sqliteDb, `SELECT * FROM ${quoteIdent(table)}`);
    if (!rows.length) {
      console.log(`[migrate] OK: ${table} (0 linhas)`);
      continue;
    }

    const colListSql = commonCols.map(quoteIdent).join(', ');
    const valuesSql = commonCols.map((_, i) => `$${i + 1}`).join(', ');
    const insertSql = `INSERT INTO ${quoteIdent(table)} (${colListSql}) VALUES (${valuesSql}) ON CONFLICT DO NOTHING`;

    let inserted = 0;
    for (const row of rows) {
      const params = commonCols.map((col) => {
        const meta = pgCols.get(col);
        let v = row[col];

        // Ajustes básicos por tipo no Postgres
        if (v !== null && v !== undefined) {
          if (meta && meta.data_type === 'boolean') {
            if (v === 0 || v === 1) v = Boolean(v);
            if (v === '0' || v === '1') v = v === '1';
          }

          if (meta && (meta.data_type === 'json' || meta.data_type === 'jsonb')) {
            if (typeof v === 'string') {
              const s = v.trim();
              if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
                try {
                  v = JSON.parse(s);
                } catch {
                  // mantém string se não for JSON válido
                }
              }
            }
          }
        }

        return v;
      });

      try {
        await pg.query(insertSql, params);
        inserted += 1;
      } catch (err) {
        console.warn(`[migrate] WARN: falha ao inserir em ${table}: ${err.message}`);
      }
    }

    // Tenta ajustar sequence de 'id' quando existir
    if (commonCols.includes('id')) {
      try {
        const seq = await pg.query(`SELECT pg_get_serial_sequence($1, 'id') as seq`, [table]);
        const seqName = seq.rows[0] && seq.rows[0].seq;
        if (seqName) {
          await pg.query(
            `SELECT setval($1, COALESCE((SELECT MAX(id) FROM ${quoteIdent(table)}), 0))`,
            [seqName]
          );
        }
      } catch {
        // não é serial/identity ou sem permissão — ignora
      }
    }

    console.log(`[migrate] OK: ${table} (${inserted}/${rows.length} linhas processadas)`);
  }

  await pg.end();
  sqliteDb.close();
  console.log('[migrate] Concluído.');
}

main().catch((err) => {
  console.error('[migrate] ERRO:', err);
  process.exit(1);
});

