import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { roleSchema } from "#/lib/validation";
import { appUrl } from "../http";
import {
	createInvite,
	listMembers,
	listPendingInvites,
	removeMember,
	renameWorkspace,
	revokeInvite,
	updateMemberRole,
	assertRole,
} from "../services/workspaces";
import { authMiddleware } from "./middleware";
import { validate } from "./validate";

export const getTeamFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const { workspace, role, user } = context.auth;
		const [members, invites] = await Promise.all([
			listMembers(workspace.id),
			role === "member" ? [] : listPendingInvites(workspace.id),
		]);
		return { workspace: { id: workspace.id, name: workspace.name }, members, invites, role, me: user.id };
	});

export const renameWorkspaceFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ name: z.string().trim().min(1, "Name can't be empty").max(80) })))
	.handler(async ({ data, context }) => {
		assertRole(context.auth.role, "admin");
		await renameWorkspace(context.auth.workspace.id, data.name);
		return { ok: true };
	});

export const createInviteFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ role: roleSchema, note: z.string().trim().max(100).optional() })))
	.handler(async ({ data, context }) => {
		const { token } = await createInvite(context.auth.actor, context.auth.workspace.id, data);
		return { url: `${appUrl()}/invite/${token}` };
	});

export const revokeInviteFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ inviteId: z.string().max(64) })))
	.handler(async ({ data, context }) => {
		await revokeInvite(context.auth.actor, context.auth.workspace.id, data.inviteId);
		return { ok: true };
	});

export const updateRoleFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ userId: z.string().max(64), role: roleSchema })))
	.handler(async ({ data, context }) => {
		await updateMemberRole(context.auth.actor, context.auth.workspace.id, data.userId, data.role);
		return { ok: true };
	});

export const removeMemberFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ userId: z.string().max(64) })))
	.handler(async ({ data, context }) => {
		await removeMember(context.auth.actor, context.auth.workspace.id, data.userId);
		return { ok: true, left: data.userId === context.auth.user.id };
	});
