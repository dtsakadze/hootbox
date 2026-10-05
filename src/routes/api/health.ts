import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { json } from "#/server/api";
import { getDb } from "#/server/db/client";

export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: async () => {
				try {
					await getDb().execute(sql`select 1`);
					return json({ ok: true });
				} catch {
					return json({ ok: false }, 503);
				}
			},
		},
	},
});
