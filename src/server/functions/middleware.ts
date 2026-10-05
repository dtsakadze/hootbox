import { createMiddleware } from "@tanstack/react-start";
import { requireAuth } from "../http";

/** Adds the signed-in user, workspace and role to the server function context. */
export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
	return next({ context: { auth: await requireAuth() } });
});
