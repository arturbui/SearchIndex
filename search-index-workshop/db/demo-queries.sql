-- ============================================================================
--  DEMO QUERIES  (run these live in pgAdmin during the 30-min demo)
--  Each block is standalone -- select it and hit Run (F5).
-- ============================================================================

-- 0) How big is the catalog, and what does the search index look like?
SELECT count(*) AS products FROM products;

SELECT name, search_doc
FROM products
WHERE name ILIKE 'Bio%'
LIMIT 3;
-- Note the tsvector: lexemes with positions and weights, e.g. 'milch':2A


-- ----------------------------------------------------------------------------
-- 1) RELEVANCE RANKING  -- a relational LIKE simply cannot do this.
--    ts_rank_cd scores each row; weighted A>B>C>D means a hit in the NAME
--    outranks a hit buried in the description.
-- ----------------------------------------------------------------------------
SELECT name, brand, category,
       round(ts_rank_cd(search_doc, q)::numeric, 4) AS rank
FROM products, websearch_to_tsquery('german', immutable_unaccent('bio milch')) q
WHERE search_doc @@ q
ORDER BY rank DESC
LIMIT 10;


-- ----------------------------------------------------------------------------
-- 2) HIGHLIGHTING  -- return the matched snippet, like Google's bold terms.
-- ----------------------------------------------------------------------------
SELECT name,
       ts_headline('german', description,
                   websearch_to_tsquery('german', immutable_unaccent('schokolade')),
                   'StartSel=<b>, StopSel=</b>, MaxFragments=1, MinWords=5, MaxWords=12') AS snippet
FROM products
WHERE search_doc @@ websearch_to_tsquery('german', immutable_unaccent('schokolade'))
LIMIT 5;


-- ----------------------------------------------------------------------------
-- 3) STEMMING & STOP WORDS  -- "Bohnen" matches "Bohne", "Kaffees" matches "Kaffee".
--    The 'german' dictionary reduces words to their stem before indexing.
-- ----------------------------------------------------------------------------
SELECT to_tsvector('german', 'Frische Kaffeebohnen und aromatische Bohnen') AS stemmed;
-- vs the 'simple' config which does NO stemming:
SELECT to_tsvector('simple', 'Frische Kaffeebohnen und aromatische Bohnen') AS not_stemmed;


-- ----------------------------------------------------------------------------
-- 4) TYPO TOLERANCE  -- trigram similarity finds "Schokolade" from "Schoklade".
--    Powered by the products_name_trgm_idx GIN index.
-- ----------------------------------------------------------------------------
SELECT name, round(similarity(name, 'Schoklade')::numeric, 3) AS sim
FROM products
WHERE name % 'Schoklade'           -- % = "similar enough" (pg_trgm threshold)
ORDER BY sim DESC
LIMIT 10;


-- ----------------------------------------------------------------------------
-- 5) PREFIX / AUTOCOMPLETE  -- "haf:*" matches Hafermilch, Haferdrink, ...
-- ----------------------------------------------------------------------------
SELECT DISTINCT name
FROM products
WHERE search_doc @@ to_tsquery('german', 'haf:*')
LIMIT 10;


-- ----------------------------------------------------------------------------
-- 6) FACETED COUNTS  -- search + group, the way a shop sidebar shows
--    "Obst & Gemüse (12), Getränke (5)".
-- ----------------------------------------------------------------------------
SELECT category, count(*) AS hits
FROM products
WHERE search_doc @@ websearch_to_tsquery('german', immutable_unaccent('bio'))
GROUP BY category
ORDER BY hits DESC;


-- ----------------------------------------------------------------------------
-- 7) THE BENCHMARK, live.  Compare the query PLANS.
-- ----------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM products
WHERE name ILIKE '%bio milch%' OR description ILIKE '%bio milch%';   -- Seq Scan

EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM products
WHERE search_doc @@ websearch_to_tsquery('german', immutable_unaccent('bio milch')); -- GIN
