# Search Index Workshop — PostgreSQL Full-Text Search

> A 3-hour, hands-on workshop. Our "search index" is **PostgreSQL's own full-text
> search** (a `tsvector` column backed by a **GIN** index), built over a
> Knuspr-style online grocery catalog. Stack: **Docker · TypeScript** (pgAdmin 4
> is used only for the live demo in Block 2 — the tutorial is hands-on coding).

The whole point: a search index is not a separate product you bolt on — Postgres
*is* a competent search engine if you know which knobs to turn. We show where that
holds up, and (honestly) where it doesn't.

---

## Agenda (3 h)

| # | Block | Time | Material |
|---|-------|------|----------|
| 1 | **Concept** — what a search index is, and how Postgres does it | 30 min | [`docs/01-concept.md`](docs/01-concept.md) |
| 2 | **Demo** — full-text search vs. a relational `LIKE`, live | 30 min | [`docs/02-demo.md`](docs/02-demo.md), [`db/demo-queries.sql`](db/demo-queries.sql) |
| 3 | **Tutorial** — build a working grocery search, step by step | 2 h | [`docs/03-tutorial.md`](docs/03-tutorial.md) |

## Quickstart (presenters)

```bash
cp .env.example .env
docker compose up -d            # Postgres only
npm install
npm run generate -- 60000       # AI-style generated grocery catalog -> data/products.json
npm run seed                    # schema + bulk load
cp solutions/search.ts src/search.ts   # use the finished search code
npm run dev                     # http://localhost:3000
```

For the Block 2 demo only, start pgAdmin too:
```bash
docker compose --profile demo up -d
```
pgAdmin: <http://localhost:5050> (login `admin@workshop.local` / `workshop`; the
"Workshop DB" server is pre-registered, password `workshop`).

## Repo layout

```
docker-compose.yml      Postgres 16 + pgAdmin 4 (demo-only, `--profile demo`)
db/
  init/00-extensions.sql  auto-run on first boot: unaccent, pg_trgm, immutable_unaccent()
  schema.sql              products table + GIN/trigram indexes (the search index)
  demo-queries.sql        the live demo (Block 2) — run these in pgAdmin
  pgadmin/servers.json    pre-registers the DB connection
scripts/
  catalog.ts              hand-curated grocery vocabulary
  generate-data.ts        builds data/products.json
  seed.ts                 loads JSON into Postgres
  benchmark.ts            FTS vs ILIKE, with EXPLAIN ANALYZE
src/
  db.ts                   connection pool
  search.ts               >>> YOUR STUB (the tutorial fills this in) <<<
  server.ts               Express API + static UI
solutions/search.ts       reference implementation
public/index.html          tiny search UI
docs/                       the three workshop blocks
```

## How the three of us split it

- **Person A — Concept (Block 1):** present `docs/01-concept.md`. Owns: inverted
  index, `tsvector`/`tsquery`, GIN, ranking, the honest "Postgres vs Elasticsearch"
  comparison.
- **Person B — Demo (Block 2):** drive `db/demo-queries.sql` in pgAdmin + run
  `npm run benchmark`. Owns: relevance, highlighting, typo tolerance, the EXPLAIN.
- **Person C — Tutorial (Block 2h):** lead `docs/03-tutorial.md`, keep students in
  sync, work the debugging table. Owns the live coding of `src/search.ts`.

## Requirements

Docker Desktop, Node ≥ 20, and any editor. Nothing else to install — Postgres
(and, for the demo only, pgAdmin) run in containers.
