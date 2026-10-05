import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export default async function setup() {
	const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/hootbox_test";
	if (!/test/i.test(new URL(url).pathname)) {
		throw new Error(`Refusing to run tests against "${url}" — the database name must contain "test".`);
	}
	const sql = postgres(url, { max: 1, onnotice: () => {} });
	await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
	await sql.end();
}
