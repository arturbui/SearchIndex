# Workshop — Student Guide

Build a small search engine from scratch over a grocery catalog: tokenizer,
inverted index, TF-IDF ranking, edit-distance typo tolerance, autocomplete.
All in `src/search.ts`, following the spec in
[`docs/04-search-engine.md`](04-search-engine.md). If you get stuck, check the
**Debugging** table below or peek at `solutions/search.ts`.

---

## Setup

```bash
git clone <repo-url> search-index-workshop
cd search-index-workshop
cp .env.example .env
npm install
docker compose up -d
docker compose ps
```

`db` should show as `running`/`healthy`.

```bash
npm run generate -- 20000
npm run seed
npm run dev
```

Open <http://localhost:3000>. Search "milk" — no results yet, that's expected.

## Build the engine

Open `src/search.ts` next to [`docs/04-search-engine.md`](04-search-engine.md).
Already done for you: `ensureLoaded()` and `categories()`. Everything else is
a `// TODO` — implement them in order:

1. `tokenize`
2. `buildIndex`
3. `editDistance`
4. `closestToken`
5. `highlight`
6. `searchProducts`
7. `suggest`

Test each one by searching in the browser as you go. Try "organic milk" once
ranking works, and "Choclate" once typo tolerance works.

When done, compare your file against `solutions/search.ts`.

## If you have time left

- Boost matches in `name` over matches in `description` (field weighting)
- Require all query tokens to match (AND) instead of any (OR)
- Replace the linear scan in `closestToken` with something faster
- Try autocomplete with a trie instead of scanning all names
- Run at scale: `npm run generate -- 200000 && npm run seed`, restart, and
  check `/api/search` timing in the browser's network tab

---

## Debugging cheat-sheet

| Symptom | Fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:5432` | `docker compose ps`; `docker compose up -d` |
| Search always returns 0 results | Check `tokenize()` isn't still returning `[]`; confirm `searchProducts`'s stub `return []` was replaced |
| Results never change as you type | Make sure `npm run dev` is running and you're editing `src/search.ts`, not `solutions/search.ts` |
| `Cannot read properties of undefined (reading 'get')` | Every function should `await ensureLoaded()` first — already in the stub |
| "Choclate" still returns 0 results | Confirm `closestToken` is being called in `searchProducts` |
| Snippet shows description start but no `<mark>` | `searchProducts` still using a plain slice instead of `highlight(...)` |
| `editDistance` gives wrong answers | Re-check the DP base cases (`dp[i][0] = i`, `dp[0][j] = j`) |
| First search after startup is slow, then fast | Expected — the index builds once, lazily, on the first request |
