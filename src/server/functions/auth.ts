import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { acceptInviteSchema, emailSchema, loginSchema, nameSchema, passwordSchema, setupSchema } from "#/lib/validation";
import { clientIp, currentUser, endSession, startSession } from "../http";
import { sha256 } from "../lib/crypto";
import { authenticate, changePassword, isSetupComplete, setupInstance, updateProfile } from "../services/auth";
import { enforceRateLimit } from "../services/rate-limit";
import { acceptInvite, getInviteByToken, getMembership } from "../services/workspaces";
import { authMiddleware } from "./middleware";
import { validate } from "./validate";

/** Who's here? Used by route guards. */
export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
	const auth = await currentUser();
	if (!auth) return { user: null, setupComplete: await isSetupComplete(), workspace: null, role: null };
	const membership = await getMembership(auth.user.id);
	return {
		user: auth.user,
		setupComplete: true,
		workspace: membership ? { id: membership.workspace.id, name: membership.workspace.name } : null,
		role: membership?.role ?? null,
	};
});

export const setupFn = createServerFn({ method: "POST" })
	.validator(validate(setupSchema))
	.handler(async ({ data }) => {
		const { user } = await setupInstance(data);
		await startSession(user.id);
		return { ok: true };
	});

export const loginFn = createServerFn({ method: "POST" })
	.validator(validate(loginSchema))
	.handler(async ({ data }) => {
		const ip = clientIp() ?? "unknown";
		await enforceRateLimit(`login:ip:${await sha256(ip)}`, 20, 900, "Too many login attempts. Please wait a few minutes.");
		await enforceRateLimit(`login:email:${await sha256(data.email)}`, 8, 900, "Too many login attempts. Please wait a few minutes.");
		const user = await authenticate(data.email, data.password);
		await startSession(user.id);
		return { ok: true };
	});

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
	await endSession();
	return { ok: true };
});

export const getInviteFn = createServerFn({ method: "GET" })
	.validator(validate(z.object({ token: z.string().max(200) })))
	.handler(async ({ data }) => {
		const found = await getInviteByToken(data.token);
		return found ? { workspaceName: found.workspaceName, role: found.invite.role } : null;
	});

export const acceptInviteFn = createServerFn({ method: "POST" })
	.validator(validate(acceptInviteSchema))
	.handler(async ({ data }) => {
		await enforceRateLimit(`invite:${await sha256(clientIp() ?? "unknown")}`, 10, 900);
		const user = await acceptInvite(data);
		await startSession(user.id);
		return { ok: true };
	});

export const updateProfileFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ name: nameSchema, email: emailSchema })))
	.handler(async ({ data, context }) => updateProfile(context.auth.user.id, data));

export const changePasswordFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ currentPassword: z.string().max(200), newPassword: passwordSchema })))
	.handler(async ({ data, context }) => {
		await enforceRateLimit(`pw:${context.auth.user.id}`, 10, 900);
		await changePassword(context.auth.user.id, data.currentPassword, data.newPassword, context.auth.sessionToken);
		return { ok: true };
	});
