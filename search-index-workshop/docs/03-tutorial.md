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

> 💻 **Terminal 1** — open one terminal now; you'll reuse it for Steps 0–4.

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

## Step 1 — Start Postgres with Docker (10 min)

Still in **Terminal 1**:

```bash
docker compose up -d db
docker compose ps        # 'db' should be 'running'/'healthy'
```

Both commands return immediately (`-d` = detached) — Postgres keeps running in the
background, so Terminal 1 is free for the next command.

What just happened: `docker-compose.yml` started **Postgres 16** (port 5432). On
first boot it ran `db/init/00-extensions.sql`, which installed the `unaccent` and
`pg_trgm` extensions and created our `immutable_unaccent()` helper.

> 🔎 **Checkpoint:** `docker compose logs db | grep "database system is ready"`.

## Step 2 — Connect with psql (5 min)

You'll run SQL straight from the terminal throughout the tutorial — no GUI needed.
Still in **Terminal 1**:

```bash
docker compose exec db psql -U workshop knuspr
```

This drops you into an **interactive** `psql` prompt — it takes over Terminal 1
until you exit it. Try `\dt` to list tables (empty for now), then type `\q` and
press Enter to exit back to your normal shell before moving on.

> You'll reopen this same command (same terminal) whenever a later step says
> "run this SQL interactively."

## Step 3 — Create the search index (15 min)

Open `db/schema.sql` in your editor and read the comments. Then, back in
**Terminal 1** (you should have exited `psql` with `\q` already), apply it:

```bash
docker compose exec -T db psql -U workshop knuspr < db/schema.sql
```

> 🪟 **PowerShell:** `<` redirection isn't supported. Pipe the file in instead:
> ```powershell
> Get-Content db/schema.sql | docker compose exec -T db psql -U workshop knuspr
> ```

The `-T` flag makes this a **one-shot, non-interactive** command — it runs and
returns control to Terminal 1 immediately, no `\q` needed.

The key object is the **generated `tsvector` column** plus the **GIN index** on it —
that *is* the search index. Two things to understand before moving on:

1. **Why `immutable_unaccent` and not plain `unaccent`?** Try editing the schema to use
   `unaccent(...)` directly and re-run — Postgres rejects it with *"generated column
   expression is not immutable."* Generated columns may only call IMMUTABLE functions.
   Put it back. (Full explanation in `docs/01-concept.md §4`.)
2. **Why GIN?** It's an inverted index: lexeme → rows. Inspect what got stored — same
   terminal, another one-shot command:
   ```bash
   docker compose exec -T db psql -U workshop knuspr -c "SELECT name, search_doc FROM products LIMIT 0;"
   # empty for now, but note the column type
   ```

## Step 4 — Generate test data with gen AI (10 min)

We need a realistic catalog. `scripts/generate-data.ts` combines a curated grocery
vocabulary (`scripts/catalog.ts`) with `@faker-js/faker` to synthesize products.
Still in **Terminal 1**:

```bash
npm run generate -- 20000     # writes data/products.json (reproducible: faker.seed(42))
npm run seed                  # applies schema + bulk-loads the rows
```

Verify, same terminal, with one-shot `psql -c` commands (no need to enter the
interactive prompt):
```bash
docker compose exec -T db psql -U workshop knuspr -c "SELECT count(*) FROM products;"
docker compose exec -T db psql -U workshop knuspr -c "SELECT name, brand, price_cents, search_doc FROM products LIMIT 5;"
```

> 💡 **Gen-AI shortcut:** want more categories or a different store? Ask your AI
> assistant: *"Add a `CategoryDef` for 'Babybedarf' with 4 archetypes in the style of
> scripts/catalog.ts"*, paste it into the `CATALOG` array, and re-generate. The whole
> data layer is designed to be AI-extensible.

## Step 5 — Write the search query (30 min) — the core of the workshop

Open `src/search.ts`. The server and UI already call `searchProducts()`, but it
returns `[]`. Start the app so you can see your changes live — still **Terminal 1**:

```bash
npm run dev      # http://localhost:3000
```

Unlike the previous commands, this one **does not return** — it's a watch process
that keeps running and reprints logs as you save files. Leave Terminal 1 running
this for the rest of the tutorial; don't type further commands into it. If you need
a shell for anything else from here on (e.g. the Step 7 benchmark), open a **new
terminal**.

Type "milk" — no results yet. Now implement, in order. Type the query into your
search box after each sub-step.

**5a — basic full-text search.** Replace the body of `searchProducts`:

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
Search "organic milk" → results appear. 🎉

**5b — rank by relevance.** Pull the query into a `FROM` alias so you can score it:

```ts
`SELECT id, name, brand, category, subcategory, price_cents, unit, in_stock,
        ts_rank_cd(search_doc, q) AS rank, '' AS snippet
 FROM products, websearch_to_tsquery('english', immutable_unaccent($1)) AS q
 WHERE search_doc @@ q
 ORDER BY rank DESC
 LIMIT $2`
```
Now the most relevant products come first.

**5c — highlight the match.** Swap `'' AS snippet` for:
```ts
ts_headline('english', description, q,
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
`searchProducts` when full-text returns 0 rows. Use `word_similarity()` / the `<%`
operator, not whole-string `similarity()` / `%`:
```ts
WITH cfg AS (SELECT set_config('pg_trgm.word_similarity_threshold', '0.4', true))
SELECT ... FROM products, cfg
WHERE $1 <% name
ORDER BY word_similarity($1, name) DESC
```
> ⚠️ **Why not `name % $1` / `similarity(name, $1)`?** That compares the query
> against the *whole* product name, so a short query loses badly against a longer
> multi-word name — `similarity('milj', 'Lactosefree Milk')` is only `0.16`, under
> the `0.3` default threshold, even though "milj" is a one-letter typo of "milk".
> `word_similarity()` instead matches the query against the best-fitting *word*
> inside the name. Its own default threshold (`0.6`) is still too strict for
> single-word typos — they often land at exactly `0.6`, and `<%` requires
> strictly-greater-than — so we lower it to `0.4` for this query via
> `set_config(..., true)` (scoped to the statement, like `SET LOCAL`).

Search "Choclate" → still finds Chocolate. Search "milj" → now also finds Milk.

**6b — autocomplete.** Implement `suggest()` (prefix match on `name`). The
`/api/suggest` endpoint is already wired; add a datalist to the UI if you have time.

Compare your file against `solutions/search.ts` to confirm.

## Step 7 — Stretch goals (remaining time)

- **Synonyms:** create a custom text-search dictionary so "softdrink" matches "cola".
- **Compound words:** install an `ispell`/compound-word dictionary so `milk` matches
  `Wholemilk`/`Oatmilk` (see `docs/01-concept.md §6` for why this is the hard part).
  A great "now you see why Elasticsearch exists" moment.
- **Pagination & price filter** in the API.
- **Run the benchmark at 200k:** Terminal 1 is still busy running `npm run dev`, so
  open a **new terminal** for this one:
  ```bash
  npm run generate -- 200000 && npm run seed && npm run benchmark
  ```

## Step 8 — Debugging cheat-sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| `generated column expression is not immutable` | Used `unaccent()` (STABLE) in the generated column / a functional index | Use the `immutable_unaccent()` wrapper (Step 3, concept §4) |
| `ECONNREFUSED 127.0.0.1:5432` from Node | DB container not up, or wrong port | `docker compose ps`; check `.env` `POSTGRES_PORT`; `docker compose up -d` |
| `password authentication failed` | `.env` doesn't match compose defaults | Use `workshop`/`workshop`/`knuspr`, or `docker compose down -v` to reset |
| `relation "products" does not exist` | Schema not applied | Run `db/schema.sql` (Step 3) or `npm run seed` |
| Terminal looks "frozen" / no prompt after a `docker compose exec ... psql -c ...` | Forgot `-T` — Docker allocated a pseudo-TTY, so `psql` piped the (wide `search_doc` column) output through its pager (`less`), which swallows the terminal | Press `q` to quit the pager and get your prompt back. Going forward, always pass `-T` for one-shot `psql -c` / redirected commands (Steps 3–4) — without a TTY, psql skips the pager entirely |
| `MinWords must be less than MaxWords` | `ts_headline` options out of order | Set `MinWords` < `MaxWords` (Step 5c) |
| `text search configuration "english" does not exist` | Typo in the config name | It's lowercase `'english'` |
| Search returns **0** for multi-word input with `LIKE` | `ILIKE '%a b%'` needs the literal substring | That's the point — use `websearch_to_tsquery` instead |
| `milk` doesn't match `Wholemilk`/`Oatmilk` | Compound words aren't split by default | Expected; this is the Step 7 stretch goal |
| Code edits don't take effect | Not using watch mode | Run `npm run dev` (tsx watch), or restart `npm start` |
| `function websearch_to_tsquery does not exist` | Postgres < 11 | Use the `postgres:16` image from our compose file |
| EXPLAIN shows Seq Scan even for FTS | Table too small for the planner to bother | Seed more rows (≥ ~10k); the GIN index kicks in at scale |

## Done

You built a real search index: ranked, highlighted, typo-tolerant, faceted search over
20k products — entirely inside PostgreSQL, driven from TypeScript, all in Docker.
