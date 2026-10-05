import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
	__hootboxDb?: { db: DB; sql: postgres.Sql };
};

function connect() {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error("DATABASE_URL is not set. Copy .env.example to .env and point it at your Postgres database.");
	}
	const sql = postgres(url, {
		max: Number(process.env.DATABASE_POOL_MAX ?? 10),
		// Required for transaction-mode poolers (PgBouncer, Supabase, Neon, Hyperdrive).
		prepare: process.env.DATABASE_PREPARE !== "false",
		onnotice: () => {},
	});
	return { db: drizzle(sql, { schema }), sql };
}

/** Lazily-created, process-wide database handle. */
export function getDb(): DB {
	globalForDb.__hootboxDb ??= connect();
	return globalForDb.__hootboxDb.db;
}

export async function closeDb() {
	if (globalForDb.__hootboxDb) {
		await globalForDb.__hootboxDb.sql.end({ timeout: 5 });
		globalForDb.__hootboxDb = undefined;
	}
}
