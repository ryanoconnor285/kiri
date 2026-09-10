import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

const require = createRequire(import.meta.url);
const sqlJsDir = dirname(require.resolve("sql.js/dist/sql-wasm.js"));

let sqlPromise: Promise<SqlJsStatic> | null = null;

export async function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => join(sqlJsDir, file),
    });
  }
  return sqlPromise;
}

export function queryAll(db: Database, sql: string): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}
