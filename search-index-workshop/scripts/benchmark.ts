// Head-to-head: naive ILIKE substring search vs. GIN-indexed full-text search.
// Run AFTER `npm run generate -- 200000 && npm run seed` for a meaningful gap.
//
// It prints, per query term:
//   - avg latency of `ILIKE '%term%'` over (name || description)   [no useful index -> seq scan]
//   - avg latency of `search_doc @@ websearch_to_tsquery(...)`     [GIN index]
//   - the row counts (they differ on purpose -- see docs/02-demo.md)
// and dumps one EXPLAIN ANALYZE for each so you can show the plan in the slides.

import { pool } from "../src/db.ts";

const TERMS = ["bio milch", "hafer", "schokolade vegan", "kaffee bohne", "glutenfrei brot"];
const RUNS = 5;

async function timeit(sql: string, params: unknown[]): Promise<{ ms: number; rows: number }> {
  // warm-up
  await pool.query(sql, params);
  let total = 0;
  let rows = 0;
  for (let i = 0; i < RUNS; i++) {
    const t0 = process.hrtime.bigint();
    const r = await pool.query(sql, params);
    const t1 = process.hrtime.bigint();
    total += Number(t1 - t0) / 1e6;
    rows = r.rowCount ?? 0;
  }
  return { ms: total / RUNS, rows };
}

const ILIKE_SQL = `
  SELECT id FROM products
  WHERE name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%'`;

const FTS_SQL = `
  SELECT id FROM products
  WHERE search_doc @@ websearch_to_tsquery('german', immutable_unaccent($1))`;

async function main() {
  const { rows: [{ count }] } = await pool.query("SELECT count(*)::int AS count FROM products");
  console.log(`\nDataset: ${Number(count).toLocaleString("de-DE")} products | ${RUNS} runs per query\n`);
  console.log("term".padEnd(20), "ILIKE (ms)".padStart(12), "FTS (ms)".padStart(12), "speedup".padStart(10), "  ILIKE/FTS rows");
  console.log("-".repeat(80));

  for (const term of TERMS) {
    // ILIKE works on the raw multi-word string; FTS treats it as AND of lexemes.
    const ilike = await timeit(ILIKE_SQL, [term]);
    const fts = await timeit(FTS_SQL, [term]);
    const speedup = (ilike.ms / fts.ms).toFixed(1) + "x";
    console.log(
      term.padEnd(20),
      ilike.ms.toFixed(1).padStart(12),
      fts.ms.toFixed(1).padStart(12),
      speedup.padStart(10),
      `   ${ilike.rows} / ${fts.rows}`,
    );
  }

  console.log("\n--- EXPLAIN ANALYZE: ILIKE (expect Seq Scan) ---");
  const ePlan1 = await pool.query(`EXPLAIN (ANALYZE, BUFFERS) ${ILIKE_SQL}`, [TERMS[0]]);
  console.log(ePlan1.rows.map((r) => r["QUERY PLAN"]).join("\n"));

  console.log("\n--- EXPLAIN ANALYZE: FTS (expect Bitmap Index Scan on products_search_idx) ---");
  const ePlan2 = await pool.query(`EXPLAIN (ANALYZE, BUFFERS) ${FTS_SQL}`, [TERMS[0]]);
  console.log(ePlan2.rows.map((r) => r["QUERY PLAN"]).join("\n"));

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
