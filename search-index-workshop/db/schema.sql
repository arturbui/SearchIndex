-- Self-contained schema for the grocery search index.
-- Safe to run manually in pgAdmin OR via `npm run seed` (everything is idempotent).
-- The extension/function lines repeat db/init so this file also works if you
-- ever run it against a database where the init script didn't fire.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT unaccent('unaccent', $1) $$;

CREATE TABLE IF NOT EXISTS products (
  id          BIGSERIAL PRIMARY KEY,
  sku         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  brand       TEXT,
  category    TEXT NOT NULL,
  subcategory TEXT,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  unit        TEXT,                       -- e.g. "500 g", "1 L", "6 x 0.33 L"
  in_stock    BOOLEAN NOT NULL DEFAULT TRUE,
  tags        TEXT[] NOT NULL DEFAULT '{}',

  -- THE SEARCH INDEX COLUMN.
  -- A generated tsvector keeps the searchable document in sync automatically on
  -- every INSERT/UPDATE -- no triggers to maintain. We weight fields A..D so a hit
  -- in the product name ranks higher than a hit deep in the description.
  search_doc tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('english', immutable_unaccent(coalesce(name, ''))),        'A') ||
      setweight(to_tsvector('english', immutable_unaccent(coalesce(brand, ''))),       'B') ||
      setweight(to_tsvector('english', immutable_unaccent(coalesce(category, '')    || ' ' ||
                                                          coalesce(subcategory, ''))), 'C') ||
      setweight(to_tsvector('english', immutable_unaccent(coalesce(description, ''))), 'D')
  ) STORED
);

-- The actual index. GIN is the right structure for tsvector: it maps each lexeme
-- to the rows that contain it (an inverted index), so `@@` lookups stay fast as the
-- table grows instead of scanning every row.
CREATE INDEX IF NOT EXISTS products_search_idx
  ON products USING GIN (search_doc);

-- Trigram index on name -> powers typo-tolerant search (similarity / %).
CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON products USING GIN (name gin_trgm_ops);

-- Trigram index on the unaccented name -> powers the autocomplete ILIKE query in
-- suggest(), which filters on immutable_unaccent(name). A plain index on name
-- wouldn't match that expression, so this has to be a separate expression index.
CREATE INDEX IF NOT EXISTS products_name_unaccent_trgm_idx
  ON products USING GIN (immutable_unaccent(name) gin_trgm_ops);

-- A plain b-tree for the category filter used alongside search.
CREATE INDEX IF NOT EXISTS products_category_idx
  ON products (category);
