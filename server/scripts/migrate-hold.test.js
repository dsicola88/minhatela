'use strict';

/**
 * Prova o bloqueio da 038 no arranque remoto.
 * Usa só Postgres local. O nome "railway" vai na query string para o migrate
 * tratar o host como remoto, sem sair da máquina.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const ADMIN_URL = process.env.DATABASE_URL || '';
const DB_NAME = 'minhatela_hold_probe';

function assertLocalAdmin() {
  let host = '';
  try {
    host = new URL(ADMIN_URL).hostname;
  } catch {
    throw new Error('DATABASE_URL local inválida');
  }
  if (!/^(localhost|127\.0\.0\.1)$/.test(host)) {
    throw new Error(`recusa host ${host}`);
  }
}

function probeUrl() {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${DB_NAME}`;
  url.searchParams.set('application_name', 'railway-hold-test');
  return url.toString();
}

function writeMigrations(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, '001_other.sql'),
    'CREATE TABLE hold_boot_other (id int);\n'
  );
  fs.writeFileSync(
    path.join(dir, '038_creator_ledger_trace.sql'),
    'CREATE TABLE hold_boot_038 (id int);\n'
  );
}

async function resetDb() {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [DB_NAME]
  );
  await admin.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  await admin.query(`CREATE DATABASE ${DB_NAME}`);
  await admin.end();
}

function runMigrate(applyFlag) {
  const env = { ...process.env, DATABASE_URL: probeUrl(), MIGRATIONS_DIR: process.env.HOLD_MIGRATIONS_DIR, ALLOW_REMOTE_MIGRATE: '1' };
  if (applyFlag === undefined) delete env.APPLY_038_LEDGER_TRACE;
  else env.APPLY_038_LEDGER_TRACE = applyFlag;
  const result = spawnSync(process.execPath, [path.resolve(__dirname, 'migrate.js')], {
    env,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    output: `${result.stdout || ''}\n${result.stderr || ''}`,
  };
}

async function state() {
  const client = new Client({ connectionString: probeUrl() });
  await client.connect();
  const applied = await client.query(
    `SELECT id FROM schema_migrations WHERE id IN ('001_other.sql','038_creator_ledger_trace.sql') ORDER BY id`
  );
  const tables = await client.query(
    `SELECT c.relname
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname IN ('hold_boot_other','hold_boot_038')
     ORDER BY c.relname`
  );
  await client.end();
  return {
    applied: applied.rows.map((row) => row.id),
    tables: tables.rows.map((row) => row.relname),
  };
}

function eventsFor038(output) {
  return output
    .split('\n')
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((row) => row && row.file === '038_creator_ledger_trace.sql')
    .map((row) => row.event);
}

function assertCase(name, run, snapshot, expect) {
  const events = eventsFor038(run.output);
  const held = events.includes('migrate.held');
  const applied038 = events.includes('migrate.applied');
  const problems = [];
  if (run.status !== 0) problems.push(`exit ${run.status}`);
  if (held !== expect.held) problems.push(`held=${held}`);
  if (applied038 !== expect.appliedLog) problems.push(`appliedLog=${applied038}`);
  if (snapshot.tables.includes('hold_boot_038') !== expect.table) problems.push(`table=${snapshot.tables.includes('hold_boot_038')}`);
  if (snapshot.tables.includes('hold_boot_other') !== true) problems.push('a outra migração não correu');
  if (problems.length) {
    throw new Error(`${name}: ${problems.join(', ')}\n${run.output.slice(0, 500)}`);
  }
  console.log(JSON.stringify({ case: name, exit: run.status, held, appliedLog: applied038, ...snapshot }));
}

async function main() {
  assertLocalAdmin();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-hold-'));
  process.env.HOLD_MIGRATIONS_DIR = dir;
  writeMigrations(dir);
  await resetDb();
  try {
    const absent = runMigrate(undefined);
    assertCase('ausente', absent, await state(), { held: true, appliedLog: false, table: false });

    const zero = runMigrate('0');
    assertCase('zero', zero, await state(), { held: true, appliedLog: false, table: false });

    const one = runMigrate('1');
    assertCase('um', one, await state(), { held: false, appliedLog: true, table: true });
    console.log('migrate-hold: ok');
  } finally {
    const admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [DB_NAME]
    );
    await admin.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
    await admin.end();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('migrate-hold: fail', err.message);
  process.exit(1);
});
