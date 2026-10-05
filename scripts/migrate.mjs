// Applies pending database migrations from ./drizzle. Safe to run on every deploy.
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

try {
	process.loadEnvFile?.();
} catch {
	// No .env file: rely on the real environment.
}

const url = process.env.DATABASE_URL;
if (!url) {
	console.error("DATABASE_URL is not set");
	process.exit(1);
}

const migrationsFolder = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL("../drizzle", import.meta.url));
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
	await migrate(drizzle(sql), { migrationsFolder });
	console.log("✔ Database is up to date");
} finally {
	await sql.end();
}
