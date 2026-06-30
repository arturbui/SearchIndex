# Search Index Workshop — PostgreSQL Full-Text Search

> A hands-on tutorial. Our "search index" is **PostgreSQL's own full-text
> search** (a `tsvector` column backed by a **GIN** index), built over a
> Knuspr-style online grocery catalog. Stack: **Docker · TypeScript**.

The whole point: a search index is not a separate product you bolt on — Postgres
*is* a competent search engine if you know which knobs to turn.

---

## Tutorial

| Material | Description |
|---|---|
| [`docs/03-tutorial.md`](docs/03-tutorial.md) | Build a working grocery search, step by step. |
| [`docs/05-line-by-line.md`](docs/05-line-by-line.md) | Same tutorial, but every SQL clause is introduced and explained on its own — useful if you want to understand every line before typing it. |

`solutions/search.ts` has the finished, working implementation if you get stuck
or want to check your work.

## Quickstart

```bash
cp .env.example .env
docker compose up -d            # Postgres only
npm install
npm run generate -- 20000       # AI-style generated grocery catalog -> data/products.json
npm run seed                    # schema + bulk load
npm run dev                     # http://localhost:3000
```

Then follow `docs/03-tutorial.md` (or `docs/05-line-by-line.md`) starting from
Step 5 — `src/search.ts` is the stub you'll fill in.

## Repo layout

```
docker-compose.yml      Postgres 16
db/
  init/00-extensions.sql  auto-run on first boot: unaccent, pg_trgm, immutable_unaccent()
  schema.sql              products table + GIN/trigram indexes (the search index)
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
docs/                       the tutorial
```

## Requirements

Docker Desktop, Node ≥ 20, and any editor. Nothing else to install — Postgres
runs in a container.
