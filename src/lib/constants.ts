export const FEEDBACK_TYPES = ["idea", "bug", "praise", "question", "other"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_STATUSES = [
	"new",
	"reviewing",
	"planned",
	"in_progress",
	"done",
	"closed",
] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Statuses that count as "still needs attention". */
export const OPEN_STATUSES: FeedbackStatus[] = ["new", "reviewing", "planned", "in_progress"];

/** Statuses that appear on the public roadmap. */
export const ROADMAP_STATUSES = ["planned", "in_progress", "done"] as const;

export const FEEDBACK_SOURCES = ["widget", "board", "form", "api"] as const;
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number];

export const MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const PROJECT_COLORS = ["violet", "tomato", "sunny", "mint", "sky", "bubblegum"] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];
