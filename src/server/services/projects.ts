import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import type { MemberRole } from "#/lib/constants";
import type { createProjectSchema, updateProjectSchema } from "#/lib/validation";
import { getDb } from "../db/client";
import { feedback, type Project, projects, type WidgetSettings, workspaceMembers } from "../db/schema";
import { extensions } from "../extensions";
import { newId, randomToken } from "../lib/crypto";
import { AppError, notFound } from "../lib/errors";
import { assertRole } from "./workspaces";

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
	buttonLabel: "Feedback",
	position: "bottom-right",
	askEmail: "optional",
	types: ["idea", "bug", "praise", "question"],
	thankYouMessage: "Thanks a bunch! We read every single message. 💛",
};

const RESERVED_SLUGS = new Set(["app", "api", "admin", "login", "setup", "new", "settings", "widget"]);

export function slugify(value: string) {
	const slug = value
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40)
		.replace(/-+$/, "");
	return slug.length >= 2 ? slug : `project-${slug}`.replace(/-$/, "");
}

async function isSlugTaken(slug: string, exceptId?: string) {
	if (RESERVED_SLUGS.has(slug)) return true;
	const [row] = await getDb()
		.select({ id: projects.id })
		.from(projects)
		.where(exceptId ? and(eq(projects.slug, slug), sql`${projects.id} <> ${exceptId}`) : eq(projects.slug, slug))
		.limit(1);
	return Boolean(row);
}

async function uniqueSlug(base: string) {
	let slug = base;
	for (let i = 2; await isSlugTaken(slug); i++) {
		slug = `${base}-${
			i <= 9
				? i
				: randomToken(3)
						.toLowerCase()
						.replace(/[^a-z0-9]/g, "")
		}`;
	}
	return slug;
}

export const newPublicKey = () => `pk_${randomToken(18).replace(/[-_]/g, "x")}`;

export async function createProject(
	actor: { userId: string; role: MemberRole },
	workspaceId: string,
	input: z.output<typeof createProjectSchema>,
) {
	assertRole(actor.role, "admin");
	await extensions().beforeProjectCreate?.({ workspaceId, userId: actor.userId });
	const [project] = await getDb()
		.insert(projects)
		.values({
			id: newId(),
			workspaceId,
			name: input.name,
			description: input.description,
			color: input.color,
			slug: await uniqueSlug(slugify(input.name)),
			publicKey: newPublicKey(),
			webhookSecret: `whsec_${randomToken(24)}`,
			widgetSettings: DEFAULT_WIDGET_SETTINGS,
		})
		.returning();
	return project;
}

export async function listProjects(workspaceId: string) {
	const rows = await getDb()
		.select({
			id: projects.id,
			name: projects.name,
			slug: projects.slug,
			color: projects.color,
			description: projects.description,
		})
		.from(projects)
		.where(eq(projects.workspaceId, workspaceId))
		.orderBy(asc(projects.createdAt));
	if (rows.length === 0) return [];

	const counts = await getDb()
		.select({ projectId: feedback.projectId, n: sql<number>`count(*)::int` })
		.from(feedback)
		.where(
			and(
				inArray(
					feedback.projectId,
					rows.map((r) => r.id),
				),
				eq(feedback.status, "new"),
			),
		)
		.groupBy(feedback.projectId);
	const byId = new Map(counts.map((c) => [c.projectId, c.n]));
	return rows.map((r) => ({ ...r, newCount: byId.get(r.id) ?? 0 }));
}

/** Loads a project the user can access, along with their role. Throws 404 otherwise. */
export async function getProjectForUser(userId: string, projectId: string) {
	const [row] = await getDb()
		.select({ project: projects, role: workspaceMembers.role })
		.from(projects)
		.innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, projects.workspaceId), eq(workspaceMembers.userId, userId)))
		.where(eq(projects.id, projectId))
		.limit(1);
	// Same 404 whether it doesn't exist or isn't yours: don't leak existence.
	if (!row) throw notFound("Project not found");
	return row;
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
	if (!slug || slug.length > 64) return null;
	const [project] = await getDb().select().from(projects).where(eq(projects.slug, slug.toLowerCase())).limit(1);
	return project ?? null;
}

export async function getProjectByPublicKey(key: string): Promise<Project | null> {
	if (!key || key.length > 64) return null;
	const [project] = await getDb().select().from(projects).where(eq(projects.publicKey, key)).limit(1);
	return project ?? null;
}

export async function updateProject(actor: { role: MemberRole }, projectId: string, input: z.output<typeof updateProjectSchema>) {
	assertRole(actor.role, "admin");
	if (input.slug && (await isSlugTaken(input.slug, projectId))) {
		throw new AppError("CONFLICT", "That URL is already taken. Try another one.");
	}
	const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
	if (Object.keys(patch).length === 0) {
		const [p] = await getDb().select().from(projects).where(eq(projects.id, projectId));
		return p;
	}
	const [project] = await getDb().update(projects).set(patch).where(eq(projects.id, projectId)).returning();
	return project;
}

export async function rotateProjectSecret(actor: { role: MemberRole }, projectId: string, which: "publicKey" | "webhookSecret") {
	assertRole(actor.role, "admin");
	const value = which === "publicKey" ? newPublicKey() : `whsec_${randomToken(24)}`;
	const [project] = await getDb()
		.update(projects)
		.set({ [which]: value })
		.where(eq(projects.id, projectId))
		.returning();
	return project;
}

export async function deleteProject(actor: { role: MemberRole }, projectId: string) {
	assertRole(actor.role, "admin");
	await getDb().delete(projects).where(eq(projects.id, projectId));
}
