# Block 2 — Demo (30 min)

**Goal:** show one scenario where the search index clearly wins, with a live
benchmark and a comparison against the plain relational approach.

**Setup before the room arrives:**
```bash
docker compose --profile demo up -d   # Postgres + pgAdmin (demo-only)
npm install
npm run generate -- 1000000
npm run seed
```
Open pgAdmin (<http://localhost:5050>) → Workshop DB → `knuspr` → Query Tool, and open
`db/demo-queries.sql`. Each block is standalone — select it and press **F5**.

---

## Act 1 — "LIKE is both slow *and* wrong" (the headline result)

Run the two plans from `db/demo-queries.sql` block 7. On our 60 000-row catalog we
measured (your numbers will differ; the *shape* won't):

| Query | Plan | Execution time | Rows found |
|-------|------|---------------:|-----------:|
| `ILIKE '%dark chocolate%'` | **Seq Scan** (reads all 1 000 000 rows) | **~600 ms** | few |
| `search_doc @@ websearch_to_tsquery('english','dark chocolate')` | **Bitmap Index Scan** on `products_search_idx` | **~3 ms** | more |

Two punchlines, not one:

1. **~25× faster.** The GIN index turns a full-table scan into an index lookup.
2. **The fast one is also the *correct* one.** `ILIKE '%dark chocolate%'` matches only
   the exact substring. Full-text search stems `chocolate` and matches every product
   that contains any form of the word across name, brand, and description. This is the
   slide to linger on: the relational shortcut doesn't just lose on speed, it silently
   misses results.

Reading the `EXPLAIN ANALYZE`: point at `Seq Scan` + `Rows Removed by Filter: 60000`
for ILIKE, vs `Bitmap Index Scan on products_search_idx` for FTS.

> Honesty note for the room: a `pg_trgm` GIN index *can* accelerate `ILIKE`. But it
> still can't stem, rank, or understand word boundaries — so it's faster wrong, not
> right. That's exactly why a real search index exists.

## Act 2 — the things `LIKE` can never do (run blocks 1–6)

- **Block 1 — relevance ranking.** `ts_rank_cd` + the A–D field weights. *"Organic
  Lactosefree Milk"* (two query words in the name) outranks a product that only
  mentions milk in its description. A relational `LIKE` has no concept of "more
  relevant."
- **Block 2 — highlighting.** `ts_headline` returns the snippet with the match in
  `<b>…</b>`, exactly like the bold terms in Google results.
- **Block 3 — stemming.** Show `to_tsvector('english', …)` vs `to_tsvector('simple', …)`.
  The English dictionary reduces "beans"→"bean", so singular/plural just work.
- **Block 4 — typo tolerance.** `name % 'Choclate'` still finds "Chocolate" via
  trigram similarity.
- **Block 5 — autocomplete.** `to_tsquery('english','oat:*')` → Oatmilk Barista…
- **Block 6 — faceting.** Search + `GROUP BY category` = the "Fruits & Vegetables (12),
  Beverages (5)" sidebar, in one query, on the same data, in the same transaction.

## Act 3 — run the scripted benchmark (optional, 2 min)

```bash
npm run benchmark
```
This times five real queries, prints a speedup table, and dumps both `EXPLAIN ANALYZE`
plans. For the most dramatic gap, re-seed at 1 000 000 rows first.

## The one-sentence conclusion

> For a grocery catalog of this size, you don't need a separate search engine — a
> `tsvector` column with a GIN index gives you ranked, highlighted, typo-tolerant
> search that is **25× faster and actually correct** compared to the relational
> `LIKE` everyone reaches for first.

*(Then preview the honest limits from Block 1 §6: this stops scaling somewhere, and
German compound words are the first crack — which is a nice segue if anyone asks
"why does Elasticsearch exist then?")*
