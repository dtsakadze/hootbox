import { sql } from "drizzle-orm";
import {
	boolean,
	customType,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
	dataType: () => "tsvector",
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

import { FEEDBACK_SOURCES, FEEDBACK_STATUSES, FEEDBACK_TYPES, type FeedbackType, MEMBER_ROLES } from "#/lib/constants";

export * from "#/lib/constants";

export const users = pgTable("users", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	name: text("name").notNull(),
	passwordHash: text("password_hash").notNull(),
	createdAt: createdAt(),
});

export const sessions = pgTable(
	"sessions",
	{
		/** SHA-256 of the session token; the raw token only lives in the cookie. */
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: createdAt(),
	},
	(t) => [index("sessions_user_idx").on(t.userId)],
);

/**
 * A workspace groups projects and members. The open-source edition runs a
 * single workspace; the hosted edition can offer many (orgs, billing, …).
 */
export const workspaces = pgTable("workspaces", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	createdAt: createdAt(),
});

export const workspaceMembers = pgTable(
	"workspace_members",
	{
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: text("role", { enum: MEMBER_ROLES }).notNull().default("member"),
		createdAt: createdAt(),
	},
	(t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index("workspace_members_user_idx").on(t.userId)],
);

export const invites = pgTable(
	"invites",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		/** SHA-256 of the invite token. */
		tokenHash: text("token_hash").notNull().unique(),
		role: text("role", { enum: MEMBER_ROLES }).notNull().default("member"),
		note: text("note"),
		createdBy: text("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		acceptedAt: timestamp("accepted_at", { withTimezone: true }),
		createdAt: createdAt(),
	},
	(t) => [index("invites_workspace_idx").on(t.workspaceId)],
);

export type WidgetSettings = {
	buttonLabel: string;
	position: "bottom-right" | "bottom-left";
	askEmail: "optional" | "required" | "hidden";
	types: FeedbackType[];
	thankYouMessage: string;
};

export const projects = pgTable(
	"projects",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		/** Used for the public board & form URLs. Globally unique. */
		slug: text("slug").notNull(),
		/** Public, non-secret key used by the widget and API to submit feedback. */
		publicKey: text("public_key").notNull(),
		description: text("description").notNull().default(""),
		color: text("color").notNull().default("violet"),
		boardEnabled: boolean("board_enabled").notNull().default(true),
		boardSubmissions: boolean("board_submissions").notNull().default(true),
		/** New submissions from the board/form are public right away. */
		autoPublish: boolean("auto_publish").notNull().default(false),
		widgetSettings: jsonb("widget_settings").$type<WidgetSettings>().notNull(),
		/** Empty = accept submissions from any origin. */
		allowedOrigins: text("allowed_origins").array().notNull().default(sql`'{}'::text[]`),
		webhookUrl: text("webhook_url"),
		webhookSecret: text("webhook_secret").notNull(),
		/** Last assigned feedback number; bumped atomically on insert. */
		feedbackSeq: integer("feedback_seq").notNull().default(0),
		createdAt: createdAt(),
	},
	(t) => [
		uniqueIndex("projects_slug_idx").on(t.slug),
		uniqueIndex("projects_public_key_idx").on(t.publicKey),
		index("projects_workspace_idx").on(t.workspaceId),
	],
);

export const feedback = pgTable(
	"feedback",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		/** Short, per-project sequence number shown in the UI (#42). */
		number: integer("number").notNull(),
		type: text("type", { enum: FEEDBACK_TYPES }).notNull().default("idea"),
		status: text("status", { enum: FEEDBACK_STATUSES }).notNull().default("new"),
		source: text("source", { enum: FEEDBACK_SOURCES }).notNull().default("widget"),
		title: text("title"),
		message: text("message").notNull(),
		/** 1–5 mood rating, optional. */
		rating: smallint("rating"),
		authorName: text("author_name"),
		authorEmail: text("author_email"),
		pageUrl: text("page_url"),
		userAgent: text("user_agent"),
		metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().notNull().default({}),
		tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
		isPublic: boolean("is_public").notNull().default(false),
		/** Shown publicly on the board beneath the post. */
		publicReply: text("public_reply"),
		voteCount: integer("vote_count").notNull().default(0),
		search: tsvector("search").generatedAlwaysAs(
			sql`to_tsvector('simple', coalesce(title, '') || ' ' || message || ' ' || coalesce(author_email, '') || ' ' || coalesce(author_name, ''))`,
		),
		createdAt: createdAt(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex("feedback_project_number_idx").on(t.projectId, t.number),
		index("feedback_project_created_idx").on(t.projectId, t.createdAt),
		index("feedback_project_status_idx").on(t.projectId, t.status),
		index("feedback_public_idx").on(t.projectId, t.voteCount).where(sql`${t.isPublic}`),
		index("feedback_search_idx").using("gin", t.search),
		index("feedback_tags_idx").using("gin", t.tags),
	],
);

export const notes = pgTable(
	"notes",
	{
		id: text("id").primaryKey(),
		feedbackId: text("feedback_id")
			.notNull()
			.references(() => feedback.id, { onDelete: "cascade" }),
		userId: text("user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		body: text("body").notNull(),
		createdAt: createdAt(),
	},
	(t) => [index("notes_feedback_idx").on(t.feedbackId, t.createdAt)],
);

export const votes = pgTable(
	"votes",
	{
		feedbackId: text("feedback_id")
			.notNull()
			.references(() => feedback.id, { onDelete: "cascade" }),
		/** Anonymous, hashed voter identifier (cookie based). */
		voterId: text("voter_id").notNull(),
		createdAt: createdAt(),
	},
	(t) => [primaryKey({ columns: [t.feedbackId, t.voterId] })],
);

/** Fixed-window counters; works the same on a VPS and on serverless. */
export const rateLimits = pgTable("rate_limits", {
	key: text("key").primaryKey(),
	count: integer("count").notNull(),
	resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type Note = typeof notes.$inferSelect;
