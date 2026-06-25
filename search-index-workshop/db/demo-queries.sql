-- ============================================================================
--  DEMO QUERIES  (run these live in pgAdmin during the 30-min demo)
--  Each block is standalone -- select it and hit Run (F5).
-- ============================================================================

-- 0) How big is the catalog, and what does the search index look like?
SELECT count(*) AS products FROM products;

SELECT name, search_doc
FROM products
WHERE name ILIKE 'Organic%'
LIMIT 3;
-- Note the tsvector: lexemes with positions and weights, e.g. 'milk':2A


-- ----------------------------------------------------------------------------
-- 1) RELEVANCE RANKING  -- a relational LIKE simply cannot do this.
--    ts_rank_cd scores each row; weighted A>B>C>D means a hit in the NAME
--    outranks a hit buried in the description.
-- ----------------------------------------------------------------------------
SELECT name, brand, category,
       round(ts_rank_cd(search_doc, q)::numeric, 4) AS rank
FROM products, websearch_to_tsquery('english', immutable_unaccent('organic milk')) q
WHERE search_doc @@ q
ORDER BY rank DESC
LIMIT 10;


-- ----------------------------------------------------------------------------
-- 2) HIGHLIGHTING  -- return the matched snippet, like Google's bold terms.
-- ----------------------------------------------------------------------------
SELECT name,
       ts_headline('english', description,
                   websearch_to_tsquery('english', immutable_unaccent('chocolate')),
                   'StartSel=<b>, StopSel=</b>, MaxFragments=1, MinWords=5, MaxWords=12') AS snippet
FROM products
WHERE search_doc @@ websearch_to_tsquery('english', immutable_unaccent('chocolate'))
LIMIT 5;


-- ----------------------------------------------------------------------------
-- 3) STEMMING & STOP WORDS  -- "beans" matches "bean", "roasted" matches "roast".
--    The 'english' dictionary reduces words to their stem before indexing.
-- ----------------------------------------------------------------------------
SELECT to_tsvector('english', 'Fresh roasted coffee beans and aromatic beans') AS stemmed;
-- vs the 'simple' config which does NO stemming:
SELECT to_tsvector('simple', 'Fresh roasted coffee beans and aromatic beans') AS not_stemmed;


-- ----------------------------------------------------------------------------
-- 4) TYPO TOLERANCE  -- trigram similarity finds "Chocolate" from "Choclate".
--    Powered by the products_name_trgm_idx GIN index.
-- ----------------------------------------------------------------------------
SELECT name, round(similarity(name, 'Choclate')::numeric, 3) AS sim
FROM products
WHERE name % 'Choclate'           -- % = "similar enough" (pg_trgm threshold)
ORDER BY sim DESC
LIMIT 10;


-- ----------------------------------------------------------------------------
-- 5) PREFIX / AUTOCOMPLETE  -- "oat:*" matches Oatmilk, Oatmeal, ...
-- ----------------------------------------------------------------------------
SELECT DISTINCT name
FROM products
WHERE search_doc @@ to_tsquery('english', 'oat:*')
LIMIT 10;


-- ----------------------------------------------------------------------------
-- 6) FACETED COUNTS  -- search + group, the way a shop sidebar shows
--    "Fruits & Vegetables (12), Beverages (5)".
-- ----------------------------------------------------------------------------
SELECT category, count(*) AS hits
FROM products
WHERE search_doc @@ websearch_to_tsquery('english', immutable_unaccent('organic'))
GROUP BY category
ORDER BY hits DESC;


-- ----------------------------------------------------------------------------
-- 7) THE BENCHMARK, live.  Compare the query PLANS.
-- ----------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM products
WHERE name ILIKE '%organic milk%' OR description ILIKE '%organic milk%';   -- Seq Scan

EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM products
WHERE search_doc @@ websearch_to_tsquery('english', immutable_unaccent('organic milk')); -- GIN
