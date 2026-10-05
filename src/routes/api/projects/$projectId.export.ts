import { createFileRoute } from "@tanstack/react-router";
import { errorResponse } from "#/server/api";
import { requireAuth } from "#/server/http";
import { exportCsv } from "#/server/services/feedback";
import { getProjectForUser } from "#/server/services/projects";

/** Downloads all of a project's feedback as CSV. Session-authenticated. */
export const Route = createFileRoute("/api/projects/$projectId/export")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				try {
					const { user } = await requireAuth();
					const { project } = await getProjectForUser(user.id, params.projectId);
					const csv = await exportCsv(project.id);
					const date = new Date().toISOString().slice(0, 10);
					return new Response(csv, {
						headers: {
							"content-type": "text/csv; charset=utf-8",
							"content-disposition": `attachment; filename="${project.slug}-feedback-${date}.csv"`,
							"cache-control": "no-store",
						},
					});
				} catch (err) {
					return errorResponse(err);
				}
			},
		},
	},
});
