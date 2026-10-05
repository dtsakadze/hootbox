export type ErrorCode = "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED";

const STATUS: Record<ErrorCode, number> = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	RATE_LIMITED: 429,
};

/** An error whose message is safe to show to end users. */
export class AppError extends Error {
	readonly status: number;
	constructor(
		readonly code: ErrorCode,
		message: string,
	) {
		super(message);
		this.name = "AppError";
		this.status = STATUS[code];
	}
}

export const notFound = (what = "Not found") => new AppError("NOT_FOUND", what);
export const forbidden = (msg = "You don't have access to this") => new AppError("FORBIDDEN", msg);

/** True for Postgres unique-constraint violations (also when wrapped by Drizzle). */
export function isUniqueViolation(err: unknown): boolean {
	for (let e = err as { code?: string; cause?: unknown } | undefined, i = 0; e && i < 3; e = e.cause as typeof e, i++) {
		if (e.code === "23505") return true;
	}
	return false;
}

/** Runs `fn`, turning a unique violation into a friendly CONFLICT error. */
export async function withConflictMessage<T>(fn: () => Promise<T>, message: string): Promise<T> {
	try {
		return await fn();
	} catch (err) {
		if (isUniqueViolation(err)) throw new AppError("CONFLICT", message);
		throw err;
	}
}
