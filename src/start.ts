import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { AppError } from "./server/lib/errors";

/** Server functions are same-origin only. Public endpoints live under /api and set their own CORS. */
const csrf = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

const securityHeaders = createMiddleware().server(async ({ next, pathname }) => {
	const result = await next();
	const set = (h: Headers) => {
		h.set("x-content-type-options", "nosniff");
		h.set("referrer-policy", "strict-origin-when-cross-origin");
		h.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
		// The hosted feedback form may be embedded in an iframe; nothing else may.
		if (!pathname.startsWith("/f/") && !pathname.startsWith("/api/")) {
			h.set("x-frame-options", "DENY");
			h.set("content-security-policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'");
		}
	};
	try {
		set(result.response.headers);
	} catch {
		// Immutable headers (e.g. a proxied Response): copy into a fresh one.
		const response = new Response(result.response.body, result.response);
		set(response.headers);
		return { ...result, response };
	}
	return result;
});

/** Never leak internal error details to the browser. AppErrors are user-safe. */
const errorMasking = createMiddleware({ type: "function" }).server(async ({ next }) => {
	try {
		return await next();
	} catch (err) {
		if (err instanceof AppError || isRedirect(err) || isNotFound(err)) throw err;
		if (err instanceof Error && err.name === "ZodError") throw new Error("Some of the fields look invalid. Please check and try again.");
		console.error("[hootbox] unexpected error:", err);
		throw new Error("Something went wrong on our side. Please try again.");
	}
});

export const startInstance = createStart(() => ({
	requestMiddleware: [securityHeaders, csrf],
	functionMiddleware: [errorMasking],
}));
