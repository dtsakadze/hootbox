import { sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { rateLimits } from "../db/schema";
import { AppError } from "../lib/errors";

/**
 * Fixed-window rate limiter backed by Postgres so it holds across serverless
 * instances. Returns true when the call is allowed.
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
	const db = getDb();
	const [row] = await db
		.insert(rateLimits)
		.values({
			key,
			count: 1,
			resetAt: sql`now() + make_interval(secs => ${windowSeconds})`,
		})
		.onConflictDoUpdate({
			target: rateLimits.key,
			set: {
				count: sql`case when ${rateLimits.resetAt} <= now() then 1 else ${rateLimits.count} + 1 end`,
				resetAt: sql`case when ${rateLimits.resetAt} <= now() then now() + make_interval(secs => ${windowSeconds}) else ${rateLimits.resetAt} end`,
			},
		})
		.returning({ count: rateLimits.count });

	// Opportunistic cleanup of stale windows (~1% of calls).
	if (Math.random() < 0.01) {
		await db.delete(rateLimits).where(sql`${rateLimits.resetAt} < now() - interval '1 hour'`);
	}
	return row.count <= limit;
}

export async function enforceRateLimit(
	key: string,
	limit: number,
	windowSeconds: number,
	message = "Whoa, slow down! Please try again in a little while.",
) {
	if (!(await hitRateLimit(key, limit, windowSeconds))) {
		throw new AppError("RATE_LIMITED", message);
	}
}
