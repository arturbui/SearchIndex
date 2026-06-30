// REFERENCE SOLUTION for src/search.ts.
// To run the finished app without doing the tutorial:  cp solutions/search.ts src/search.ts
import { pool } from "../src/db.ts";

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

// Main full-text search. Ranked, highlighted, optional category facet,
// with a typo-tolerant fallback when full-text finds nothing.
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

// Trigram fallback: catches "Schoklade" -> "Schokolade". Uses word_similarity
// (not whole-string similarity()/`%`) so a short query is matched against the
// best-fitting *word* inside a longer product name, and lowers the 0.6 default
// `word_similarity_threshold` to 0.4 (scoped to this statement via
// set_config(..., true)) since single-word typos often land right at 0.6,
// which the strictly-greater-than `<%` operator then misses.
async function fuzzySearch(q: string, category: string | undefined, limit: number): Promise<SearchHit[]> {
  const sql = `
    WITH cfg AS (SELECT set_config('pg_trgm.word_similarity_threshold', '0.4', true))
    SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock,
           word_similarity($1, name) AS rank,
           name AS snippet
    FROM products, cfg
    WHERE $1 <% name
      AND ($2::text IS NULL OR category = $2)
    ORDER BY rank DESC
    LIMIT $3`;
  const { rows } = await pool.query<SearchHit>(sql, [q, category ?? null, limit]);
  return rows;
}

// Autocomplete: prefix matches on the product name.
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

export async function categories(): Promise<string[]> {
  const { rows } = await pool.query<{ category: string }>(
    "SELECT DISTINCT category FROM products ORDER BY category",
  );
  return rows.map((r) => r.category);
}
