import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "#/server/db/client";
import { rateLimits } from "#/server/db/schema";
import { enforceRateLimit, hitRateLimit } from "#/server/services/rate-limit";

describe("rate limiter", () => {
	it("allows up to the limit within a window", async () => {
		const results = [];
		for (let i = 0; i < 4; i++) results.push(await hitRateLimit("t:1", 3, 60));
		expect(results).toEqual([true, true, true, false]);
		expect(await hitRateLimit("t:2", 3, 60)).toBe(true);
	});

	it("resets after the window", async () => {
		for (let i = 0; i < 3; i++) await hitRateLimit("t:3", 2, 60);
		await getDb()
			.update(rateLimits)
			.set({ resetAt: new Date(Date.now() - 1000) })
			.where(eq(rateLimits.key, "t:3"));
		expect(await hitRateLimit("t:3", 2, 60)).toBe(true);
	});

	it("is accurate under concurrency", async () => {
		const results = await Promise.all(Array.from({ length: 20 }, () => hitRateLimit("t:4", 5, 60)));
		expect(results.filter(Boolean)).toHaveLength(5);
	});

	it("throws a friendly error", async () => {
		await enforceRateLimit("t:5", 1, 60);
		await expect(enforceRateLimit("t:5", 1, 60)).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
	});
});
