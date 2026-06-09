// Tiny Express API + static UI in front of our search functions.
// Start with `npm run dev`, then open http://localhost:3000
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { searchProducts, suggest, categories } from "./search.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.static(join(__dirname, "..", "public")));

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q ?? "");
    const category = req.query.category ? String(req.query.category) : undefined;
    const hits = await searchProducts({ q, category, limit: 24 });
    res.json({ count: hits.length, hits });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/suggest", async (req, res) => {
  try {
    res.json(await suggest(String(req.query.q ?? "")));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/categories", async (_req, res) => {
  try {
    res.json(await categories());
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`🛒  Knuspr search running at http://localhost:${PORT}`);
});
