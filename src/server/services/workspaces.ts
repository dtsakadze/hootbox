import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import type { MemberRole } from "#/lib/constants";
import { getDb } from "../db/client";
import { invites, users, type Workspace, workspaceMembers, workspaces } from "../db/schema";
import { extensions } from "../extensions";
import { newId, randomToken, sha256 } from "../lib/crypto";
import { AppError, forbidden, notFound } from "../lib/errors";
import { hashPassword } from "../lib/password";

const RANK: Record<MemberRole, number> = { member: 1, admin: 2, owner: 3 };
export const INVITE_TTL_DAYS = 7;

export function hasRole(role: MemberRole, atLeast: MemberRole) {
	return RANK[role] >= RANK[atLeast];
}

export function assertRole(role: MemberRole, atLeast: MemberRole) {
	if (!hasRole(role, atLeast)) {
		throw forbidden(atLeast === "owner" ? "Only the owner can do that." : "Only admins can do that.");
	}
}

export type Membership = { workspace: Workspace; role: MemberRole };

/**
 * The workspace the user works in. The OSS edition has one workspace per
 * instance; a hosted edition can let users pick (pass `workspaceId`).
 */
export async function getMembership(userId: string, workspaceId?: string): Promise<Membership | null> {
	const rows = await getDb()
		.select({ workspace: workspaces, role: workspaceMembers.role })
		.from(workspaceMembers)
		.innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
		.where(
			workspaceId
				? and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId))
				: eq(workspaceMembers.userId, userId),
		)
		.orderBy(asc(workspaceMembers.createdAt))
		.limit(1);
	return rows[0] ?? null;
}

export async function renameWorkspace(workspaceId: string, name: string) {
	const [ws] = await getDb().update(workspaces).set({ name }).where(eq(workspaces.id, workspaceId)).returning();
	return ws;
}

export async function listMembers(workspaceId: string) {
	return getDb()
		.select({
			userId: users.id,
			name: users.name,
			email: users.email,
			role: workspaceMembers.role,
			joinedAt: workspaceMembers.createdAt,
		})
		.from(workspaceMembers)
		.innerJoin(users, eq(users.id, workspaceMembers.userId))
		.where(eq(workspaceMembers.workspaceId, workspaceId))
		.orderBy(asc(workspaceMembers.createdAt));
}

async function getMemberRole(workspaceId: string, userId: string) {
	const [row] = await getDb()
		.select({ role: workspaceMembers.role })
		.from(workspaceMembers)
		.where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
	return row?.role ?? null;
}

/** Changes a member's role. Only owners can promote to/demote from owner. */
export async function updateMemberRole(
	actor: { userId: string; role: MemberRole },
	workspaceId: string,
	targetUserId: string,
	role: MemberRole,
) {
	assertRole(actor.role, "admin");
	const current = await getMemberRole(workspaceId, targetUserId);
	if (!current) throw notFound("Member not found");
	if ((current === "owner" || role === "owner") && actor.role !== "owner") {
		throw forbidden("Only the owner can change ownership.");
	}
	if (current === "owner" && role !== "owner") await assertAnotherOwner(workspaceId, targetUserId);
	await getDb()
		.update(workspaceMembers)
		.set({ role })
		.where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUserId)));
}

async function assertAnotherOwner(workspaceId: string, exceptUserId: string) {
	const [row] = await getDb()
		.select({ n: sql<number>`count(*)::int` })
		.from(workspaceMembers)
		.where(
			and(
				eq(workspaceMembers.workspaceId, workspaceId),
				eq(workspaceMembers.role, "owner"),
				sql`${workspaceMembers.userId} <> ${exceptUserId}`,
			),
		);
	if (!row || row.n === 0) {
		throw new AppError("BAD_REQUEST", "A workspace needs at least one owner. Promote someone else first.");
	}
}

/** Removes a member (or lets a member leave). The user account is deleted if it has no other workspace. */
export async function removeMember(
	actor: { userId: string; role: MemberRole },
	workspaceId: string,
	targetUserId: string,
) {
	const self = actor.userId === targetUserId;
	if (!self) assertRole(actor.role, "admin");
	const current = await getMemberRole(workspaceId, targetUserId);
	if (!current) throw notFound("Member not found");
	if (current === "owner") {
		if (!self && actor.role !== "owner") throw forbidden("Only an owner can remove another owner.");
		await assertAnotherOwner(workspaceId, targetUserId);
	}
	const db = getDb();
	await db.transaction(async (tx) => {
		await tx
			.delete(workspaceMembers)
			.where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUserId)));
		const [other] = await tx
			.select({ id: workspaceMembers.workspaceId })
			.from(workspaceMembers)
			.where(eq(workspaceMembers.userId, targetUserId))
			.limit(1);
		if (!other) await tx.delete(users).where(eq(users.id, targetUserId));
	});
}

export async function createInvite(
	actor: { userId: string; role: MemberRole },
	workspaceId: string,
	input: { role: MemberRole; note?: string | null },
) {
	assertRole(actor.role, "admin");
	if (input.role === "owner" && actor.role !== "owner") throw forbidden("Only the owner can invite owners.");
	const token = randomToken(24);
	const [invite] = await getDb()
		.insert(invites)
		.values({
			id: newId(),
			workspaceId,
			tokenHash: await sha256(token),
			role: input.role,
			note: input.note || null,
			createdBy: actor.userId,
			expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
		})
		.returning();
	return { invite, token };
}

export async function listPendingInvites(workspaceId: string) {
	return getDb()
		.select({
			id: invites.id,
			role: invites.role,
			note: invites.note,
			expiresAt: invites.expiresAt,
			createdAt: invites.createdAt,
		})
		.from(invites)
		.where(and(eq(invites.workspaceId, workspaceId), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())))
		.orderBy(asc(invites.createdAt));
}

export async function revokeInvite(actor: { role: MemberRole }, workspaceId: string, inviteId: string) {
	assertRole(actor.role, "admin");
	await getDb().delete(invites).where(and(eq(invites.id, inviteId), eq(invites.workspaceId, workspaceId)));
}

export async function getInviteByToken(token: string) {
	if (!token || token.length > 200) return null;
	const [row] = await getDb()
		.select({ invite: invites, workspaceName: workspaces.name })
		.from(invites)
		.innerJoin(workspaces, eq(workspaces.id, invites.workspaceId))
		.where(and(eq(invites.tokenHash, await sha256(token)), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())))
		.limit(1);
	return row ?? null;
}

/** Creates a new account from an invite and joins the workspace. Single-use. */
export async function acceptInvite(input: { token: string; name: string; email: string; password: string }) {
	const found = await getInviteByToken(input.token);
	if (!found) throw new AppError("NOT_FOUND", "This invite link is invalid or has expired.");
	await extensions().beforeMemberJoin?.({ workspaceId: found.invite.workspaceId });
	const passwordHash = await hashPassword(input.password);

	return getDb().transaction(async (tx) => {
		// Claim the invite atomically so it can't be used twice.
		const claimed = await tx
			.update(invites)
			.set({ acceptedAt: new Date() })
			.where(and(eq(invites.id, found.invite.id), isNull(invites.acceptedAt)))
			.returning({ id: invites.id });
		if (claimed.length === 0) throw new AppError("NOT_FOUND", "This invite link has already been used.");

		const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email));
		if (existing) {
			throw new AppError("CONFLICT", "An account with that email already exists. Log in instead.");
		}
		const [user] = await tx
			.insert(users)
			.values({ id: newId(), email: input.email, name: input.name, passwordHash })
			.returning({ id: users.id, email: users.email, name: users.name });
		await tx.insert(workspaceMembers).values({
			workspaceId: found.invite.workspaceId,
			userId: user.id,
			role: found.invite.role,
		});
		return user;
	});
}
