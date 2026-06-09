// Loads data/products.json into Postgres.
//  1. applies db/schema.sql (idempotent: extensions, function, table, indexes)
//  2. TRUNCATEs products
//  3. bulk-inserts in batches
//
// Run `npm run generate` first. Then `npm run seed`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "../src/db.ts";
import type { Product } from "./generate-data.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

async function main() {
  const schema = readFileSync(join(root, "db", "schema.sql"), "utf8");
  const dataPath = join(root, "data", "products.json");

  let products: Product[];
  try {
    products = JSON.parse(readFileSync(dataPath, "utf8"));
  } catch {
    console.error(`Could not read ${dataPath}. Run \`npm run generate\` first.`);
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    console.log("Applying schema...");
    await client.query(schema);

    console.log("Truncating products...");
    await client.query("TRUNCATE products RESTART IDENTITY");

    const cols = ["sku", "name", "brand", "category", "subcategory", "description", "price_cents", "unit", "in_stock", "tags"];
    const BATCH = 1000;
    const t0 = Date.now();

    for (let i = 0; i < products.length; i += BATCH) {
      const slice = products.slice(i, i + BATCH);
      const values: unknown[] = [];
      const rows = slice.map((p, r) => {
        const base = r * cols.length;
        values.push(p.sku, p.name, p.brand, p.category, p.subcategory, p.description, p.price_cents, p.unit, p.in_stock, p.tags);
        const ph = cols.map((_, c) => `$${base + c + 1}`);
        return `(${ph.join(",")})`;
      });
      await client.query(
        `INSERT INTO products (${cols.join(",")}) VALUES ${rows.join(",")}`,
        values,
      );
      if ((i / BATCH) % 10 === 0) process.stdout.write(`  inserted ${Math.min(i + BATCH, products.length)}/${products.length}\r`);
    }

    await client.query("ANALYZE products"); // refresh planner statistics
    const { rows: [{ count }] } = await client.query("SELECT count(*)::int AS count FROM products");
    console.log(`\nDone. ${count} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
