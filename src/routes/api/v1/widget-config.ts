import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, json } from "#/server/api";
import { AppError } from "#/server/lib/errors";
import { getProjectByPublicKey } from "#/server/services/projects";

/** Public widget configuration (no secrets). Cached briefly at the edge. */
export const Route = createFileRoute("/api/v1/widget-config")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const headers = { "access-control-allow-origin": "*", "cache-control": "public, max-age=60, stale-while-revalidate=600" };
				try {
					const key = new URL(request.url).searchParams.get("key") ?? "";
					const project = await getProjectByPublicKey(key);
					if (!project) throw new AppError("NOT_FOUND", "Unknown project key");
					return json({ name: project.name, color: project.color, ...project.widgetSettings }, 200, headers);
				} catch (err) {
					return errorResponse(err, { "access-control-allow-origin": "*" });
				}
			},
		},
	},
});
