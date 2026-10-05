import "dotenv/config";
import { defineConfig } from "vitest/config";

const testDb = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/hootbox_test";

export default defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		include: ["tests/**/*.test.ts"],
		globalSetup: ["tests/global-setup.ts"],
		setupFiles: ["tests/setup.ts"],
		// Tests share one real database, so run files one at a time.
		fileParallelism: false,
		env: {
			DATABASE_URL: testDb,
			DATABASE_POOL_MAX: "5",
			PASSWORD_ITERATIONS: "1000",
		},
	},
});
