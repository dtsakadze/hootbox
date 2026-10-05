import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { feedbackFiltersSchema, feedbackStatusSchema, LIMITS, updateFeedbackSchema } from "#/lib/validation";
import {
	addNote,
	bulkUpdateStatus,
	countByStatus,
	deleteFeedback,
	deleteNote,
	getFeedback,
	getStats,
	listFeedback,
	listTags,
	updateFeedback,
} from "../services/feedback";
import { getProjectForUser } from "../services/projects";
import { assertRole } from "../services/workspaces";
import { authMiddleware } from "./middleware";
import { validate } from "./validate";

const id = z.string().max(64);
const ids = z.array(id).min(1).max(200);

export const listFeedbackFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ projectId: id, filters: feedbackFiltersSchema })))
	.handler(async ({ data, context }) => {
		await getProjectForUser(context.auth.user.id, data.projectId);
		const [list, counts, tags] = await Promise.all([
			listFeedback(data.projectId, data.filters),
			countByStatus(data.projectId),
			listTags(data.projectId),
		]);
		return { ...list, counts, tags };
	});

export const getFeedbackFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ projectId: id, feedbackId: id })))
	.handler(async ({ data, context }) => {
		await getProjectForUser(context.auth.user.id, data.projectId);
		return getFeedback(data.projectId, data.feedbackId);
	});

export const updateFeedbackFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ projectId: id, feedbackId: id, patch: updateFeedbackSchema })))
	.handler(async ({ data, context }) => {
		await getProjectForUser(context.auth.user.id, data.projectId);
		return updateFeedback(data.projectId, data.feedbackId, data.patch);
	});

export const bulkStatusFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ projectId: id, ids, status: feedbackStatusSchema })))
	.handler(async ({ data, context }) => {
		await getProjectForUser(context.auth.user.id, data.projectId);
		return { updated: await bulkUpdateStatus(data.projectId, data.ids, data.status) };
	});

export const deleteFeedbackFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ projectId: id, ids })))
	.handler(async ({ data, context }) => {
		const { role } = await getProjectForUser(context.auth.user.id, data.projectId);
		assertRole(role, "admin");
		return { deleted: await deleteFeedback(data.projectId, data.ids) };
	});

export const addNoteFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(
		validate(z.object({ projectId: id, feedbackId: id, body: z.string().trim().min(1, "Write something first").max(LIMITS.note) })),
	)
	.handler(async ({ data, context }) => {
		await getProjectForUser(context.auth.user.id, data.projectId);
		return addNote(data.projectId, data.feedbackId, context.auth.user.id, data.body);
	});

export const deleteNoteFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ projectId: id, noteId: id })))
	.handler(async ({ data, context }) => {
		const { role } = await getProjectForUser(context.auth.user.id, data.projectId);
		await deleteNote({ userId: context.auth.user.id, role }, data.projectId, data.noteId);
		return { ok: true };
	});

export const getStatsFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(validate(z.object({ projectId: id, days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) })))
	.handler(async ({ data, context }) => {
		await getProjectForUser(context.auth.user.id, data.projectId);
		return getStats(data.projectId, data.days);
	});
