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
