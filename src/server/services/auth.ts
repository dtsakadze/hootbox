import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { z } from "zod";
import type { setupSchema } from "#/lib/validation";
import { getDb } from "../db/client";
import { sessions, type User, users, workspaceMembers, workspaces } from "../db/schema";
import { extensions } from "../extensions";
import { newId, randomToken, sha256 } from "../lib/crypto";
import { AppError, withConflictMessage } from "../lib/errors";
import { hashPassword, verifyPassword } from "../lib/password";

export const SESSION_TTL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PublicUser = Pick<User, "id" | "email" | "name">;

const toPublicUser = (u: User): PublicUser => ({ id: u.id, email: u.email, name: u.name });

export async function isSetupComplete(): Promise<boolean> {
	const [row] = await getDb().select({ id: users.id }).from(users).limit(1);
	return Boolean(row);
}

/**
 * First-run setup: creates the owner account and the workspace. Only works while
 * the instance has no users; an advisory lock prevents two racing setups.
 */
export async function setupInstance(input: z.output<typeof setupSchema>) {
	const passwordHash = await hashPassword(input.password);
	return getDb().transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext('hootbox:setup'))`);
		const [existing] = await tx.select({ id: users.id }).from(users).limit(1);
		if (existing) throw new AppError("FORBIDDEN", "This Hootbox is already set up. Please log in.");

		const [user] = await tx.insert(users).values({ id: newId(), email: input.email, name: input.name, passwordHash }).returning();
		const [workspace] = await tx.insert(workspaces).values({ id: newId(), name: input.workspaceName }).returning();
		await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: user.id, role: "owner" });
		return { user: toPublicUser(user), workspace };
	});
}

/**
 * Self-serve sign-up: a new user with their own workspace. Disabled in the OSS
 * edition (invite-only); an extension can enable it via `allowOpenSignup`.
 */
export async function signUp(input: z.output<typeof setupSchema>) {
	if (!extensions().allowOpenSignup) throw new AppError("FORBIDDEN", "Sign-ups are invite-only on this Hootbox.");
	const passwordHash = await hashPassword(input.password);
	const conflict = "An account with that email already exists. Log in instead.";
	return withConflictMessage(
		() =>
			getDb().transaction(async (tx) => {
				const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
				if (existing) throw new AppError("CONFLICT", conflict);
				const [user] = await tx.insert(users).values({ id: newId(), email: input.email, name: input.name, passwordHash }).returning();
				const [workspace] = await tx.insert(workspaces).values({ id: newId(), name: input.workspaceName }).returning();
				await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: user.id, role: "owner" });
				return { user: toPublicUser(user), workspace };
			}),
		conflict,
	);
}

// Used to keep login timing similar whether or not the email exists.
let dummyHash: Promise<string> | undefined;

export async function authenticate(email: string, password: string): Promise<PublicUser> {
	const [user] = await getDb().select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
	if (!user) {
		dummyHash ??= hashPassword("not-a-real-password");
		await verifyPassword(password, await dummyHash);
		throw new AppError("UNAUTHORIZED", "That email and password don't match.");
	}
	if (!(await verifyPassword(password, user.passwordHash))) {
		throw new AppError("UNAUTHORIZED", "That email and password don't match.");
	}
	return toPublicUser(user);
}

export async function createSession(userId: string) {
	const token = randomToken(32);
	const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY_MS);
	await getDb()
		.insert(sessions)
		.values({ id: await sha256(token), userId, expiresAt });
	// Opportunistic housekeeping; no cron needed.
	if (Math.random() < 0.05) await purgeExpiredSessions();
	return { token, expiresAt };
}

/**
 * Resolves a session token to its user. Sessions slide: when less than half the
 * TTL is left, the expiry is pushed out (the caller should refresh the cookie).
 */
export async function validateSession(token: string) {
	if (!token || token.length > 100) return null;
	const db = getDb();
	const id = await sha256(token);
	const [row] = await db
		.select({ user: users, expiresAt: sessions.expiresAt })
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
		.limit(1);
	if (!row) return null;

	let expiresAt = row.expiresAt;
	let renewed = false;
	if (expiresAt.getTime() - Date.now() < (SESSION_TTL_DAYS / 2) * DAY_MS) {
		expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY_MS);
		await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
		renewed = true;
	}
	return { user: toPublicUser(row.user), expiresAt, renewed };
}

export async function deleteSession(token: string) {
	await getDb()
		.delete(sessions)
		.where(eq(sessions.id, await sha256(token)));
}

export async function purgeExpiredSessions() {
	await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export async function updateProfile(userId: string, input: { name: string; email: string }) {
	const db = getDb();
	const [clash] = await db
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.email, input.email), sql`${users.id} <> ${userId}`))
		.limit(1);
	if (clash) throw new AppError("CONFLICT", "That email is already used by another account.");
	const [user] = await withConflictMessage(
		() => db.update(users).set(input).where(eq(users.id, userId)).returning(),
		"That email is already used by another account.",
	);
	return toPublicUser(user);
}

/** Changes the password and signs out every other session. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string, keepSessionToken?: string) {
	const db = getDb();
	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
		throw new AppError("BAD_REQUEST", "Your current password is incorrect.");
	}
	await db
		.update(users)
		.set({ passwordHash: await hashPassword(newPassword) })
		.where(eq(users.id, userId));
	const keepId = keepSessionToken ? await sha256(keepSessionToken) : "";
	await db.delete(sessions).where(and(eq(sessions.userId, userId), sql`${sessions.id} <> ${keepId}`));
}
