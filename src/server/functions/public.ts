import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { submitFeedbackSchema } from "#/lib/validation";
import { requestMeta, voterId } from "../http";
import { sha256 } from "../lib/crypto";
import { AppError, notFound } from "../lib/errors";
import { listPublicPosts, submitFeedback, toggleVote } from "../services/feedback";
import { getProjectBySlug } from "../services/projects";
import { enforceRateLimit } from "../services/rate-limit";
import { validate } from "./validate";

const slug = z.string().max(64);

function publicProject(p: NonNullable<Awaited<ReturnType<typeof getProjectBySlug>>>) {
	return {
		name: p.name,
		slug: p.slug,
		description: p.description,
		color: p.color,
		boardEnabled: p.boardEnabled,
		boardSubmissions: p.boardSubmissions,
		types: p.widgetSettings.types,
		askEmail: p.widgetSettings.askEmail,
		thankYouMessage: p.widgetSettings.thankYouMessage,
	};
}

export const getBoardFn = createServerFn({ method: "GET" })
	.validator(validate(z.object({ slug, sort: z.enum(["top", "new"]).catch("top").default("top") })))
	.handler(async ({ data }) => {
		const project = await getProjectBySlug(data.slug);
		if (!project || !project.boardEnabled) throw notFound("This board doesn't exist (or is private).");
		const posts = await listPublicPosts(project.id, { sort: data.sort, voterId: await voterId(false) });
		return { project: publicProject(project), posts };
	});

export const getFormFn = createServerFn({ method: "GET" })
	.validator(validate(z.object({ slug })))
	.handler(async ({ data }) => {
		const project = await getProjectBySlug(data.slug);
		if (!project || !project.boardSubmissions) throw notFound("This form doesn't exist (or is closed).");
		return { project: publicProject(project) };
	});

export const submitPublicFn = createServerFn({ method: "POST" })
	.validator(validate(z.object({ slug, source: z.enum(["board", "form"]), feedback: z.unknown() })))
	.handler(async ({ data }) => {
		const project = await getProjectBySlug(data.slug);
		if (!project) throw notFound("Project not found");
		const item = await submitFeedback(project, data.feedback as z.input<typeof submitFeedbackSchema>, {
			source: data.source,
			...requestMeta(),
			origin: getRequestHeader("origin") ?? null,
		});
		return { ok: true, number: item?.number ?? null, isPublic: item?.isPublic ?? false };
	});

export const voteFn = createServerFn({ method: "POST" })
	.validator(validate(z.object({ slug, feedbackId: z.string().max(64) })))
	.handler(async ({ data }) => {
		const project = await getProjectBySlug(data.slug);
		if (!project || !project.boardEnabled) throw notFound("Board not found");
		const { ip } = requestMeta();
		await enforceRateLimit(`vote:${await sha256(ip ?? "unknown")}`, 60, 600);
		const voter = await voterId(true);
		if (!voter) throw new AppError("BAD_REQUEST", "Couldn't record your vote. Are cookies enabled?");
		return toggleVote(project.id, data.feedbackId, voter);
	});
