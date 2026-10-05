import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { closeDb, getDb } from "#/server/db/client";
import { resetExtensions } from "#/server/extensions";

beforeEach(async () => {
	resetExtensions();
	await getDb().execute(
		sql`truncate table users, sessions, workspaces, workspace_members, invites, projects, feedback, notes, votes, rate_limits restart identity cascade`,
	);
});

afterAll(async () => {
	await closeDb();
});
