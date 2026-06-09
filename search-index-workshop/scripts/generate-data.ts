// Generates a realistic grocery catalog as data/products.json.
// Usage: npm run generate            (uses PRODUCT_COUNT from .env, default 20000)
//        npm run generate -- 200000  (override count, e.g. for the benchmark)
//
// We combine a hand-curated catalog (scripts/catalog.ts) with faker-driven
// variation (brand, size, "Bio", price jitter) so the data feels real and has
// enough variety for meaningful search results.

import { faker } from "@faker-js/faker/locale/de";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CATALOG, NAME_PREFIXES, BIO_BRANDS } from "./catalog.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "products.json");

faker.seed(42); // reproducible data across runs / across the three of us

const count = Number(process.argv[2] ?? process.env.PRODUCT_COUNT ?? 20000);

export interface Product {
  sku: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string;
  description: string;
  price_cents: number;
  unit: string;
  in_stock: boolean;
  tags: string[];
}

function buildOne(seq: number): Product {
  const cat = faker.helpers.arrayElement(CATALOG);
  const arch = faker.helpers.arrayElement(cat.archetypes);

  const prefix = faker.helpers.arrayElement(NAME_PREFIXES);
  const isBio = prefix === "Bio" || arch.tags.includes("bio");
  const brand = isBio && faker.datatype.boolean(0.4)
    ? faker.helpers.arrayElement(BIO_BRANDS)
    : faker.helpers.arrayElement(cat.brands);

  const unit = faker.helpers.arrayElement(arch.units);
  const name = [prefix, arch.base].filter(Boolean).join(" ").trim();

  const [lo, hi] = arch.priceRange;
  const price = faker.number.float({ min: lo, max: hi, fractionDigits: 2 });

  const claims = faker.helpers.arrayElements(arch.descParts, { min: 1, max: arch.descParts.length });
  const description =
    `${name} von ${brand}, ${unit}. ` +
    `${claims.join(", ")}. ` +
    `${isBio ? "In Bio-Qualität. " : ""}` +
    `Schnell geliefert mit Knuspr.`;

  const tags = Array.from(new Set([...arch.tags, ...(isBio ? ["bio"] : [])]));

  return {
    sku: `KN-${String(seq).padStart(7, "0")}`,
    name,
    brand,
    category: cat.category,
    subcategory: cat.subcategory,
    description,
    price_cents: Math.round(price * 100),
    unit,
    in_stock: faker.datatype.boolean(0.92),
    tags,
  };
}

console.log(`Generating ${count.toLocaleString("de-DE")} products...`);
const products: Product[] = [];
for (let i = 1; i <= count; i++) products.push(buildOne(i));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(products, null, count <= 2000 ? 2 : 0));

console.log(`Wrote ${products.length.toLocaleString("de-DE")} products -> ${OUT}`);
console.log("Sample:", JSON.stringify(products.slice(0, 2), null, 2));
