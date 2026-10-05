import { describe, expect, it } from "vitest";
import { registerExtensions } from "#/server/extensions";
import { AppError } from "#/server/lib/errors";
import {
	acceptInvite,
	createInvite,
	getInviteByToken,
	getMembership,
	listMembers,
	listPendingInvites,
	removeMember,
	revokeInvite,
	updateMemberRole,
} from "#/server/services/workspaces";
import { seedOwner } from "./helpers";

async function withMember(role: "member" | "admin" = "member") {
	const owner = await seedOwner();
	const { token } = await createInvite(owner.actor, owner.workspace.id, { role });
	const user = await acceptInvite({ token, name: "Mia", email: "mia@example.com", password: "password123" });
	return { ...owner, member: user, memberActor: { userId: user.id, role } };
}

describe("invites", () => {
	it("lets a new person join with the invited role, once", async () => {
		const owner = await seedOwner();
		const { token } = await createInvite(owner.actor, owner.workspace.id, { role: "admin", note: "for Mia" });
		expect(await listPendingInvites(owner.workspace.id)).toHaveLength(1);
		expect((await getInviteByToken(token))?.workspaceName).toBe("Acme");

		const mia = await acceptInvite({ token, name: "Mia", email: "mia@example.com", password: "password123" });
		expect((await getMembership(mia.id))?.role).toBe("admin");
		expect(await listPendingInvites(owner.workspace.id)).toHaveLength(0);
		await expect(acceptInvite({ token, name: "Mallory", email: "mal@example.com", password: "password123" })).rejects.toThrow(
			/invalid or has expired/,
		);
	});

	it("can't be used concurrently twice", async () => {
		const owner = await seedOwner();
		const { token } = await createInvite(owner.actor, owner.workspace.id, { role: "member" });
		const results = await Promise.allSettled(
			[1, 2, 3].map((i) => acceptInvite({ token, name: `N${i}`, email: `n${i}@example.com`, password: "password123" })),
		);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
	});

	it("rejects existing emails and keeps the invite usable", async () => {
		const owner = await seedOwner();
		const { token } = await createInvite(owner.actor, owner.workspace.id, { role: "member" });
		await expect(acceptInvite({ token, name: "X", email: "owner@example.com", password: "password123" })).rejects.toThrow(/already exists/);
		expect(await getInviteByToken(token)).not.toBeNull();
	});

	it("can be revoked, and members cannot invite", async () => {
		const { memberActor, workspace, actor } = await withMember();
		await expect(createInvite(memberActor, workspace.id, { role: "member" })).rejects.toBeInstanceOf(AppError);
		const { invite, token } = await createInvite(actor, workspace.id, { role: "member" });
		await revokeInvite(actor, workspace.id, invite.id);
		expect(await getInviteByToken(token)).toBeNull();
	});

	it("only owners can invite owners", async () => {
		const { memberActor, workspace } = await withMember("admin");
		await expect(createInvite(memberActor, workspace.id, { role: "owner" })).rejects.toThrow(/owner/);
	});

	it("respects the beforeMemberJoin extension", async () => {
		const owner = await seedOwner();
		const { token } = await createInvite(owner.actor, owner.workspace.id, { role: "member" });
		registerExtensions({
			beforeMemberJoin: async () => {
				throw new AppError("FORBIDDEN", "Seat limit reached");
			},
		});
		await expect(acceptInvite({ token, name: "Z", email: "z@example.com", password: "password123" })).rejects.toThrow("Seat limit");
	});
});

describe("members", () => {
	it("lists and updates roles with the right permissions", async () => {
		const { actor, workspace, member, memberActor } = await withMember();
		expect((await listMembers(workspace.id)).map((m) => m.role)).toEqual(["owner", "member"]);
		await expect(updateMemberRole(memberActor, workspace.id, member.id, "admin")).rejects.toBeInstanceOf(AppError);
		await updateMemberRole(actor, workspace.id, member.id, "admin");
		expect((await getMembership(member.id))?.role).toBe("admin");
	});

	it("never leaves a workspace without an owner", async () => {
		const { actor, workspace, user } = await withMember();
		await expect(updateMemberRole(actor, workspace.id, user.id, "admin")).rejects.toThrow(/at least one owner/);
		await expect(removeMember(actor, workspace.id, user.id)).rejects.toThrow(/at least one owner/);
	});

	it("admins can't remove owners; anyone can leave", async () => {
		const { workspace, user, member } = await withMember("admin");
		const adminActor = { userId: member.id, role: "admin" as const };
		await expect(removeMember(adminActor, workspace.id, user.id)).rejects.toThrow(/owner/);
		await removeMember(adminActor, workspace.id, member.id);
		expect(await getMembership(member.id)).toBeNull();
	});
});
