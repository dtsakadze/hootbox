import { z } from "zod";
import {
	FEEDBACK_STATUSES,
	FEEDBACK_TYPES,
	MEMBER_ROLES,
	PROJECT_COLORS,
} from "./constants";

export const LIMITS = {
	message: 5000,
	title: 140,
	name: 80,
	email: 254,
	note: 5000,
	reply: 2000,
	tag: 32,
	tags: 10,
	url: 2048,
	metadataKeys: 20,
} as const;

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.nullable()
		.transform((v) => (v ? v : null));

export const emailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.max(LIMITS.email)
	.pipe(z.email("Please enter a valid email address"));

export const passwordSchema = z
	.string()
	.min(8, "Use at least 8 characters")
	.max(200, "That password is a bit too long");

export const nameSchema = trimmed(LIMITS.name).min(1, "Please enter a name");

export const loginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, "Please enter your password").max(200),
});

export const setupSchema = z.object({
	name: nameSchema,
	email: emailSchema,
	password: passwordSchema,
	workspaceName: trimmed(80).min(1, "Give your workspace a name"),
});

export const acceptInviteSchema = z.object({
	token: z.string().min(10).max(200),
	name: nameSchema,
	email: emailSchema,
	password: passwordSchema,
});

export const roleSchema = z.enum(MEMBER_ROLES);
export const feedbackTypeSchema = z.enum(FEEDBACK_TYPES);
export const feedbackStatusSchema = z.enum(FEEDBACK_STATUSES);

export const slugSchema = z
	.string()
	.trim()
	.toLowerCase()
	.min(2, "At least 2 characters")
	.max(48, "At most 48 characters")
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes");

const urlSchema = z
	.string()
	.trim()
	.max(LIMITS.url)
	.refine((v) => {
		try {
			const u = new URL(v);
			return u.protocol === "https:" || u.protocol === "http:";
		} catch {
			return false;
		}
	}, "Please enter a valid http(s) URL");

export const originSchema = urlSchema.transform((v) => new URL(v).origin);

export const widgetSettingsSchema = z.object({
	buttonLabel: trimmed(30).min(1),
	position: z.enum(["bottom-right", "bottom-left"]),
	askEmail: z.enum(["optional", "required", "hidden"]),
	types: z.array(feedbackTypeSchema).min(1, "Pick at least one type").max(5),
	thankYouMessage: trimmed(200).min(1),
});

export const createProjectSchema = z.object({
	name: trimmed(60).min(1, "Give your project a name"),
	description: trimmed(300).default(""),
	color: z.enum(PROJECT_COLORS).default("violet"),
});

export const updateProjectSchema = z.object({
	name: trimmed(60).min(1).optional(),
	slug: slugSchema.optional(),
	description: trimmed(300).optional(),
	color: z.enum(PROJECT_COLORS).optional(),
	boardEnabled: z.boolean().optional(),
	boardSubmissions: z.boolean().optional(),
	autoPublish: z.boolean().optional(),
	widgetSettings: widgetSettingsSchema.optional(),
	allowedOrigins: z.array(originSchema).max(20).optional(),
	webhookUrl: urlSchema.nullable().optional().or(z.literal("").transform(() => null)),
});

const metadataSchema = z
	.record(
		z.string().max(40),
		z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
	)
	.refine((m) => Object.keys(m).length <= LIMITS.metadataKeys, "Too many metadata keys")
	.default({});

/** What anyone on the internet may send us. Keep it tight. */
export const submitFeedbackSchema = z.object({
	type: feedbackTypeSchema.default("idea"),
	title: optionalText(LIMITS.title),
	message: z
		.string()
		.trim()
		.min(2, "Tell us a little more")
		.max(LIMITS.message, `Please keep it under ${LIMITS.message} characters`),
	rating: z.number().int().min(1).max(5).optional().nullable(),
	name: optionalText(LIMITS.name),
	email: z
		.string()
		.trim()
		.toLowerCase()
		.max(LIMITS.email)
		.optional()
		.nullable()
		.transform((v) => (v ? v : null))
		.pipe(z.email("Please enter a valid email address").nullable()),
	pageUrl: optionalText(LIMITS.url),
	metadata: metadataSchema,
	/** Honeypot: real users never fill this in. */
	website: z.string().max(500).optional(),
});
export type SubmitFeedbackInput = z.input<typeof submitFeedbackSchema>;

export const tagSchema = z
	.string()
	.trim()
	.toLowerCase()
	.min(1)
	.max(LIMITS.tag)
	.regex(/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u, "Tags can contain letters, numbers, spaces, - and _");

export const updateFeedbackSchema = z.object({
	type: feedbackTypeSchema.optional(),
	status: feedbackStatusSchema.optional(),
	title: optionalText(LIMITS.title),
	tags: z.array(tagSchema).max(LIMITS.tags).optional(),
	isPublic: z.boolean().optional(),
	publicReply: optionalText(LIMITS.reply),
});

export const SORTS = ["newest", "oldest", "votes"] as const;

export const feedbackFiltersSchema = z.object({
	status: z.union([feedbackStatusSchema, z.literal("open"), z.literal("all")]).catch("open").default("open"),
	type: feedbackTypeSchema.optional().catch(undefined),
	tag: z.string().max(LIMITS.tag).optional().catch(undefined),
	q: z.string().max(200).optional().catch(undefined),
	sort: z.enum(SORTS).catch("newest").default("newest"),
	page: z.number().int().min(1).max(10_000).catch(1).default(1),
});
export type FeedbackFilters = z.output<typeof feedbackFiltersSchema>;
