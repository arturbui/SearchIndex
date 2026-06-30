# Line-by-line tutorial: build `solutions/search.ts` by hand (2 h)

This is the same workshop as `docs/03-tutorial.md`, but the search-query steps are
broken into much smaller increments. Each increment adds **one clause** to the SQL
string in `src/search.ts`, explains what that clause does on its own, and gives
you a checkpoint to run before moving to the next line. The TypeScript around
the SQL is just a template literal + `pool.query(sql, params)` — almost all of
the actual work happens inside the SQL string. By the end your `src/search.ts`
matches `solutions/search.ts` exactly.

> Stuck at any point? `solutions/search.ts` has the finished code, and the
> **Debugging** table at the bottom covers every error we expect you to hit.

---

## Setup (20 min)

> 💻 **Terminal 1** — open one terminal now; you'll reuse it for all of Setup and
> for Step 1.

#### 1. Prerequisites

```bash
docker --version
node --version
git clone <repo-url> search-index-workshop
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
`\dt` to list tables, `\q` to exit. For one-off commands, skip the interactive
prompt: `docker compose exec -T db psql -U workshop knuspr -c "<sql>"`.

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

## Step 1 — Write the search query, one clause at a time (45 min) — the core of the workshop

Open `src/search.ts` and start the dev server (this one stays running — open a new
terminal for `psql` tests or anything else):

```bash
npm run dev      # http://localhost:3000
```

Type "milk" in the search box — no results yet. We're going to build the final
query in `solutions/search.ts` one line at a time. After each sub-step, save the
file and re-run the search in the browser.

**1a — match, nothing else.** The smallest query that can return a row at all:
```sql
SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock
FROM products
WHERE search_doc @@ websearch_to_tsquery('english', immutable_unaccent($1))
LIMIT $2
```
- `websearch_to_tsquery('english', ...)` turns your typed text into a `tsquery` —
  the same kind of object Google-style search bars parse ("milk -lactose" works).
- `immutable_unaccent($1)` strips accents from *your query* before it's parsed,
  mirroring what the generated `search_doc` column already did to the *stored* text.
- `search_doc @@ q` is the actual index lookup: "does this row's tsvector contain
  a match for this tsquery?" `@@` is the operator the GIN index on `search_doc`
  accelerates — nothing here scans the whole table.

In TypeScript:
```ts
const { rows } = await pool.query<SearchHit>(
  `SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock
   FROM products
   WHERE search_doc @@ websearch_to_tsquery('english', immutable_unaccent($1))
   LIMIT $2`,
  [q, limit],
);
return rows;
```
> ⚠️ This won't compile yet — `SearchHit` requires `rank` and `snippet` too.
> Add `0::float AS rank, '' AS snippet` to the `SELECT` list for now; we'll
> replace both in the next sub-steps.

Search "organic milk" → results appear, unranked, no snippet. 🎉

**1b — stop computing the tsquery twice.** Right now if you wanted to also
*rank* by the tsquery, you'd have to repeat the whole
`websearch_to_tsquery('english', immutable_unaccent($1))` expression a second
time in the `SELECT` list — easy to typo, wasteful to recompute. Instead, compute
it once and give it a name by putting it in the `FROM` list as a one-row,
one-column "table":
```sql
FROM products,
     websearch_to_tsquery('english', immutable_unaccent($1)) AS q
WHERE search_doc @@ q
```
This is an implicit cross join between `products` and a single-row virtual table
`q` — since `q` only ever has one row, it behaves exactly like a variable you can
now reference anywhere else in the query. Re-run "organic milk" — same results,
same behavior, just cleaner SQL. This is purely a refactor; nothing should change
in the browser yet.

**1c — rank by relevance.** Replace `0::float AS rank` with:
```sql
ts_rank_cd(search_doc, q) AS rank
```
`ts_rank_cd` scores how well a row's `search_doc` matches the query `q` — more
matching lexemes, matches in higher-weighted fields (recall the `setweight(...,
'A'/'B'/'C'/'D')` calls in `db/schema.sql`), and matches close together (`_cd` =
"cover density") all push the score up. Now add an `ORDER BY`:
```sql
ORDER BY rank DESC
```
Search "organic milk" again — the most relevant products now come first instead
of in arbitrary row order.

**1d — highlight the match.** Replace `'' AS snippet` with:
```sql
ts_headline('english', description, q,
  'StartSel=<mark>, StopSel=</mark>, MaxFragments=1, MaxWords=16, MinWords=6') AS snippet
```
Reading the options left to right:
- `'english', description, q` — re-run the same tsquery `q` against the raw
  `description` column (not `search_doc`) so `ts_headline` can find the matching
  words *in context* and return surrounding text, not just a yes/no match.
- `StartSel=<mark>, StopSel=</mark>` — wrap each matched word in `<mark>` tags;
  `public/index.html` renders those directly, which is why matches show up
  highlighted in the UI.
- `MaxFragments=1` — return one excerpt, not several scattered snippets.
- `MinWords=6, MaxWords=16` — pad the excerpt to a readable length even if the
  matched word is very short.

> ⚠️ **Gotcha (you will hit this):** if you set `MaxWords` below the default
> `MinWords` (15) you get *"MinWords must be less than MaxWords."* Always set both.

Search "organic milk" → each result now shows a highlighted snippet from its
description.

**1e — add the category filter.** Add a second parameter and shift `limit` to
`$3`:
```sql
WHERE search_doc @@ q
  AND ($2::text IS NULL OR category = $2)
...
LIMIT $3
```
```ts
[q, category ?? null, limit]
```
`$2::text IS NULL OR category = $2` is the standard "optional filter" pattern:
when the UI doesn't send a category, `$2` is `null`, the left side of the `OR` is
true, and the whole `AND` clause is a no-op. When a category *is* sent, only the
right side matters. Pick a category in the dropdown — results narrow.

**1f — deterministic ordering.** Finish the `ORDER BY`:
```sql
ORDER BY rank DESC, in_stock DESC, name
```
Two rows can tie on `rank` (e.g. both contain "milk" once). `in_stock DESC`
breaks the tie by surfacing items you can actually buy first; `name` breaks any
remaining tie alphabetically so the result order is stable across repeated
searches instead of depending on physical row order in the table.

**1g — wire in the fallback.** Last piece of `searchProducts`: if full-text
search finds nothing, fall through to typo-tolerant search instead of just
showing an empty page:
```ts
const { rows } = await pool.query<SearchHit>(sql, [q, category ?? null, limit]);
if (rows.length > 0) return rows;

return fuzzySearch(q, category, limit);
```
`searchProducts` is now complete and matches `solutions/search.ts`. Search a
nonsense string like "xyzxyz" — you'll get `[]` until Step 2 implements
`fuzzySearch`.

## Step 2 — Typo tolerance & autocomplete (30 min)

**2a — fuzzy fallback, one clause at a time.** `fuzzySearch()` only runs when
full-text search returned zero rows, so it needs to tolerate misspellings.

*Why not the obvious `name % $1` / `similarity(name, $1)`?* Try it first so you
can see it fail:
```sql
SELECT name, similarity(name, $1) AS rank
FROM products
WHERE name % $1
ORDER BY rank DESC
```
Search "milj" (a typo of "milk") → **zero rows**, even though "Lactosefree Milk"
is right there. `similarity()` compares your query against the **entire** product
name, so a 4-character query loses badly against a longer multi-word name —
`similarity('milj', 'Lactosefree Milk')` is only `0.16`, under the `0.3` default
threshold. The fix is `word_similarity()`, which matches your query against the
single best-fitting *word* inside the name instead of the whole string:
```sql
SELECT name, word_similarity($1, name) AS rank
FROM products
WHERE $1 <% name
ORDER BY rank DESC
```
- `word_similarity($1, name)` — trigram similarity between `$1` and the
  best-matching word-sized substring of `name`.
- `$1 <% name` — the indexable boolean form of the same check: "is
  `word_similarity($1, name)` above the configured threshold?" Argument order
  matters: `$1 <% name` means "$1 is the short query, name is the text to search
  within" (the commutator `name %> $1` means the same thing, reversed).

Re-run "milj" → now matches "...Lactosefree Milk", but notice the scores are all
exactly `0.6` — right at Postgres's default `pg_trgm.word_similarity_threshold`.
Single-word typos routinely land exactly on that boundary, and `<%` requires
**strictly greater than** the threshold, so some real near-misses still get
dropped. Lower the threshold for this query only:
```sql
WITH cfg AS (SELECT set_config('pg_trgm.word_similarity_threshold', '0.4', true))
SELECT name, word_similarity($1, name) AS rank
FROM products, cfg
WHERE $1 <% name
ORDER BY rank DESC
```
- `set_config('pg_trgm.word_similarity_threshold', '0.4', true)` — the third
  argument `true` scopes the change to the current transaction only (like `SET
  LOCAL`), so it doesn't leak into other queries on the same pooled connection.
- `WITH cfg AS (...)` wraps that `set_config` call in a CTE. `set_config` is a
  side-effecting (`VOLATILE`) function, so Postgres can't fold/reorder it away —
  this guarantees it actually runs.
- `FROM products, cfg` — same cross-join-with-a-one-row-table trick as Step 1b,
  here purely to force `cfg` (and its side effect) to execute as part of this
  statement.

Now add the category filter and limit to match `searchProducts`'s signature,
and snippet (just the name itself — there's no description match to highlight
for a fuzzy result):
```sql
WITH cfg AS (SELECT set_config('pg_trgm.word_similarity_threshold', '0.4', true))
SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock,
       word_similarity($1, name) AS rank,
       name AS snippet
FROM products, cfg
WHERE $1 <% name
  AND ($2::text IS NULL OR category = $2)
ORDER BY rank DESC
LIMIT $3
```
Search "Choclate" → still finds Chocolate. Search "milj" → now also finds Milk.

**2b — autocomplete, one clause at a time.** `suggest()` powers the `/api/suggest`
endpoint (already wired up — add a `<datalist>` to the UI if you have time).

Start with the simplest possible version — prefix match:
```sql
SELECT DISTINCT name FROM products
WHERE name ILIKE $1 || '%'
LIMIT $2
```
Type "choc" into a manual test (`docker compose exec -T db psql -U workshop
knuspr -c "..."`, substituting the literal text for `$1`) — this only matches
names that *start* with "choc". Switch to a "contains" match so a query like
"milk" also surfaces "Organic Wholemilk":
```sql
WHERE name ILIKE '%' || $1 || '%'
```
Now make it accent-insensitive, same trick as Step 1a — wrap **both** sides in
`immutable_unaccent` so e.g. "cafe" still matches "Café":
```sql
WHERE immutable_unaccent(name) ILIKE '%' || immutable_unaccent($1) || '%'
```
> ⚠️ **Index gotcha:** the trigram index in `db/schema.sql` has to be built on
> the *exact same expression* you filter on. An index on plain `name` won't
> accelerate a query that filters on `immutable_unaccent(name)` — Postgres will
> silently fall back to a sequential scan. That's why `db/schema.sql` has a
> dedicated `products_name_unaccent_trgm_idx` on
> `immutable_unaccent(name) gin_trgm_ops`, not just `name`. You can confirm this
> yourself: `EXPLAIN ANALYZE` the query above and look for `Bitmap Index Scan on
> products_name_unaccent_trgm_idx` rather than `Seq Scan`.

A plain "contains" match has no sense of *where* the match is — "Wholemilk" and
"Milk Chocolate" both just "contain" the letters, in any order of relevance. Add
ranking so prefix matches outrank word-boundary matches, which outrank matches
buried mid-word, wrapped in a subquery so we can `ORDER BY` something that isn't
in the `SELECT DISTINCT` list:
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
Reading the `CASE`: rank `0` if the name *starts with* your query, `1` if your
query starts right after a space (a whole-word match anywhere in the name), and
`2` for everything else (matched mid-word). Within each rank, `length(name)`
prefers shorter/more-specific names, and `name` breaks any remaining tie
alphabetically. Type "milk" in the search box's autocomplete — short, prefix-y
names like "Milk" should now outrank "Organic Lactosefree Milk".

Compare your file against `solutions/search.ts` to confirm — it should now match
exactly.

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
| `MinWords must be less than MaxWords` | `ts_headline` options out of order | Set `MinWords` < `MaxWords` (Step 1d) |
| `text search configuration "english" does not exist` | Typo in the config name | It's lowercase `'english'` |
| Search returns **0** for multi-word input with `LIKE` | `ILIKE '%a b%'` needs the literal substring | That's the point — use `websearch_to_tsquery` instead |
| `milk` doesn't match `Wholemilk`/`Oatmilk` | Compound words aren't split by default | Expected; this is the Step 3 stretch goal |
| Fuzzy search finds nothing for a short typo | Using whole-string `similarity()`/`%` instead of `word_similarity()`/`<%` | See Step 2a — switch operators, and lower the threshold via `set_config` |
| `EXPLAIN` shows `Seq Scan` for the autocomplete query | Index built on `name`, query filters on `immutable_unaccent(name)` | The index must match the exact filtered expression — see the Step 2b gotcha |
| Code edits don't take effect | Not using watch mode | Run `npm run dev` (tsx watch), or restart `npm start` |
| `function websearch_to_tsquery does not exist` | Postgres < 11 | Use the `postgres:16` image from our compose file |
| EXPLAIN shows Seq Scan even for FTS | Table too small for the planner to bother | Seed more rows (≥ ~10k); the GIN index kicks in at scale |

## Done

You built a real search index: ranked, highlighted, typo-tolerant, faceted search over
20k products — entirely inside PostgreSQL, driven from TypeScript, all in Docker.
