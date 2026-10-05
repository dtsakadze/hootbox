import { deleteCookie, getCookie, getRequestHeader, getRequestIP, getRequestUrl, setCookie } from "@tanstack/react-start/server";
import { randomToken, sha256 } from "./lib/crypto";
import { AppError } from "./lib/errors";
import { createSession, deleteSession, validateSession } from "./services/auth";
import { getMembership } from "./services/workspaces";

export const SESSION_COOKIE = "hb_session";
const VOTER_COOKIE = "hb_voter";

/** Base URL of this instance: APP_URL if configured, otherwise the request origin. */
export function appUrl() {
	return (process.env.APP_URL || getRequestUrl({ xForwardedHost: true, xForwardedProto: true }).origin).replace(/\/$/, "");
}

function isHttps() {
	return getRequestUrl({ xForwardedProto: true }).protocol === "https:";
}

export function clientIp() {
	return getRequestIP({ xForwardedFor: process.env.TRUST_PROXY !== "false" }) ?? null;
}

/**
 * Metadata for public (unauthenticated) submissions. Notification links use only
 * the configured APP_URL: the Host header of an anonymous request is attacker
 * controlled and must never end up in messages sent to the team.
 */
export function requestMeta() {
	return {
		ip: clientIp(),
		userAgent: getRequestHeader("user-agent") ?? null,
		appUrl: process.env.APP_URL?.replace(/\/$/, "") || undefined,
	};
}

export async function startSession(userId: string) {
	const { token, expiresAt } = await createSession(userId);
	setSessionCookie(token, expiresAt);
}

function setSessionCookie(token: string, expires: Date) {
	setCookie(SESSION_COOKIE, token, { httpOnly: true, secure: isHttps(), sameSite: "lax", path: "/", expires });
}

export async function endSession() {
	const token = getCookie(SESSION_COOKIE);
	if (token) await deleteSession(token);
	deleteCookie(SESSION_COOKIE, { path: "/" });
}

/** The signed-in user, or null. Refreshes the cookie when the session slides. */
export async function currentUser() {
	const token = getCookie(SESSION_COOKIE);
	if (!token) return null;
	const session = await validateSession(token);
	if (!session) return null;
	if (session.renewed) setSessionCookie(token, session.expiresAt);
	return { user: session.user, token };
}

/** Requires a signed-in workspace member. */
export async function requireAuth() {
	const auth = await currentUser();
	if (!auth) throw new AppError("UNAUTHORIZED", "Please log in again.");
	const membership = await getMembership(auth.user.id);
	if (!membership) throw new AppError("FORBIDDEN", "You're not a member of any workspace.");
	return {
		user: auth.user,
		sessionToken: auth.token,
		workspace: membership.workspace,
		role: membership.role,
		actor: { userId: auth.user.id, role: membership.role },
	};
}
export type AuthContext = Awaited<ReturnType<typeof requireAuth>>;

/** Anonymous, stable voter id for public-board upvotes (stored as a hash). */
export async function voterId(create: boolean): Promise<string | null> {
	let token = getCookie(VOTER_COOKIE);
	if (!token || token.length > 64) {
		if (!create) return null;
		token = randomToken(18);
		setCookie(VOTER_COOKIE, token, {
			httpOnly: true,
			secure: isHttps(),
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 365,
		});
	}
	return sha256(`voter:${token}`);
}
