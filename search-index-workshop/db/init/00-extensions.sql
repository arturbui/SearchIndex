-- Runs automatically the first time the empty Postgres container boots.
-- Sets up the building blocks our search index needs.

-- unaccent: fold "Müsli" -> "Musli", "Café" -> "Cafe" so accents/umlauts don't
--           break matches. Ships with the postgres:16 contrib package.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- pg_trgm: trigram similarity, powers typo-tolerant ("fuzzy") search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GOTCHA worth understanding:
-- unaccent() is only marked STABLE, not IMMUTABLE, so Postgres refuses to use it
-- directly inside a GENERATED column or a functional index. We wrap it in our own
-- IMMUTABLE function. The two-argument form unaccent('unaccent', $1) pins the
-- dictionary, which is what makes it safe to promise immutability.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
AS $$ SELECT unaccent('unaccent', $1) $$;
