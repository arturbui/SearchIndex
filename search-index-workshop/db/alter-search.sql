-- Rebuild search_doc using the custom 'my_english' text search configuration.
-- Run AFTER creating synonyms_dict and the my_english configuration in psql.
ALTER TABLE products DROP COLUMN search_doc;
ALTER TABLE products ADD COLUMN search_doc tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('my_english', immutable_unaccent(coalesce(name, ''))),        'A') ||
  setweight(to_tsvector('my_english', immutable_unaccent(coalesce(brand, ''))),       'B') ||
  setweight(to_tsvector('my_english', immutable_unaccent(coalesce(category, '')    || ' ' ||
                                                          coalesce(subcategory, ''))), 'C') ||
  setweight(to_tsvector('my_english', immutable_unaccent(coalesce(description, ''))), 'D')
) STORED;
CREATE INDEX products_search_idx ON products USING GIN (search_doc);
