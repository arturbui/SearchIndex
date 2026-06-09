// Shared Postgres connection pool. Reads credentials from .env (see .env.example).
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER ?? "workshop",
  password: process.env.POSTGRES_PASSWORD ?? "workshop",
  database: process.env.POSTGRES_DB ?? "knuspr",
});

pool.on("error", (err) => {
  console.error("Unexpected idle client error", err);
});
