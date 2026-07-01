# Tutorial: build a working grocery search

By the end you'll have a running search box over a Knuspr-style catalog, backed by a
PostgreSQL search index. You implement the search logic; everything else is provided.

**You'll learn by doing:** get the database and a synthetic catalog running, then
write the queries — full-text ranking, highlighting, typo tolerance, autocomplete —
and watch them light up the UI.

> Stuck at any point? `solutions/search.ts` has the finished code.

---

## Setup

> 💻 **Terminal 1** — open one terminal now; you'll reuse it for all of Setup and
> for Step 1.

#### 1. Prerequisites

```bash
docker --version
node --version   # needs v20+  →  https://nodejs.org
git clone https://github.com/arturbui/SearchIndex.git search-index-workshop
cd search-index-workshop
npm install
```

#### 2. Start Postgres

```bash
docker compose up -d db
docker compose ps        # 'db' should be 'running'/'healthy'
```

#### 3. Connect with psql

```bash
docker compose exec db psql -U workshop knuspr
```

You are now inside the Postgres terminal. Try `\dt` to list tables (empty for now).
When you're done, **exit back to your normal shell before moving on** — type:

```sql
\q
```

> ⚠️ Steps 4 and 5 won't work if you're still inside psql. If your terminal shows
> `knuspr=#` you're still in it — type `\q` and press Enter to get out.

For one-off SQL checks later, you can skip the interactive prompt entirely:
`docker compose exec -T db psql -U workshop knuspr -c "<sql>"`.

#### 4. Create the search index

```bash
docker compose exec -T db psql -U workshop knuspr < db/schema.sql
```
> 🪟 **PowerShell:** `Get-Content db/schema.sql | docker compose exec -T db psql -U workshop knuspr`

#### 5. Generate test data

```bash
npm run generate -- 20000     # writes data/products.json
npm run seed                  # applies schema + bulk-loads the rows
docker compose exec -T db psql -U workshop knuspr -c "SELECT count(*) FROM products;"
```

---

## Step 1 — Write the search query — the core of the workshop

Open `src/search.ts`. You'll see three functions with `return []` placeholders — fill
them in order. Start the dev server first (keep it running; open a new terminal for
any other commands):

```bash
npm run dev      # http://localhost:3000
```

Type "milk" — no results yet. Work through each sub-step and test in the browser as you go.

---

**1a — basic full-text search.**

Your `searchProducts` function currently ends with a lone `return [];`. Delete that
line and replace it with the block below — keep the `if (!q.trim()) return [];` guard
at the top untouched:

```ts
  const { rows } = await pool.query<SearchHit>(
    `SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock,
            0::float AS rank, '' AS snippet
     FROM products
     WHERE search_doc @@ websearch_to_tsquery('english', immutable_unaccent($1))
     LIMIT $2`,
    [q, limit],
  );
  return rows;
```

What each piece means:
- **`pool.query<SearchHit>(...)`** — runs a SQL query and returns rows. `<SearchHit>` tells TypeScript the shape of each row so you get autocomplete and type-checking.
- **`$1`, `$2`** — placeholders for the values in the array `[q, limit]`. PostgreSQL fills them in order, safely, without any risk of SQL injection.
- **`search_doc`** — a pre-built search index column set up in `db/schema.sql`. Think of it as a compressed, pre-processed version of the product's text, optimised for fast matching.
- **`@@`** — the full-text match operator. It checks whether a row's `search_doc` matches the parsed query.
- **`websearch_to_tsquery('english', ...)`** — parses the user's typed text into a search query. Handles phrases in quotes, `-word` to exclude, etc.
- **`immutable_unaccent($1)`** — strips accents before matching, so "Müsli" matches a search for "Musli".
- **`0::float AS rank`** — a placeholder score (zero for now). You'll replace this in the next step.
- **`'' AS snippet`** — a placeholder excerpt (empty for now). You'll replace this in step 1c.

Your full function should now look like this:

```ts
export async function searchProducts({ q, category, limit = 20 }: SearchParams): Promise<SearchHit[]> {
  if (!q.trim()) return [];

  const { rows } = await pool.query<SearchHit>(
    `SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock,
            0::float AS rank, '' AS snippet
     FROM products
     WHERE search_doc @@ websearch_to_tsquery('english', immutable_unaccent($1))
     LIMIT $2`,
    [q, limit],
  );
  return rows;
}
```

Search "organic milk" → results appear. 🎉

---

**1b — rank by relevance.**

Results appear but in arbitrary order. Make four edits inside the SQL string you just wrote:

**Edit 1.** Replace `0::float AS rank` with:
```sql
ts_rank_cd(search_doc, q) AS rank
```

**Edit 2.** Replace `FROM products` with:
```sql
FROM products,
     websearch_to_tsquery('english', immutable_unaccent($1)) AS q
```
This puts the tsquery into `FROM` as an alias called `q`, so you can refer to it by name in both `WHERE` and `SELECT` without writing the full expression twice.

**Edit 3.** Replace `WHERE search_doc @@ websearch_to_tsquery('english', immutable_unaccent($1))` with:
```sql
WHERE search_doc @@ q
```
(Using the alias `q` from `FROM` instead of repeating the full expression.)

**Edit 4.** Add `ORDER BY rank DESC` before `LIMIT $2`:
```sql
ORDER BY rank DESC
LIMIT $2
```

Also move the SQL into a `const sql` variable — purely a readability change, not a logic change:
```ts
  const sql = `
    SELECT ...`;
  const { rows } = await pool.query<SearchHit>(sql, [q, limit]);
```

What's new:
- **`ts_rank_cd(search_doc, q)`** — scores each row by how closely it matches. Hits in the product name count more than hits in the description because of field weights configured in `db/schema.sql`.

Your full function should now look like this:

```ts
export async function searchProducts({ q, category, limit = 20 }: SearchParams): Promise<SearchHit[]> {
  if (!q.trim()) return [];

  const sql = `
    SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock,
           ts_rank_cd(search_doc, q) AS rank, '' AS snippet
    FROM products,
         websearch_to_tsquery('english', immutable_unaccent($1)) AS q
    WHERE search_doc @@ q
    ORDER BY rank DESC
    LIMIT $2`;

  const { rows } = await pool.query<SearchHit>(sql, [q, limit]);
  return rows;
}
```

The most relevant products now come first.

---

**1c — highlight the match.**

Find `'' AS snippet` in your SQL and replace it with:

```sql
ts_headline('english', description, q,
  'StartSel=<mark>, StopSel=</mark>, MaxFragments=1, MaxWords=16, MinWords=6') AS snippet
```

What's new:
- **`ts_headline`** — extracts a short excerpt from the product `description` and wraps matching words in `<mark>` tags, which the UI renders as highlights.
- The options string controls the excerpt: `MaxFragments=1` returns one passage, `MaxWords=16, MinWords=6` set its length. Always set both — if `MaxWords` falls below the default `MinWords` (15) you get *"MinWords must be less than MaxWords."*

Your full function should now look like this:

```ts
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
    ORDER BY rank DESC
    LIMIT $2`;

  const { rows } = await pool.query<SearchHit>(sql, [q, limit]);
  return rows;
}
```

Each result now shows a highlighted excerpt from its description.

---

**1d — category filter + fallback.**

Five small edits to wire up the category dropdown and the typo-tolerant fallback:

**Edit 1.** In `WHERE`, add a second condition after `WHERE search_doc @@ q`:
```sql
WHERE search_doc @@ q
  AND ($2::text IS NULL OR category = $2)
```
`$2::text IS NULL OR category = $2` is the standard SQL pattern for an optional filter — when no category is selected, `$2` is `null` so the condition is always true and nothing is filtered out.

**Edit 2.** Change `LIMIT $2` to `LIMIT $3` (because `$2` is now taken by `category`):
```sql
LIMIT $3
```

**Edit 3.** Extend `ORDER BY` to add tiebreakers after `rank DESC`:
```sql
ORDER BY rank DESC, in_stock DESC, name
```
`in_stock DESC` floats available products up; `name` keeps the order stable when two products share the same rank.

**Edit 4.** Update the query parameters array from `[q, limit]` to:
```ts
[q, category ?? null, limit]
```
`category ?? null` passes `null` when no category is chosen, which makes the `IS NULL` check work.

**Edit 5.** Replace `return rows;` with a fuzzy fallback for when nothing matched:
```ts
  if (rows.length > 0) return rows;
  return fuzzySearch(q, category, limit);
```

Your full function should now look like this:

```ts
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
```

Pick a category in the dropdown — results narrow. `searchProducts` is now complete.

## Step 2 — Typo tolerance & autocomplete

**2a — fuzzy fallback.**

Find `fuzzySearch` — it currently just does `return []`. Delete that line and replace it
with:

```ts
  const sql = `
    SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock,
           word_similarity($1, name) AS rank,
           name AS snippet
    FROM products
    WHERE word_similarity($1, name) > 0.4
      AND ($2::text IS NULL OR category = $2)
    ORDER BY rank DESC
    LIMIT $3`;
  const { rows } = await pool.query<SearchHit>(sql, [q, category ?? null, limit]);
  return rows;
```

What's new:
- **`word_similarity($1, name)`** — compares your query against the best-matching single word inside the product name (not the whole string). This avoids short queries scoring too low against long names.
- **`> 0.4`** — the similarity threshold. `1` = perfect match, `0` = nothing in common. `0.4` catches close typos without returning unrelated results.

Your full function should now look like this:

```ts
async function fuzzySearch(q: string, category: string | undefined, limit: number): Promise<SearchHit[]> {
  const sql = `
    SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock,
           word_similarity($1, name) AS rank,
           name AS snippet
    FROM products
    WHERE word_similarity($1, name) > 0.4
      AND ($2::text IS NULL OR category = $2)
    ORDER BY rank DESC
    LIMIT $3`;
  const { rows } = await pool.query<SearchHit>(sql, [q, category ?? null, limit]);
  return rows;
}
```

Search "Choclate" → still finds Chocolate. Search "milj" → now also finds Milk.

---

**2b — autocomplete.**

Find `suggest` — it has a guard line (`if (!prefix.trim()) return [];`) and then
`return []`. Delete that last `return []` and replace it with:

```ts
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
```

What each piece means:
- **`ILIKE '%' || ... || '%'`** — case-insensitive substring match. `ILIKE` is like SQL `LIKE` but ignores upper/lower case. `%` is a wildcard matching any characters.
- **`SELECT DISTINCT name`** — de-duplicates so the same product name only appears once in the dropdown.
- **`CASE WHEN ... THEN 0 / 1 / 2`** — ranks results by quality of match: `0` = name starts with your query (best), `1` = your query starts at a word boundary, `2` = matched anywhere else.
- **`length(name), name`** — tiebreakers: shorter names first, then alphabetical.

Your full function should now look like this:

```ts
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
```

Compare your file against `solutions/search.ts` to confirm everything matches.

## Step 3 — Synonyms & benchmark

**3a — teach PostgreSQL that "softdrink" means "cola".**

Try searching "softdrink" — no results. The word doesn't appear in any product name or
description (only in internal tags, which aren't indexed). You'll fix this by adding a
custom text search configuration that maps "softdrink" → "cola" so both sides match.

The key rule: **the index and the query must use the same text search configuration.**
That means you'll need to update both `search_doc` and the queries in `search.ts`.

---

**Part 1 — the synonym file.**

Open `db/synonyms.ths` — it already exists in the repo:

```
softdrink : cola
```

Left side = the word to catch. Right side = the canonical term to store and match
against. Add more pairs if you like (e.g. `yoghurt : yogurt`). Each line is one
mapping; `#` lines are comments.

---

**Part 2 — install the file in the database.**

Copy the file into the Postgres container, then open psql:

```bash
docker cp db/synonyms.ths search_workshop_db:/usr/share/postgresql/16/tsearch_data/synonyms.ths
docker compose exec db psql -U workshop knuspr
```

Run each of the following statements one at a time:

```sql
-- Register the .ths file as a PostgreSQL dictionary.
-- The 'Dictionary' sub-dictionary (english_stem) normalises words before matching,
-- so "softdrinks" and "softdrink" both hit the same rule.
CREATE TEXT SEARCH DICTIONARY synonyms_dict (
  TEMPLATE = thesaurus,
  DictFile = synonyms,
  Dictionary = pg_catalog.english_stem
);
```

```sql
-- Create a new text search configuration that is a copy of 'english',
-- then layer the synonym dictionary on top of the standard stemmer.
CREATE TEXT SEARCH CONFIGURATION my_english (COPY = pg_catalog.english);

ALTER TEXT SEARCH CONFIGURATION my_english
  ALTER MAPPING FOR asciiword, word, hword, hword_part
  WITH synonyms_dict, english_stem;
```

```sql
-- Verify: "softdrink" should now resolve to the lexeme 'cola'.
SELECT plainto_tsquery('my_english', 'softdrink');
```

Exit with `\q`.

---

**Part 3 — rebuild the search index.**

The `search_doc` generated column is hardcoded to `'english'`. Drop and recreate it
using `'my_english'`. A script is provided:

```bash
docker compose exec -T db psql -U workshop knuspr < db/alter-search.sql
```

> 🪟 **PowerShell:** `Get-Content db/alter-search.sql | docker compose exec -T db psql -U workshop knuspr`

PostgreSQL automatically recomputes all 20 000 rows and rebuilds the GIN index — takes
a few seconds. You may see a brief error in the browser while it runs; that's normal.

---

**Part 4 — update `search.ts`.**

Find every `'english'` string inside `searchProducts` and change it to `'my_english'`.
There are exactly two — one in `websearch_to_tsquery` and one in `ts_headline`:

```ts
// Before:
websearch_to_tsquery('english', immutable_unaccent($1)) AS q
ts_headline('english', description, q, ...)

// After:
websearch_to_tsquery('my_english', immutable_unaccent($1)) AS q
ts_headline('my_english', description, q, ...)
```

Save and reload the browser. Search "softdrink" → Cola Zero products appear. Search
"cola" → same results as before.

> Why both places? The configuration is what maps "softdrink" → "cola". The index uses
> it to store "cola" for documents that say "softdrink". The query uses it to search for
> "cola" when the user types "softdrink". If they don't match, nothing works.

---

**3b — benchmark at 200k rows.**

> 💻 Open a **new terminal** — keep the dev server running in the other one.

```bash
npm run generate -- 200000 && npm run seed && npm run benchmark
```

Seeding takes about a minute. Then watch the numbers — even at 200 000 rows, the
GIN-indexed queries stay in single-digit milliseconds.

## Done

You built a real search index: ranked, highlighted, typo-tolerant, faceted, and
synonym-aware — entirely inside PostgreSQL, driven from TypeScript, all in Docker.
