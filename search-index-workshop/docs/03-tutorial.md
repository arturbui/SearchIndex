# Block 3 — Tutorial (2 h): build a working grocery search

By the end you'll have a running search box over a Knuspr-style catalog, backed by a
PostgreSQL search index. You implement the search logic; everything else is provided.

**You'll learn by doing:** start the database, create the index, load AI-generated
data, then write the queries — full-text ranking, highlighting, typo tolerance,
autocomplete — and watch them light up the UI.

> Stuck at any point? `solutions/search.ts` has the finished code, and the
> **Debugging** table at the bottom covers every error we expect you to hit.

---

## Step 0 — Prerequisites (5 min)

You need **Docker Desktop running**, **Node ≥ 20**, and an editor. Check:

```bash
docker --version
node --version
```

Clone the repo and install JS dependencies:

```bash
git clone <repo-url> search-index-workshop
cd search-index-workshop
cp .env.example .env
npm install
```

## Step 1 — Start Postgres + pgAdmin with Docker (10 min)

```bash
docker compose up -d
docker compose ps        # both 'db' and 'pgadmin' should be 'running'/'healthy'
```

What just happened: `docker-compose.yml` started **Postgres 16** (port 5432) and
**pgAdmin 4** (port 5050). On first boot Postgres ran `db/init/00-extensions.sql`,
which installed the `unaccent` and `pg_trgm` extensions and created our
`immutable_unaccent()` helper.

> 🔎 **Checkpoint:** `docker compose logs db | grep "database system is ready"`.

## Step 2 — Connect through pgAdmin (5 min)

Open <http://localhost:5050>. Log in with `admin@workshop.local` / `workshop`.
The **"Workshop DB"** server is already registered — expand it (password `workshop`),
then open `knuspr` → **Query Tool**. You'll run SQL here throughout.

## Step 3 — Create the search index (15 min)

Open `db/schema.sql`, read the comments, and run it in the Query Tool (or via
`docker compose exec -T db psql -U workshop knuspr < db/schema.sql`).

The key object is the **generated `tsvector` column** plus the **GIN index** on it —
that *is* the search index. Two things to understand before moving on:

1. **Why `immutable_unaccent` and not plain `unaccent`?** Try editing the schema to use
   `unaccent(...)` directly and re-run — Postgres rejects it with *"generated column
   expression is not immutable."* Generated columns may only call IMMUTABLE functions.
   Put it back. (Full explanation in `docs/01-concept.md §4`.)
2. **Why GIN?** It's an inverted index: lexeme → rows. Inspect what got stored:
   ```sql
   SELECT name, search_doc FROM products LIMIT 0;  -- empty for now, but note the column type
   ```

## Step 4 — Generate test data with gen AI (10 min)

We need a realistic catalog. `scripts/generate-data.ts` combines a curated grocery
vocabulary (`scripts/catalog.ts`) with `@faker-js/faker` to synthesize products.

```bash
npm run generate -- 20000     # writes data/products.json (reproducible: faker.seed(42))
npm run seed                  # applies schema + bulk-loads the rows
```

Verify in pgAdmin:
```sql
SELECT count(*) FROM products;
SELECT name, brand, price_cents, search_doc FROM products LIMIT 5;
```

> 💡 **Gen-AI shortcut:** want more categories or a different store? Ask your AI
> assistant: *"Add a `CategoryDef` for 'Babybedarf' with 4 archetypes in the style of
> scripts/catalog.ts"*, paste it into the `CATALOG` array, and re-generate. The whole
> data layer is designed to be AI-extensible.

## Step 5 — Write the search query (30 min) — the core of the workshop

Open `src/search.ts`. The server and UI already call `searchProducts()`, but it
returns `[]`. Start the app so you can see your changes live:

```bash
npm run dev      # http://localhost:3000
```

Type "milch" — no results yet. Now implement, in order. Type the query into your
search box after each sub-step.

**5a — basic full-text search.** Replace the body of `searchProducts`:

```ts
const { rows } = await pool.query<SearchHit>(
  `SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock,
          0::float AS rank, '' AS snippet
   FROM products
   WHERE search_doc @@ websearch_to_tsquery('german', immutable_unaccent($1))
   LIMIT $2`,
  [q, limit],
);
return rows;
```
Search "bio milch" → results appear. 🎉

**5b — rank by relevance.** Pull the query into a `FROM` alias so you can score it:

```ts
`SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock,
        ts_rank_cd(search_doc, q) AS rank, '' AS snippet
 FROM products, websearch_to_tsquery('german', immutable_unaccent($1)) AS q
 WHERE search_doc @@ q
 ORDER BY rank DESC
 LIMIT $2`
```
Now the most relevant products come first.

**5c — highlight the match.** Swap `'' AS snippet` for:
```ts
ts_headline('german', description, q,
  'StartSel=<mark>, StopSel=</mark>, MaxFragments=1, MinWords=6, MaxWords=16') AS snippet
```
> ⚠️ **Gotcha (you will hit this):** if you set `MaxWords` below the default
> `MinWords` (15) you get *"MinWords must be less than MaxWords."* Always set both.

**5d — category filter.** Add `$2` for category and shift `limit` to `$3`:
```ts
WHERE search_doc @@ q AND ($2::text IS NULL OR category = $2)
...
[q, category ?? null, limit]
```
Pick a category in the dropdown — results narrow.

## Step 6 — Typo tolerance & autocomplete (20 min)

**6a — fuzzy fallback.** Implement `fuzzySearch()` (trigram similarity) and call it from
`searchProducts` when full-text returns 0 rows:
```ts
WHERE name % $1 ORDER BY similarity(name, $1) DESC
```
Search "Schoklade" → still finds Schokolade.

**6b — autocomplete.** Implement `suggest()` (prefix match on `name`). The
`/api/suggest` endpoint is already wired; add a datalist to the UI if you have time.

Compare your file against `solutions/search.ts` to confirm.

## Step 7 — Stretch goals (remaining time)

- **Synonyms:** create a custom text-search dictionary so "softdrink" matches "cola".
- **German compounds:** install an `ispell`/`GermanCompoundWords` dictionary so
  `milch` matches `Hafermilch` (see `docs/01-concept.md §6` for why this is the hard
  part). A great "now you see why Elasticsearch exists" moment.
- **Pagination & price filter** in the API.
- **Run the benchmark at 200k:** `npm run generate -- 200000 && npm run seed && npm run benchmark`.

## Step 8 — Debugging cheat-sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| `generated column expression is not immutable` | Used `unaccent()` (STABLE) in the generated column / a functional index | Use the `immutable_unaccent()` wrapper (Step 3, concept §4) |
| `ECONNREFUSED 127.0.0.1:5432` from Node | DB container not up, or wrong port | `docker compose ps`; check `.env` `POSTGRES_PORT`; `docker compose up -d` |
| `password authentication failed` | `.env` doesn't match compose defaults | Use `workshop`/`workshop`/`knuspr`, or `docker compose down -v` to reset |
| `relation "products" does not exist` | Schema not applied | Run `db/schema.sql` (Step 3) or `npm run seed` |
| `MinWords must be less than MaxWords` | `ts_headline` options out of order | Set `MinWords` < `MaxWords` (Step 5c) |
| `text search configuration "german" does not exist` | Typo in the config name | It's lowercase `'german'` |
| Search returns **0** for multi-word input with `LIKE` | `ILIKE '%a b%'` needs the literal substring | That's the point — use `websearch_to_tsquery` instead |
| `milch` doesn't match `Hafermilch` | German compounds aren't split by default | Expected; this is the Step 7 stretch goal |
| Code edits don't take effect | Not using watch mode | Run `npm run dev` (tsx watch), or restart `npm start` |
| `function websearch_to_tsquery does not exist` | Postgres < 11 | Use the `postgres:16` image from our compose file |
| EXPLAIN shows Seq Scan even for FTS | Table too small for the planner to bother | Seed more rows (≥ ~10k); the GIN index kicks in at scale |

## Done

You built a real search index: ranked, highlighted, typo-tolerant, faceted search over
20k products — entirely inside PostgreSQL, driven from TypeScript, all in Docker.
