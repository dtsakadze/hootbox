import type { Feedback, Project } from "./db/schema";

/**
 * Extension points for building on top of the open-source edition (e.g. a
 * hosted version with billing, plan limits or sign-ups) without forking it.
 *
 * Register implementations once at startup — see docs/extending.md.
 * Throwing an `AppError` from a `before*` hook blocks the action and shows its
 * message to the user.
 */
export interface Extensions {
	/** Allow anyone to create an account + their own workspace. OSS: invite-only after setup. */
	allowOpenSignup: boolean;
	beforeProjectCreate?(ctx: { workspaceId: string; userId: string }): Promise<void>;
	beforeMemberJoin?(ctx: { workspaceId: string }): Promise<void>;
	beforeFeedbackCreate?(ctx: { project: Project }): Promise<void>;
	onFeedbackCreated?(ctx: { project: Project; feedback: Feedback }): Promise<void>;
}

const defaults: Extensions = { allowOpenSignup: false };
let current: Extensions = { ...defaults };

export function registerExtensions(ext: Partial<Extensions>) {
	current = { ...current, ...ext };
}

export function extensions(): Extensions {
	return current;
}

/** Test helper. */
export function resetExtensions() {
	current = { ...defaults };
}
