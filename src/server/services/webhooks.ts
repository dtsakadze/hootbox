import type { Feedback, Project } from "../db/schema";
import { hmacSha256Hex } from "../lib/crypto";

type WebhookFeedback = Omit<Feedback, "search">;

const TYPE_EMOJI: Record<string, string> = { idea: "💡", bug: "🐞", praise: "💛", question: "❓", other: "💬" };

export function webhookKind(url: string): "slack" | "discord" | "generic" {
	const { hostname, pathname } = new URL(url);
	if (hostname === "hooks.slack.com") return "slack";
	if ((hostname === "discord.com" || hostname === "discordapp.com") && pathname.startsWith("/api/webhooks/")) return "discord";
	return "generic";
}

export function buildWebhookBody(project: Project, item: WebhookFeedback, appUrl?: string) {
	const link = appUrl ? `${appUrl.replace(/\/$/, "")}/app/p/${project.id}?id=${item.id}` : undefined;
	const kind = project.webhookUrl ? webhookKind(project.webhookUrl) : "generic";
	const excerpt = item.message.length > 600 ? `${item.message.slice(0, 600)}…` : item.message;
	const who = item.authorEmail ?? item.authorName ?? "Anonymous";
	const heading = `${TYPE_EMOJI[item.type] ?? "💬"} New ${item.type} #${item.number} in ${project.name}`;

	if (kind === "slack") {
		return {
			text: `*${heading}*\n${item.title ? `*${item.title}*\n` : ""}${excerpt}\n— ${who}${link ? `\n<${link}|Open in Hootbox>` : ""}`,
		};
	}
	if (kind === "discord") {
		return {
			content: `**${heading}**\n${item.title ? `**${item.title}**\n` : ""}${excerpt}\n— ${who}${link ? `\n${link}` : ""}`.slice(0, 1990),
			allowed_mentions: { parse: [] },
		};
	}
	return {
		event: "feedback.created",
		project: { id: project.id, name: project.name, slug: project.slug },
		feedback: {
			id: item.id,
			number: item.number,
			type: item.type,
			status: item.status,
			source: item.source,
			title: item.title,
			message: item.message,
			rating: item.rating,
			authorName: item.authorName,
			authorEmail: item.authorEmail,
			pageUrl: item.pageUrl,
			metadata: item.metadata,
			createdAt: item.createdAt,
		},
		url: link,
	};
}

/**
 * Notifies the project's webhook. Slack & Discord URLs get a chat-formatted
 * message; anything else gets JSON signed with `X-Hootbox-Signature`.
 * Never throws — a failing webhook must not lose feedback.
 */
export async function sendFeedbackWebhook(project: Project, item: WebhookFeedback, appUrl?: string) {
	if (!project.webhookUrl) return false;
	try {
		const body = JSON.stringify(buildWebhookBody(project, item, appUrl));
		const timestamp = Math.floor(Date.now() / 1000).toString();
		const signature = await hmacSha256Hex(project.webhookSecret, `${timestamp}.${body}`);
		const res = await fetch(project.webhookUrl, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"user-agent": "Hootbox-Webhook/1.0",
				"x-hootbox-event": "feedback.created",
				"x-hootbox-timestamp": timestamp,
				"x-hootbox-signature": `sha256=${signature}`,
			},
			body,
			redirect: "manual",
			signal: AbortSignal.timeout(5000),
		});
		if (!res.ok) console.warn(`[hootbox] webhook for project ${project.id} responded ${res.status}`);
		return res.ok;
	} catch (err) {
		console.warn(`[hootbox] webhook for project ${project.id} failed:`, (err as Error).message);
		return false;
	}
}
