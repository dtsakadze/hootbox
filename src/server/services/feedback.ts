import { and, asc, count, desc, eq, inArray, isNotNull, type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import {
	FEEDBACK_STATUSES,
	FEEDBACK_TYPES,
	type FeedbackSource,
	type FeedbackStatus,
	type MemberRole,
	OPEN_STATUSES,
} from "#/lib/constants";
import { type FeedbackFilters, type SubmitFeedbackInput, submitFeedbackSchema, type updateFeedbackSchema } from "#/lib/validation";
import { getDb } from "../db/client";
import { type Feedback, feedback, notes, type Project, projects, users, votes } from "../db/schema";
import { extensions } from "../extensions";
import { newId, sha256 } from "../lib/crypto";
import { AppError, forbidden, notFound } from "../lib/errors";
import { enforceRateLimit } from "./rate-limit";
import { sendFeedbackWebhook } from "./webhooks";
import { hasRole } from "./workspaces";

export const PAGE_SIZE = 25;

/** Every column except the generated search vector. */
const columns = {
	id: feedback.id,
	projectId: feedback.projectId,
	number: feedback.number,
	type: feedback.type,
	status: feedback.status,
	source: feedback.source,
	title: feedback.title,
	message: feedback.message,
	rating: feedback.rating,
	authorName: feedback.authorName,
	authorEmail: feedback.authorEmail,
	pageUrl: feedback.pageUrl,
	userAgent: feedback.userAgent,
	metadata: feedback.metadata,
	tags: feedback.tags,
	isPublic: feedback.isPublic,
	publicReply: feedback.publicReply,
	voteCount: feedback.voteCount,
	createdAt: feedback.createdAt,
	updatedAt: feedback.updatedAt,
};
export type FeedbackRow = Omit<Feedback, "search">;

export type SubmitContext = {
	source: FeedbackSource;
	ip?: string | null;
	userAgent?: string | null;
	/** Origin header of the request (widget/API submissions). */
	origin?: string | null;
	/** Base URL of this instance, used for links in notifications. */
	appUrl?: string;
};

export function isOriginAllowed(project: Pick<Project, "allowedOrigins">, origin?: string | null) {
	if (project.allowedOrigins.length === 0) return true;
	if (!origin) return false;
	return project.allowedOrigins.includes(origin.toLowerCase());
}

/**
 * Accepts feedback from the outside world (widget, public board, form, API).
 * Returns `null` for silently-dropped spam (honeypot).
 */
export async function submitFeedback(project: Project, raw: SubmitFeedbackInput, ctx: SubmitContext) {
	if ((ctx.source === "board" || ctx.source === "form") && !project.boardSubmissions) {
		throw forbidden("This project isn't accepting public submissions.");
	}
	if ((ctx.source === "widget" || ctx.source === "api") && !isOriginAllowed(project, ctx.origin)) {
		throw forbidden("Submissions from this website aren't allowed.");
	}

	const parsed = submitFeedbackSchema.safeParse(raw);
	if (!parsed.success) {
		throw new AppError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid feedback");
	}
	const input = parsed.data;
	if (input.website) return null; // Honeypot tripped: pretend all is well.

	if (project.widgetSettings.askEmail === "required" && ctx.source === "widget" && !input.email) {
		throw new AppError("BAD_REQUEST", "Please add your email so we can get back to you.");
	}

	const ipKey = ctx.ip ? await sha256(`ip:${ctx.ip}`) : "unknown";
	await enforceRateLimit(`submit:${project.id}:${ipKey}`, 10, 600);
	await enforceRateLimit(
		`submit:${project.id}`,
		1000,
		3600,
		"This project is receiving a lot of feedback right now. Please try again later.",
	);
	await extensions().beforeFeedbackCreate?.({ project });

	const db = getDb();
	const created = await db.transaction(async (tx) => {
		const [seq] = await tx
			.update(projects)
			.set({ feedbackSeq: sql`${projects.feedbackSeq} + 1` })
			.where(eq(projects.id, project.id))
			.returning({ value: projects.feedbackSeq });
		if (!seq) throw notFound("Project not found");
		const [row] = await tx
			.insert(feedback)
			.values({
				id: newId(),
				projectId: project.id,
				number: seq.value,
				type: input.type,
				source: ctx.source,
				title: input.title,
				message: input.message,
				rating: input.rating ?? null,
				authorName: input.name,
				authorEmail: input.email,
				pageUrl: input.pageUrl,
				userAgent: ctx.userAgent?.slice(0, 500) || null,
				metadata: input.metadata,
				isPublic: ctx.source === "board" && project.autoPublish,
			})
			.returning(columns);
		return row;
	});

	await Promise.allSettled([
		sendFeedbackWebhook(project, created, ctx.appUrl),
		extensions().onFeedbackCreated?.({ project, feedback: created as Feedback }),
	]);
	return created;
}

/** Turns free text into a prefix-matching tsquery, e.g. "dark mod" → "dark:* & mod:*". */
export function toPrefixQuery(q: string): string | null {
	const words = q.match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) ?? [];
	if (words.length === 0) return null;
	return words.map((w) => `${w.toLowerCase()}:*`).join(" & ");
}

function filterConditions(projectId: string, f: Partial<FeedbackFilters>): SQL[] {
	const where: SQL[] = [eq(feedback.projectId, projectId)];
	if (f.status === "open") where.push(inArray(feedback.status, OPEN_STATUSES));
	else if (f.status && f.status !== "all") where.push(eq(feedback.status, f.status));
	if (f.type) where.push(eq(feedback.type, f.type));
	if (f.tag) where.push(sql`${feedback.tags} @> array[${f.tag.toLowerCase()}]::text[]`);
	if (f.q) {
		const asNumber = /^#?(\d{1,9})$/.exec(f.q.trim());
		const tsq = toPrefixQuery(f.q);
		if (asNumber) where.push(eq(feedback.number, Number(asNumber[1])));
		else if (f.q.includes("@")) {
			// Emails are single tokens in the search vector, so match them directly.
			const like = `%${f.q
				.trim()
				.toLowerCase()
				.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
			where.push(sql`${feedback.authorEmail} like ${like}`);
		} else if (tsq) where.push(sql`${feedback.search} @@ to_tsquery('simple', ${tsq})`);
	}
	return where;
}

export async function listFeedback(projectId: string, filters: FeedbackFilters) {
	const db = getDb();
	const where = and(...filterConditions(projectId, filters));
	const order =
		filters.sort === "oldest"
			? [asc(feedback.createdAt)]
			: filters.sort === "votes"
				? [desc(feedback.voteCount), desc(feedback.createdAt)]
				: [desc(feedback.createdAt)];

	const [items, [{ total }]] = await Promise.all([
		db
			.select(columns)
			.from(feedback)
			.where(where)
			.orderBy(...order)
			.limit(PAGE_SIZE)
			.offset((filters.page - 1) * PAGE_SIZE),
		db.select({ total: count() }).from(feedback).where(where),
	]);
	return { items, total, page: filters.page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function countByStatus(projectId: string) {
	const rows = await getDb()
		.select({ status: feedback.status, n: count() })
		.from(feedback)
		.where(eq(feedback.projectId, projectId))
		.groupBy(feedback.status);
	const result = Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s, 0])) as Record<FeedbackStatus, number>;
	for (const r of rows) result[r.status] = r.n;
	return result;
}

export async function listTags(projectId: string) {
	const rows = await getDb().execute<{ tag: string; n: number }>(
		sql`select tag, count(*)::int as n from ${feedback}, unnest(${feedback.tags}) as tag
		    where ${feedback.projectId} = ${projectId} group by tag order by n desc, tag limit 50`,
	);
	return [...rows];
}

export async function getFeedback(projectId: string, feedbackId: string) {
	const db = getDb();
	const [item] = await db
		.select(columns)
		.from(feedback)
		.where(and(eq(feedback.id, feedbackId), eq(feedback.projectId, projectId)))
		.limit(1);
	if (!item) throw notFound("Feedback not found");
	const noteRows = await db
		.select({ id: notes.id, body: notes.body, createdAt: notes.createdAt, userId: notes.userId, authorName: users.name })
		.from(notes)
		.leftJoin(users, eq(users.id, notes.userId))
		.where(eq(notes.feedbackId, feedbackId))
		.orderBy(asc(notes.createdAt));
	return { ...item, notes: noteRows };
}

export async function updateFeedback(projectId: string, feedbackId: string, patch: z.output<typeof updateFeedbackSchema>) {
	const values = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
	if (patch.tags) values.tags = [...new Set(patch.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
	const [row] = await getDb()
		.update(feedback)
		.set({ ...values, updatedAt: new Date() })
		.where(and(eq(feedback.id, feedbackId), eq(feedback.projectId, projectId)))
		.returning(columns);
	if (!row) throw notFound("Feedback not found");
	return row;
}

export async function bulkUpdateStatus(projectId: string, ids: string[], status: FeedbackStatus) {
	if (ids.length === 0) return 0;
	const rows = await getDb()
		.update(feedback)
		.set({ status, updatedAt: new Date() })
		.where(and(eq(feedback.projectId, projectId), inArray(feedback.id, ids)))
		.returning({ id: feedback.id });
	return rows.length;
}

export async function deleteFeedback(projectId: string, ids: string[]) {
	if (ids.length === 0) return 0;
	const rows = await getDb()
		.delete(feedback)
		.where(and(eq(feedback.projectId, projectId), inArray(feedback.id, ids)))
		.returning({ id: feedback.id });
	return rows.length;
}

export async function addNote(projectId: string, feedbackId: string, userId: string, body: string) {
	const db = getDb();
	const [item] = await db
		.select({ id: feedback.id })
		.from(feedback)
		.where(and(eq(feedback.id, feedbackId), eq(feedback.projectId, projectId)));
	if (!item) throw notFound("Feedback not found");
	const [note] = await db.insert(notes).values({ id: newId(), feedbackId, userId, body }).returning();
	return note;
}

export async function deleteNote(actor: { userId: string; role: MemberRole }, projectId: string, noteId: string) {
	const db = getDb();
	const [row] = await db
		.select({ userId: notes.userId })
		.from(notes)
		.innerJoin(feedback, eq(feedback.id, notes.feedbackId))
		.where(and(eq(notes.id, noteId), eq(feedback.projectId, projectId)));
	if (!row) throw notFound("Note not found");
	if (row.userId !== actor.userId && !hasRole(actor.role, "admin")) throw forbidden("You can only delete your own notes.");
	await db.delete(notes).where(eq(notes.id, noteId));
}

// ---------------------------------------------------------------- public board

export async function listPublicPosts(projectId: string, opts: { sort: "top" | "new"; voterId?: string | null }) {
	const db = getDb();
	const voted = opts.voterId
		? sql<boolean>`exists (select 1 from ${votes} where ${votes.feedbackId} = ${feedback.id} and ${votes.voterId} = ${opts.voterId})`
		: sql<boolean>`false`;
	return db
		.select({
			id: feedback.id,
			number: feedback.number,
			type: feedback.type,
			status: feedback.status,
			title: feedback.title,
			message: feedback.message,
			publicReply: feedback.publicReply,
			voteCount: feedback.voteCount,
			createdAt: feedback.createdAt,
			hasVoted: voted,
		})
		.from(feedback)
		.where(and(eq(feedback.projectId, projectId), eq(feedback.isPublic, true)))
		.orderBy(...(opts.sort === "new" ? [desc(feedback.createdAt)] : [desc(feedback.voteCount), desc(feedback.createdAt)]))
		.limit(200);
}

/** Toggles a vote on a public post. Returns the new state. */
export async function toggleVote(projectId: string, feedbackId: string, voterId: string) {
	return getDb().transaction(async (tx) => {
		const [post] = await tx
			.select({ id: feedback.id })
			.from(feedback)
			.where(and(eq(feedback.id, feedbackId), eq(feedback.projectId, projectId), eq(feedback.isPublic, true)))
			.for("update");
		if (!post) throw notFound("Post not found");

		const inserted = await tx.insert(votes).values({ feedbackId, voterId }).onConflictDoNothing().returning();
		const voted = inserted.length > 0;
		if (!voted) await tx.delete(votes).where(and(eq(votes.feedbackId, feedbackId), eq(votes.voterId, voterId)));
		const [row] = await tx
			.update(feedback)
			.set({ voteCount: sql`greatest(0, ${feedback.voteCount} + ${voted ? 1 : -1})` })
			.where(eq(feedback.id, feedbackId))
			.returning({ voteCount: feedback.voteCount });
		return { voted, voteCount: row.voteCount };
	});
}

// ---------------------------------------------------------------- insights

export async function getStats(projectId: string, days = 30) {
	const db = getDb();
	const byProject = eq(feedback.projectId, projectId);

	const [summary] = await db
		.select({
			total: count(),
			open: sql<number>`count(*) filter (where ${inArray(feedback.status, OPEN_STATUSES)})::int`,
			fresh: sql<number>`count(*) filter (where ${feedback.status} = 'new')::int`,
			last7: sql<number>`count(*) filter (where ${feedback.createdAt} >= now() - interval '7 days')::int`,
			prev7: sql<number>`count(*) filter (where ${feedback.createdAt} >= now() - interval '14 days' and ${feedback.createdAt} < now() - interval '7 days')::int`,
			avgRating: sql<number | null>`round(avg(${feedback.rating})::numeric, 2)::float`,
			ratingCount: sql<number>`count(${feedback.rating})::int`,
			votes: sql<number>`coalesce(sum(${feedback.voteCount}), 0)::int`,
		})
		.from(feedback)
		.where(byProject);

	const [typeRows, ratingRows, daily, tags, topVoted] = await Promise.all([
		db.select({ type: feedback.type, n: count() }).from(feedback).where(byProject).groupBy(feedback.type),
		db
			.select({ rating: feedback.rating, n: count() })
			.from(feedback)
			.where(and(byProject, isNotNull(feedback.rating)))
			.groupBy(feedback.rating),
		db.execute<{ day: string; n: number }>(sql`
			select to_char(d.day, 'YYYY-MM-DD') as day, count(f.id)::int as n
			from generate_series((now() at time zone 'utc')::date - ${days - 1}::int, (now() at time zone 'utc')::date, interval '1 day') as d(day)
			left join ${feedback} f on f.project_id = ${projectId} and (f.created_at at time zone 'utc')::date = d.day
			group by d.day order by d.day`),
		listTags(projectId),
		db
			.select({
				id: feedback.id,
				number: feedback.number,
				title: feedback.title,
				message: feedback.message,
				voteCount: feedback.voteCount,
				status: feedback.status,
			})
			.from(feedback)
			.where(and(byProject, eq(feedback.isPublic, true), sql`${feedback.voteCount} > 0`))
			.orderBy(desc(feedback.voteCount))
			.limit(5),
	]);

	const byType = Object.fromEntries(FEEDBACK_TYPES.map((t) => [t, 0])) as Record<(typeof FEEDBACK_TYPES)[number], number>;
	for (const r of typeRows) byType[r.type] = r.n;
	const ratings = [1, 2, 3, 4, 5].map((r) => ({ rating: r, n: ratingRows.find((x) => x.rating === r)?.n ?? 0 }));

	return {
		...summary,
		byType,
		byStatus: await countByStatus(projectId),
		ratings,
		daily: [...daily],
		tags: tags.slice(0, 10),
		topVoted,
	};
}

// ---------------------------------------------------------------- export

function csvCell(value: unknown): string {
	if (value === null || value === undefined) return "";
	let s =
		value instanceof Date
			? value.toISOString()
			: Array.isArray(value)
				? value.join(", ")
				: typeof value === "object"
					? JSON.stringify(value)
					: String(value);
	// Neutralise spreadsheet formula injection.
	if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportCsv(projectId: string): Promise<string> {
	const rows = await getDb().select(columns).from(feedback).where(eq(feedback.projectId, projectId)).orderBy(asc(feedback.number));
	const header = [
		"number",
		"createdAt",
		"type",
		"status",
		"source",
		"title",
		"message",
		"rating",
		"authorName",
		"authorEmail",
		"pageUrl",
		"tags",
		"voteCount",
		"isPublic",
		"publicReply",
		"metadata",
	] as const;
	const lines = [header.join(",")];
	for (const r of rows) lines.push(header.map((h) => csvCell(r[h])).join(","));
	return `${lines.join("\r\n")}\r\n`;
}
