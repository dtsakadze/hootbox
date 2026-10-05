import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createProjectSchema, updateProjectSchema } from "#/lib/validation";
import { appUrl } from "../http";
import { createProject, deleteProject, getProjectForUser, listProjects, rotateProjectSecret, updateProject } from "../services/projects";
import { authMiddleware } from "./middleware";
import { validate } from "./validate";

const projectId = z.object({ projectId: z.string().max(64) });

export const listProjectsFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => listProjects(context.auth.workspace.id));

export const getProjectFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(validate(projectId))
	.handler(async ({ data, context }) => {
		const { project, role } = await getProjectForUser(context.auth.user.id, data.projectId);
		const canManage = role !== "member";
		return {
			project: {
				...project,
				// Only admins see secrets (a Slack/Discord webhook URL is one, too).
				webhookSecret: canManage ? project.webhookSecret : "",
				webhookUrl: canManage ? project.webhookUrl : null,
			},
			role,
			canManage,
			appUrl: appUrl(),
		};
	});

export const createProjectFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(createProjectSchema))
	.handler(async ({ data, context }) => {
		const project = await createProject(context.auth.actor, context.auth.workspace.id, data);
		return { id: project.id };
	});

export const updateProjectFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(projectId.extend({ patch: updateProjectSchema })))
	.handler(async ({ data, context }) => {
		const { role } = await getProjectForUser(context.auth.user.id, data.projectId);
		await updateProject({ role }, data.projectId, data.patch);
		return { ok: true };
	});

export const rotateSecretFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(projectId.extend({ which: z.enum(["publicKey", "webhookSecret"]) })))
	.handler(async ({ data, context }) => {
		const { role } = await getProjectForUser(context.auth.user.id, data.projectId);
		await rotateProjectSecret({ role }, data.projectId, data.which);
		return { ok: true };
	});

export const deleteProjectFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(projectId))
	.handler(async ({ data, context }) => {
		const { role } = await getProjectForUser(context.auth.user.id, data.projectId);
		await deleteProject({ role }, data.projectId);
		return { ok: true };
	});

export const sendTestWebhookFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(projectId))
	.handler(async ({ data, context }) => {
		const { project, role } = await getProjectForUser(context.auth.user.id, data.projectId);
		if (role === "member") return { ok: false };
		const { sendFeedbackWebhook } = await import("../services/webhooks");
		const now = new Date();
		const ok = await sendFeedbackWebhook(
			project,
			{
				id: "test",
				projectId: project.id,
				number: 0,
				type: "idea",
				status: "new",
				source: "api",
				title: "Test from Hootbox",
				message: "🦉 Hoot hoot! Your webhook is wired up correctly.",
				rating: null,
				authorName: "Hootbox",
				authorEmail: null,
				pageUrl: null,
				userAgent: null,
				metadata: {},
				tags: [],
				isPublic: false,
				publicReply: null,
				voteCount: 0,
				createdAt: now,
				updatedAt: now,
			},
			appUrl(),
		);
		return { ok };
	});
