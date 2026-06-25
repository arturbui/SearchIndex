// ============================================================================
//  src/search.ts  --  THIS IS YOUR WORKSHOP STUB. You implement the TODOs.
//
//  The server (src/server.ts) and the web UI already call these functions.
//  Right now they return nothing, so the UI shows "no results" -- your job is
//  to make search actually work, step by step (see docs/03-tutorial.md).
//
//  Stuck? The finished version lives in solutions/search.ts.
// ============================================================================
import { pool } from "./db.ts";

export interface SearchParams {
  q: string;
  category?: string;
  limit?: number;
}

export interface SearchHit {
  id: number;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string;
  price_cents: number;
  unit: string;
  in_stock: boolean;
  rank: number;
  snippet: string;
}

let warned = false;

// ---------------------------------------------------------------------------
// TODO (Step 4): Implement full-text search.
//   - Build a query with websearch_to_tsquery('english', immutable_unaccent($1))
//   - Filter rows with:  search_doc @@ q
//   - Score them with:   ts_rank_cd(search_doc, q)  and ORDER BY rank DESC
//   - Bonus (Step 5): add the optional category filter ($2)
//   - Bonus (Step 6): add a highlighted snippet with ts_headline(...)
//   - Bonus (Step 7): if you get 0 rows, fall back to fuzzySearch() below
// Look at db/demo-queries.sql -- the SQL you need is mostly there already.
// ---------------------------------------------------------------------------
export async function searchProducts({ q, category, limit = 20 }: SearchParams): Promise<SearchHit[]> {
  if (!q.trim()) return [];

  const sql = `
    SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock,
           ts_rank_cd(search_doc, q)                            AS rank,
           ts_headline('english', description, q,
             'StartSel=<mark>, StopSel=</mark>, MaxFragments=1, MaxWords=16, MinWords=6') AS snippet
    FROM products,
         websearch_to_tsquery('english', immutable_unaccent($1)) AS q
    WHERE search_doc @@ q
      AND ($2::text IS NULL OR category = $2)
    ORDER BY rank DESC, in_stock DESC, name
    LIMIT $3`;

  const { rows } = await pool.query<SearchHit>(sql, [q, category ?? null, limit]);
  if (rows.length > 0) return rows;

  return fuzzySearch(q, category, limit);
}

// ---------------------------------------------------------------------------
// TODO (Step 7, optional): typo-tolerant fallback using pg_trgm.
//   WHERE name % $1  ORDER BY similarity(name, $1) DESC
// ---------------------------------------------------------------------------
async function fuzzySearch(q: string, category: string | undefined, limit: number): Promise<SearchHit[]> {
  const sql = `
    SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock,
           similarity(name, $1) AS rank,
           name AS snippet
    FROM products
    WHERE name % $1
      AND ($2::text IS NULL OR category = $2)
    ORDER BY rank DESC
    LIMIT $3`;
  const { rows } = await pool.query<SearchHit>(sql, [q, category ?? null, limit]);
  return rows;
}

// ---------------------------------------------------------------------------
// TODO (Step 8, optional): autocomplete via prefix match on name.
// ---------------------------------------------------------------------------
export async function suggest(prefix: string, limit = 8): Promise<string[]> {
  if (!prefix.trim()) return [];
  const { rows } = await pool.query<{ name: string }>(
    `SELECT name FROM (
       SELECT DISTINCT name FROM products
       WHERE immutable_unaccent(name) ILIKE '%' || immutable_unaccent($1) || '%'
     ) matches
     ORDER BY
       CASE
         WHEN immutable_unaccent(name) ILIKE immutable_unaccent($1) || '%' THEN 0
         WHEN immutable_unaccent(name) ILIKE '% ' || immutable_unaccent($1) || '%' THEN 1
         ELSE 2
       END,
       length(name), name
     LIMIT $2`,
    [prefix, limit],
  );
  return rows.map((r) => r.name);
}
// Already implemented for you -- fills the category dropdown in the UI.
export async function categories(): Promise<string[]> {
  const { rows } = await pool.query<{ category: string }>(
    "SELECT DISTINCT category FROM products ORDER BY category",
  );
  return rows.map((r) => r.category);
}
