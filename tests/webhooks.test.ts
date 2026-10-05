import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hmacSha256Hex } from "#/server/lib/crypto";
import { submitFeedback } from "#/server/services/feedback";
import { updateProject } from "#/server/services/projects";
import { buildWebhookBody, isPrivateWebhookTarget, sendFeedbackWebhook, webhookKind } from "#/server/services/webhooks";
import { seedProject } from "./helpers";

const received: { headers: IncomingHttpHeaders; body: string }[] = [];
let status = 200;
const server = createServer((req, res) => {
	let body = "";
	req.on("data", (c) => (body += c));
	req.on("end", () => {
		received.push({ headers: req.headers, body });
		res.writeHead(status).end();
	});
});
let url = "";

beforeAll(async () => {
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("webhooks", () => {
	it("detects chat platforms", () => {
		expect(webhookKind("https://hooks.slack.com/services/T/B/x")).toBe("slack");
		expect(webhookKind("https://discord.com/api/webhooks/1/abc")).toBe("discord");
		expect(webhookKind("https://discord.com.evil.io/api/webhooks/1")).toBe("generic");
		expect(webhookKind("https://example.com/hook")).toBe("generic");
	});

	it("sends a signed JSON payload on new feedback", async () => {
		const { project, actor } = await seedProject();
		const p = await updateProject(actor, project.id, { webhookUrl: url });
		received.length = 0;
		const item = await submitFeedback(
			p,
			{ message: "Webhook me", type: "bug" },
			{ source: "widget", ip: "3.3.3.3", appUrl: "https://hb.test" },
		);

		expect(received).toHaveLength(1);
		const { headers, body } = received[0];
		const json = JSON.parse(body);
		expect(json).toMatchObject({
			event: "feedback.created",
			feedback: { id: item?.id, message: "Webhook me" },
			url: `https://hb.test/app/p/${p.id}?id=${item?.id}`,
		});
		const expected = await hmacSha256Hex(p.webhookSecret, `${headers["x-hootbox-timestamp"]}.${body}`);
		expect(headers["x-hootbox-signature"]).toBe(`sha256=${expected}`);
	});

	it("never fails the submission when the webhook fails", async () => {
		const { project, actor } = await seedProject();
		status = 500;
		const p = await updateProject(actor, project.id, { webhookUrl: url });
		await expect(submitFeedback(p, { message: "Still saved" }, { source: "widget", ip: "4.4.4.4" })).resolves.toBeTruthy();
		const dead = await updateProject(actor, project.id, { webhookUrl: "http://127.0.0.1:1/nothing" });
		await expect(submitFeedback(dead, { message: "Still saved" }, { source: "widget", ip: "4.4.4.4" })).resolves.toBeTruthy();
		status = 200;
	});

	it("flags private webhook targets", () => {
		for (const u of [
			"http://localhost/x",
			"http://127.0.0.1:8080",
			"http://10.1.2.3",
			"http://169.254.169.254/latest",
			"http://192.168.1.1",
			"http://172.20.0.1",
			"http://[::1]/",
			"http://db.internal/",
		]) {
			expect(isPrivateWebhookTarget(u), u).toBe(true);
		}
		for (const u of ["https://hooks.slack.com/x", "https://8.8.8.8/", "https://172.32.0.1/", "https://example.com/"]) {
			expect(isPrivateWebhookTarget(u), u).toBe(false);
		}
	});

	it("skips private targets unless explicitly allowed", async () => {
		const { project, actor } = await seedProject();
		const p = await updateProject(actor, project.id, { webhookUrl: url });
		process.env.ALLOW_PRIVATE_WEBHOOKS = "false";
		received.length = 0;
		try {
			expect(await sendFeedbackWebhook(p, { id: "x", number: 1, type: "idea", message: "hi" } as never)).toBe(false);
			expect(received).toHaveLength(0);
		} finally {
			process.env.ALLOW_PRIVATE_WEBHOOKS = "true";
		}
	});

	it("formats Slack and Discord messages", async () => {
		const { project } = await seedProject("Shop");
		const item = {
			id: "f1",
			number: 7,
			type: "idea",
			title: null,
			message: "Add @everyone ping",
			authorEmail: "a@b.c",
			authorName: null,
		} as never;
		const slack = buildWebhookBody({ ...project, webhookUrl: "https://hooks.slack.com/services/x" }, item) as { text: string };
		expect(slack.text).toContain("New idea #7 in Shop");
		const discord = buildWebhookBody({ ...project, webhookUrl: "https://discord.com/api/webhooks/1/x" }, item) as {
			allowed_mentions: unknown;
		};
		expect(discord.allowed_mentions).toEqual({ parse: [] });
	});
});
