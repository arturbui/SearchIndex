# Tutorial: build a working grocery search

By the end you'll have a running search box over a Knuspr-style catalog, backed by a
PostgreSQL search index. You implement the search logic; everything else is provided.

**You'll learn by doing:** get the database and a synthetic catalog running, then
write the queries — full-text ranking, highlighting, typo tolerance, autocomplete —
and watch them light up the UI.

> Stuck at any point? `solutions/search.ts` has the finished code, and the
> **Debugging** table at the bottom covers every error we expect you to hit.

---

## Setup

> 💻 **Terminal 1** — open one terminal now; you'll reuse it for all of Setup and
> for Step 1.

#### 1. Prerequisites

```bash
docker --version
node --version
git clone https://github.com/arturbui/SearchIndex.git search-index-workshop
cd search-index-workshop
cp .env.example .env
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

Open `src/search.ts` and start the dev server (this one stays running — open a new
terminal if you need a shell for anything else):

```bash
npm run dev      # http://localhost:3000
```

Type "milk" — no results yet. Implement in order, test in the browser after each sub-step.

---

**1a — basic full-text search.**

The key line that does the actual search — replace `return [];` with a `pool.query` call and type this WHERE clause:

```sql
WHERE search_doc @@ websearch_to_tsquery('english', immutable_unaccent($1))
```

`search_doc` is the pre-built search index column. `@@` checks whether a row matches the query. `websearch_to_tsquery` parses your typed text into a search query (supports phrases, `-exclude`, etc). `immutable_unaccent` strips accents so "Müsli" matches a search for "Musli".

Your function should now look like this:

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

Replace `0::float AS rank` with a score, move the tsquery into the `FROM` clause so you can reuse it in both `WHERE` and `SELECT`, and sort by best match first:

```sql
ts_rank_cd(search_doc, q) AS rank
FROM products,
     websearch_to_tsquery('english', immutable_unaccent($1)) AS q
ORDER BY rank DESC
```

`ts_rank_cd` gives each row a relevance score — hits in the product name count more than hits in the description because of the field weights in `db/schema.sql`. Putting the tsquery in `FROM ... AS q` is just a way to compute it once and reference it by name everywhere.

Your function should now look like this:

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

Replace `'' AS snippet` with a call that extracts a short excerpt from the description and wraps matched words in `<mark>` tags:

```sql
ts_headline('english', description, q,
  'StartSel=<mark>, StopSel=</mark>, MaxFragments=1, MaxWords=16, MinWords=6') AS snippet
```

> ⚠️ **Gotcha:** if you set `MaxWords` below the default `MinWords` (15) you get
> *"MinWords must be less than MaxWords."* Always set both explicitly.

Your function should now look like this:

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

Add the category filter to `WHERE`, update `ORDER BY` with tiebreakers, shift `limit` to `$3`, and fall through to `fuzzySearch` when nothing matches:

```sql
AND ($2::text IS NULL OR category = $2)
ORDER BY rank DESC, in_stock DESC, name
LIMIT $3
```
```ts
[q, category ?? null, limit]
if (rows.length > 0) return rows;
return fuzzySearch(q, category, limit);
```

`$2::text IS NULL OR category = $2` is the standard SQL pattern for an optional filter — when no category is chosen, `$2` is `null` and the filter does nothing. `in_stock DESC, name` keeps the order stable when two products have the same rank.

Your function should now look like this:

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

When full-text search finds nothing, fall back to trigram similarity so typos like
"milj" still find "Milk". The key lines:

```sql
WITH cfg AS (SELECT set_config('pg_trgm.word_similarity_threshold', '0.4', true))
SELECT ... FROM products, cfg
WHERE $1 <% name
ORDER BY word_similarity($1, name) DESC
```

`word_similarity($1, name)` compares your query against the best-matching single word
inside the product name (not the whole name). `$1 <% name` is the indexable version of
that check. The `WITH cfg` lowers the match threshold from 0.6 to 0.4 for this query
only — single-word typos often land exactly at 0.6, and `<%` requires strictly above it.

Your `fuzzySearch` function should look like this:

```ts
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
```

Search "Choclate" → still finds Chocolate. Search "milj" → now also finds Milk.

---

**2b — autocomplete.**

`suggest()` powers the dropdown as you type. The query finds names that contain your
input, then ranks them so prefix matches come first:

```sql
SELECT name FROM (
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
LIMIT $2
```

`ILIKE` is a case-insensitive `LIKE`. The `CASE` ranks results: `0` = name starts with
your query, `1` = your query matches at a word boundary, `2` = matched anywhere else.

Your `suggest` function should look like this:

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

## Step 3 — Stretch goals (remaining time)

- **Synonyms:** create a custom text-search dictionary so "softdrink" matches "cola".
- **Compound words:** install an `ispell`/compound-word dictionary so `milk` matches
  `Wholemilk`/`Oatmilk`. By default `to_tsvector('english', 'Wholemilk')` produces the
  single lexeme `wholemilk`, so a search for `milk` won't match it — splitting compounds
  needs extra dictionary setup. A great "now you see why Elasticsearch exists" moment.
- **Pagination & price filter** in the API.
- **Run the benchmark at 200k:** Terminal 1 is still busy running `npm run dev`, so
  open a **new terminal** for this one:
  ```bash
  npm run generate -- 200000 && npm run seed && npm run benchmark
  ```

## Step 4 — Debugging cheat-sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| `generated column expression is not immutable` | Used `unaccent()` (STABLE) in the generated column / a functional index | Use the `immutable_unaccent()` wrapper (Setup §4) |
| `ECONNREFUSED 127.0.0.1:5432` from Node | DB container not up, or wrong port | `docker compose ps`; check `.env` `POSTGRES_PORT`; `docker compose up -d` |
| `password authentication failed` | `.env` doesn't match compose defaults | Use `workshop`/`workshop`/`knuspr`, or `docker compose down -v` to reset |
| `relation "products" does not exist` | Schema not applied | Run `db/schema.sql` (Setup §4) or `npm run seed` |
| Terminal looks "frozen" / no prompt after a `docker compose exec ... psql -c ...` | Forgot `-T` — Docker allocated a pseudo-TTY, so `psql` piped the (wide `search_doc` column) output through its pager (`less`), which swallows the terminal | Press `q` to quit the pager and get your prompt back. Going forward, always pass `-T` for one-shot `psql -c` / redirected commands (Setup §4-5) — without a TTY, psql skips the pager entirely |
| `MinWords must be less than MaxWords` | `ts_headline` options out of order | Set `MinWords` < `MaxWords` (Step 1c) |
| `text search configuration "english" does not exist` | Typo in the config name | It's lowercase `'english'` |
| Search returns **0** for multi-word input with `LIKE` | `ILIKE '%a b%'` needs the literal substring | That's the point — use `websearch_to_tsquery` instead |
| `milk` doesn't match `Wholemilk`/`Oatmilk` | Compound words aren't split by default | Expected; this is the Step 3 stretch goal |
| Fuzzy search finds nothing for a short typo | Using whole-string `similarity()`/`%` instead of `word_similarity()`/`<%` | See Step 2a — switch operators, and lower the threshold via `set_config` |
| Code edits don't take effect | Not using watch mode | Run `npm run dev` (tsx watch), or restart `npm start` |
| `function websearch_to_tsquery does not exist` | Postgres < 11 | Use the `postgres:16` image from our compose file |
| EXPLAIN shows Seq Scan even for FTS | Table too small for the planner to bother | Seed more rows (≥ ~10k); the GIN index kicks in at scale |

## Done

You built a real search index: ranked, highlighted, typo-tolerant, faceted search over
20k products — entirely inside PostgreSQL, driven from TypeScript, all in Docker.
