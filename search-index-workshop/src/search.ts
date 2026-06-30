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

// ---------------------------------------------------------------------------
// TODO (Step 1): Implement full-text search — work through 1a → 1d in order.
//   1a: WHERE search_doc @@ websearch_to_tsquery('english', immutable_unaccent($1))
//   1b: pull tsquery into FROM alias, add ts_rank_cd(...) AS rank, ORDER BY rank DESC
//   1c: add ts_headline(...) AS snippet
//   1d: add category filter ($2), shift limit to $3, fall back to fuzzySearch()
// See docs/03-tutorial.md for the full code at each step.
// ---------------------------------------------------------------------------
export async function searchProducts({ q, category, limit = 20 }: SearchParams): Promise<SearchHit[]> {
  if (!q.trim()) return [];

  return [];
}

// ---------------------------------------------------------------------------
// TODO (Step 2a, optional): typo-tolerant fallback using pg_trgm.
//   WHERE word_similarity($1, name) > 0.4  ORDER BY word_similarity($1, name) DESC
//   word_similarity matches the query against the best single word inside the name,
//   not the whole string (avoids short queries scoring too low against long names).
// ---------------------------------------------------------------------------
async function fuzzySearch(q: string, category: string | undefined, limit: number): Promise<SearchHit[]> {
  return [];
}

// ---------------------------------------------------------------------------
// TODO (Step 2b, optional): autocomplete via prefix match on name.
// ---------------------------------------------------------------------------
export async function suggest(prefix: string, limit = 8): Promise<string[]> {
  if (!prefix.trim()) return [];

  return [];
}

// Already implemented for you -- fills the category dropdown in the UI.
export async function categories(): Promise<string[]> {
  const { rows } = await pool.query<{ category: string }>(
    "SELECT DISTINCT category FROM products ORDER BY category",
  );
  return rows.map((r) => r.category);
}
