# Build your own search engine — `src/search.ts`

This is the spec for the Block 3 coding exercise. No code here on purpose —
you're building each piece from scratch. Implement the functions below, in
order, inside `src/search.ts`. Test each one by searching in the UI at
<http://localhost:3000> as you go.

Already done for you, don't touch:

- `ensureLoaded()` / `loadAndBuild()` — loads all products from Postgres into
  `PRODUCTS` once, lazily, on the first request, then calls `buildIndex()`.
- `categories()` — lists distinct categories from `PRODUCTS`.

You have access to these module-level variables once `ensureLoaded()` has run:

- `PRODUCTS: Product[]` — every row from the catalog.
- `DOC_BY_ID: Map<number, Product>` — same data, keyed by id, for fast lookup.
- `INDEX: Map<string, Map<number, number>>` — fill this in yourself (Step 2);
  everything after Step 2 reads from it.

---

## 1. `tokenize(text: string): string[]`

Turn free text into a list of normalized search terms.

- Case-insensitive: `"Milk"` and `"milk"` must produce the same token.
- Strip accents/diacritics so accented and unaccented spellings match
  (`"Café"` and `"Cafe"` should tokenize the same way).
- Strip punctuation; keep letters and digits.
- Split on whitespace.
- Drop empty strings.

Example: `tokenize("Organic Wholemilk, 3.5%!")` → `["organic", "wholemilk", "3", "5"]`

> Hint: `String.prototype.normalize("NFD")` separates accented characters into
> a base letter + a combining mark; a regex can then strip the combining marks.

## 2. `buildIndex(products: Product[]): Map<string, Map<number, number>>`

Build the inverted index: token → (doc id → how many times that token
appears in that doc).

- For each product, build its searchable text from `name`, `brand`,
  `category`, `subcategory`, and `description` (skip any that are `null`).
- Tokenize that combined text with your `tokenize()`.
- For every token found, increment its count for that product's id.

The result is a `Map<string, Map<number, number>>` — that nested map *is*
your search index, doing the same job as Postgres's GIN index over
`tsvector`, just built by hand.

> 🔎 **Checkpoint:** log `INDEX.size` once after it's built — you should see a
> vocabulary in the thousands for a 20k-product catalog.

## 3. `editDistance(a: string, b: string): number`

The Levenshtein edit distance between two strings: the minimum number of
single-character insertions, deletions, or substitutions needed to turn `a`
into `b`.

- Classic dynamic-programming solution: build a `(a.length+1) x (b.length+1)`
  table where `dp[i][j]` is the edit distance between `a`'s first `i`
  characters and `b`'s first `j` characters.
- Base cases: turning an empty string into a string of length `n` costs `n`
  insertions (and vice versa).
- Recurrence: if `a[i-1] === b[j-1]`, `dp[i][j] = dp[i-1][j-1]` (no edit
  needed); otherwise `dp[i][j] = 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])`.

## 4. `closestToken(token: string): string | null`

When a query `token` isn't a key in `INDEX`, find the closest known token.

- Compare `token` against every key in `INDEX` using `editDistance`.
- Return the closest match if its distance is small enough (e.g. ≤ 2);
  otherwise return `null`.

## 5. `highlight(text: string, tokens: string[]): string`

Produce a short snippet of `text` with the first matching query token
wrapped in `<mark>...</mark>`.

- Case-insensitively search `text` for the earliest occurring token from
  `tokens`.
- If found, return roughly 40 characters of context before and after the
  match, with the match itself wrapped in `<mark>`.
- If nothing matches, just return the first ~120 characters of `text`,
  unmarked.

## 6. `searchProducts({ q, category, limit }): Promise<SearchHit[]>`

The core of the workshop: rank products by relevance to the query `q` using
**TF-IDF**.

For each query token `t` that matches a product `d`:

```
score(d) += tf(t, d) * idf(t)
idf(t)    = ln(N / df(t))
```

where `N` is the total number of products, `tf(t, d)` is how many times `t`
appears in `d` (from `INDEX`), and `df(t)` is how many products contain `t`
at all (the size of `t`'s postings map).

Steps:

1. Tokenize `q`. If there are no tokens, return `[]`.
2. For each query token: if it's not a key in `INDEX`, try `closestToken()`
   to substitute the nearest known token; if there's still no match, skip it.
3. Add `tf * idf` to a running per-product score for every product in that
   token's postings.
4. If `category` is given, drop products that don't match it.
5. Sort the remaining products by score descending (break ties however you
   like — `in_stock` then `name` is reasonable), then take the top `limit`.
6. Map each surviving product to a `SearchHit`, using `highlight()` on its
   `description` for the `snippet` field.

## 7. `suggest(prefix: string, limit): Promise<string[]>`

Return up to `limit` distinct product names that start with `prefix`
(case-insensitive), sorted alphabetically.

---

Once all seven are implemented, compare your file against
`solutions/search.ts`.
