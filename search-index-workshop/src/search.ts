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
// TODO (Step 4): Implement full-text search.
//   - Build a query with websearch_to_tsquery('english', immutable_unaccent($1))
//   - Filter rows with:  search_doc @@ q
//   - Score them with:   ts_rank_cd(search_doc, q)  and ORDER BY rank DESC
//   - Bonus (Step 5): add the optional category filter ($2)
//   - Bonus (Step 6): add a highlighted snippet with ts_headline(...)
//   - Bonus (Step 7): if you get 0 rows, fall back to fuzzySearch() below
// Follow docs/03-tutorial.md (or docs/05-line-by-line.md for a clause-by-clause walkthrough).
// ---------------------------------------------------------------------------
export async function searchProducts({ q, category, limit = 20 }: SearchParams): Promise<SearchHit[]> {
  if (!q.trim()) return [];

  return [];
}

// ---------------------------------------------------------------------------
// TODO (Step 7, optional): typo-tolerant fallback using pg_trgm.
//   word_similarity($1, name), via the `<%` operator, against the
//   best-matching *word* inside name -- not whole-string similarity()/`%`,
//   which scores short queries too low against longer multi-word names.
// ---------------------------------------------------------------------------
async function fuzzySearch(q: string, category: string | undefined, limit: number): Promise<SearchHit[]> {
  return [];
}

// ---------------------------------------------------------------------------
// TODO (Step 8, optional): autocomplete via prefix match on name.
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
