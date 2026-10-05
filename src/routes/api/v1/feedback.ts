import { createFileRoute } from "@tanstack/react-router";
import type { SubmitFeedbackInput } from "#/lib/validation";
import { CORS_HEADERS, errorResponse, json, readJsonBody } from "#/server/api";
import { requestMeta } from "#/server/http";
import { AppError } from "#/server/lib/errors";
import { submitFeedback } from "#/server/services/feedback";
import { getProjectByPublicKey } from "#/server/services/projects";

/**
 * Public submission endpoint used by the widget and custom integrations.
 * POST /api/v1/feedback  { key, message, type?, title?, rating?, email?, name?, pageUrl?, metadata? }
 */
export const Route = createFileRoute("/api/v1/feedback")({
	server: {
		handlers: {
			OPTIONS: () => new Response(null, { status: 204, headers: CORS_HEADERS }),
			POST: async ({ request }) => {
				try {
					const body = await readJsonBody(request);
					const key = request.headers.get("x-hootbox-key") ?? (typeof body.key === "string" ? body.key : "");
					const project = await getProjectByPublicKey(key);
					if (!project) throw new AppError("NOT_FOUND", "Unknown project key");

					const source = body.source === "widget" ? "widget" : "api";
					// Fully validated inside submitFeedback.
					const item = await submitFeedback(project, body as SubmitFeedbackInput, {
						source,
						...requestMeta(),
						origin: request.headers.get("origin"),
					});
					return json(
						{ ok: true, id: item?.id ?? null, number: item?.number ?? null, message: project.widgetSettings.thankYouMessage },
						201,
						CORS_HEADERS,
					);
				} catch (err) {
					return errorResponse(err, CORS_HEADERS);
				}
			},
		},
	},
});
