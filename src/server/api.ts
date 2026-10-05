import { AppError } from "./lib/errors";

export const MAX_BODY_BYTES = 32 * 1024;

export const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "POST, OPTIONS",
	"access-control-allow-headers": "content-type, x-hootbox-key",
	"access-control-max-age": "86400",
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
	});
}

export function errorResponse(err: unknown, headers: Record<string, string> = {}) {
	if (err instanceof AppError) return json({ error: err.message, code: err.code }, err.status, headers);
	console.error("[hootbox] api error:", err);
	return json({ error: "Something went wrong", code: "INTERNAL" }, 500, headers);
}

/** Reads a JSON body (sent as application/json or text/plain) with a size cap. */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
	const length = Number(request.headers.get("content-length") ?? 0);
	if (length > MAX_BODY_BYTES) throw new AppError("BAD_REQUEST", "Request body is too large");
	const text = await request.text();
	if (text.length > MAX_BODY_BYTES) throw new AppError("BAD_REQUEST", "Request body is too large");
	try {
		const data = JSON.parse(text);
		if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
		return data;
	} catch {
		throw new AppError("BAD_REQUEST", "Body must be a JSON object");
	}
}
