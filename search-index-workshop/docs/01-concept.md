# Block 1 — Concept (30 min)

*The "search index" we present is PostgreSQL full-text search. No marketing — here
is what it actually is and how it works.*

## 1. The problem with `LIKE`

A shop search box has to answer "show me products matching *bio milch*". The naive
relational answer is:

```sql
SELECT * FROM products WHERE name ILIKE '%bio milch%';
```

Three things are wrong with this:

1. **It's a substring match, not a word match.** `'%bio milch%'` only matches if the
   exact string "bio milch" appears. Our product is *"Bio Frische Vollmilch"* — the
   words are there but not adjacent, so this returns **nothing**.
2. **It can't rank.** Every match is equally "true". There is no notion of *"the word
   is in the product name, so it's more relevant than a word buried in the description"*.
3. **It can't use an index.** A leading `%` means Postgres must read every row — a
   **sequential scan**. Fine for 500 rows, painful for 5 million.

## 2. The idea: an inverted index

Search engines flip the data around. Instead of *row → text*, they store *word → list
of rows that contain it*. That's an **inverted index** — the same structure behind
Google, Lucene/Elasticsearch, and Postgres FTS.

```
"milch"  -> [12, 88, 415, ...]
"bio"    -> [3, 12, 415, ...]
```

A search for `bio AND milch` becomes a fast intersection of two short lists instead
of a scan over the whole table.

## 3. How Postgres does it: `tsvector`, `tsquery`, GIN

Postgres builds this in with three pieces:

- **`tsvector`** — a document reduced to normalized *lexemes* with positions. Building
  it does three jobs: lowercase + tokenise, drop **stop words** ("und", "der", "mit"),
  and **stem** words to a root via a language dictionary (`'german'`): *Bohnen → bohn*,
  *aromatische → aromat*. So "Kaffeebohne" and "Kaffeebohnen" match.

  ```sql
  SELECT to_tsvector('german', 'Frische Bio Vollmilch 3,5%');
  -- 'bio':2  'frisch':1  'vollmilch':3
  ```

- **`tsquery`** — the search terms, normalised the same way, combined with `&` `|` `!`.
  For user input we use `websearch_to_tsquery('german', 'bio milch')` → `'bio' & 'milch'`
  (it also understands quotes and `-exclude`, like a real search box).

- **The match operator `@@`** — `tsvector @@ tsquery` is true when the document
  satisfies the query.

- **GIN index** — a *Generalized Inverted Index*. This is literally the word → rows
  map from §2. `CREATE INDEX ... USING GIN (search_doc)` is what makes `@@` fast.

## 4. Our schema decisions (see `db/schema.sql`)

**Generated column.** We don't store the `tsvector` by hand or maintain a trigger; we
let Postgres keep it in sync:

```sql
search_doc tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('german', immutable_unaccent(coalesce(name,''))),        'A') ||
  setweight(to_tsvector('german', immutable_unaccent(coalesce(brand,''))),       'B') ||
  setweight(to_tsvector('german', immutable_unaccent(coalesce(category,'')...)), 'C') ||
  setweight(to_tsvector('german', immutable_unaccent(coalesce(description,''))), 'D')
) STORED
```

**Field weights A–D.** A hit in the *name* (A) should rank above a hit in the
*description* (D). `setweight` tags each lexeme; `ts_rank_cd` later uses those weights.

**The `immutable_unaccent` gotcha — the most instructive part.** We want accent/umlaut
folding so "Musli" finds "Müsli" and "creme" finds "Crème". The obvious move is to wrap
the text in `unaccent()`. It fails:

```
ERROR: generated column expression is not immutable
```

Why? A `GENERATED` column (and any functional index) may only call **IMMUTABLE**
functions — ones guaranteed to return the same output forever for the same input.
`unaccent()` is only marked **STABLE**, because in principle its dictionary could be
reloaded. The fix is a thin immutable wrapper that pins the dictionary:

```sql
CREATE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS $$ SELECT unaccent('unaccent', $1) $$;
```

This exact error trips up almost everyone the first time — students will hit it in the
tutorial, and now they'll know why.

## 5. Ranking, highlighting, typos — for free

- **Ranking:** `ts_rank_cd(search_doc, query)` → order by relevance.
- **Highlighting:** `ts_headline(...)` returns the matched snippet with `<mark>` tags.
- **Typo tolerance:** the `pg_trgm` extension adds trigram **similarity**, so
  `name % 'Schoklade'` still finds "Schokolade". We use it as a fallback when full-text
  returns nothing.
- **Autocomplete:** prefix queries with `to_tsquery('german','haf:*')`.

## 6. Honest limits — when *not* to use Postgres FTS

This matters more than the sales pitch. Postgres full-text search is excellent when:
search is *secondary* to your transactional data, your corpus is up to a few million
rows, and you want one system, ACID-consistent, no extra moving parts.

Reach for a dedicated engine (Elasticsearch / OpenSearch / Typesense / Meilisearch)
when you need:

- **Compound-word splitting / heavy linguistics out of the box.** German is the classic
  case: by default `to_tsvector('german', 'Hafermilch')` is the single lexeme
  `hafermilch`, so a search for `milch` *won't* match it. Real engines (or a Postgres
  `ispell`/GermanCompoundWords dictionary, which is extra setup) split compounds.
- **Typo tolerance as a first-class feature**, fuzzy ranking, synonyms, did-you-mean.
- **Horizontal scale** to tens of millions+ of docs with high query volume, or
  near-real-time analytics/aggregations over text.
- **Relevance tuning** (BM25, field boosting, learning-to-rank) as a product surface.

The trade you're making: Postgres gives you *good* search with *zero* extra
infrastructure and perfect consistency with your data. A search engine gives you
*great* search at the cost of a second datastore you must feed, sync, and operate.

**Take-away:** "Add a search index" doesn't have to mean "add Elasticsearch." For a
grocery catalog of this size, a `tsvector` + GIN index is the right tool — and that's
what we prove in Block 2.
