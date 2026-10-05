import { describe, expect, it } from "vitest";
import { feedbackFiltersSchema } from "#/lib/validation";
import { registerExtensions } from "#/server/extensions";
import {
	addNote,
	bulkUpdateStatus,
	countByStatus,
	deleteFeedback,
	deleteNote,
	exportCsv,
	getFeedback,
	getStats,
	listFeedback,
	listPublicPosts,
	listTags,
	submitFeedback,
	toPrefixQuery,
	toggleVote,
	updateFeedback,
} from "#/server/services/feedback";
import { updateProject } from "#/server/services/projects";
import { seedProject } from "./helpers";

const filters = (f: Record<string, unknown> = {}) => feedbackFiltersSchema.parse(f);
let ipCounter = 0;
const widget = () => ({ source: "widget" as const, ip: `10.0.0.${++ipCounter % 250}` });

describe("submitFeedback", () => {
	it("stores feedback with sequential numbers", async () => {
		const { project } = await seedProject();
		const a = await submitFeedback(project, { message: "First!", type: "praise", rating: 5 }, widget());
		const b = await submitFeedback(project, { message: "Second one", email: "x@y.com" }, widget());
		expect(a).toMatchObject({ number: 1, type: "praise", rating: 5, status: "new", source: "widget", isPublic: false });
		expect(b).toMatchObject({ number: 2, type: "idea", authorEmail: "x@y.com" });
	});

	it("assigns unique numbers under concurrency", async () => {
		const { project } = await seedProject();
		const rows = await Promise.all(
			Array.from({ length: 8 }, (_, i) => submitFeedback(project, { message: `msg ${i}` }, { source: "api", ip: `1.1.1.${i}` })),
		);
		expect(new Set(rows.map((r) => r!.number)).size).toBe(8);
	});

	it("silently drops honeypot spam", async () => {
		const { project } = await seedProject();
		expect(await submitFeedback(project, { message: "buy pills", website: "spam.com" }, widget())).toBeNull();
		expect((await listFeedback(project.id, filters())).total).toBe(0);
	});

	it("enforces allowed origins for the widget", async () => {
		const { project, actor } = await seedProject();
		const locked = await updateProject(actor, project.id, { allowedOrigins: ["https://myapp.com"] });
		await expect(submitFeedback(locked, { message: "hello" }, { ...widget(), origin: "https://evil.com" })).rejects.toThrow(/aren't allowed/);
		await expect(submitFeedback(locked, { message: "hello" }, { ...widget(), origin: null })).rejects.toThrow(/aren't allowed/);
		await expect(submitFeedback(locked, { message: "hello" }, { ...widget(), origin: "https://myapp.com" })).resolves.toBeTruthy();
	});

	it("rate limits per IP", async () => {
		const { project } = await seedProject();
		const ctx = { source: "widget" as const, ip: "9.9.9.9" };
		for (let i = 0; i < 10; i++) await submitFeedback(project, { message: `hi ${i}` }, ctx);
		await expect(submitFeedback(project, { message: "one more" }, ctx)).rejects.toThrow(/slow down/);
		await expect(submitFeedback(project, { message: "other ip" }, { ...ctx, ip: "8.8.8.8" })).resolves.toBeTruthy();
	});

	it("respects public submission settings and auto-publish", async () => {
		const { project, actor } = await seedProject();
		const closed = await updateProject(actor, project.id, { boardSubmissions: false });
		await expect(submitFeedback(closed, { message: "hello" }, { source: "board", ip: "1.2.3.4" })).rejects.toThrow(/isn't accepting/);
		const open = await updateProject(actor, project.id, { boardSubmissions: true, autoPublish: true });
		const post = await submitFeedback(open, { message: "Dark mode please" }, { source: "board", ip: "1.2.3.4" });
		expect(post?.isPublic).toBe(true);
		const fromForm = await submitFeedback(open, { message: "Private note" }, { source: "form", ip: "1.2.3.4" });
		expect(fromForm?.isPublic).toBe(false);
	});

	it("requires email when configured", async () => {
		const { project, actor } = await seedProject();
		const p = await updateProject(actor, project.id, { widgetSettings: { ...project.widgetSettings, askEmail: "required" } });
		await expect(submitFeedback(p, { message: "hello" }, widget())).rejects.toThrow(/email/);
		await expect(submitFeedback(p, { message: "hello", email: "a@b.co" }, widget())).resolves.toBeTruthy();
	});

	it("runs extension hooks", async () => {
		const { project } = await seedProject();
		const seen: number[] = [];
		registerExtensions({ onFeedbackCreated: async ({ feedback }) => void seen.push(feedback.number) });
		await submitFeedback(project, { message: "hook me" }, widget());
		expect(seen).toEqual([1]);
	});
});

describe("inbox", () => {
	async function seeded() {
		const ctx = await seedProject();
		const p = ctx.project;
		const a = await submitFeedback(p, { message: "Please add dark mode to the dashboard", type: "idea" }, widget());
		const b = await submitFeedback(p, { message: "Export button crashes", type: "bug", email: "sam@corp.io" }, widget());
		const c = await submitFeedback(p, { message: "You folks rock", type: "praise", rating: 5 }, widget());
		return { ...ctx, a: a!, b: b!, c: c! };
	}

	it("filters by status, type, tag and search", async () => {
		const { project, a, b, c } = await seeded();
		await updateFeedback(project.id, c.id, { status: "done", tags: ["Happy", "happy", "team"] });
		await updateFeedback(project.id, a.id, { tags: ["ui"] });

		expect((await listFeedback(project.id, filters())).items.map((i) => i.id).sort()).toEqual([a.id, b.id].sort());
		expect((await listFeedback(project.id, filters({ status: "all" }))).total).toBe(3);
		expect((await listFeedback(project.id, filters({ status: "done" }))).items[0].tags).toEqual(["happy", "team"]);
		expect((await listFeedback(project.id, filters({ status: "all", type: "bug" }))).items[0].id).toBe(b.id);
		expect((await listFeedback(project.id, filters({ status: "all", tag: "ui" }))).items[0].id).toBe(a.id);
		expect((await listFeedback(project.id, filters({ status: "all", q: "dark mo" }))).items[0].id).toBe(a.id);
		expect((await listFeedback(project.id, filters({ status: "all", q: "sam@corp" }))).items[0].id).toBe(b.id);
		expect((await listFeedback(project.id, filters({ status: "all", q: "#3" }))).items[0].id).toBe(c.id);
		expect((await listFeedback(project.id, filters({ status: "all", q: "'&|!:*" }))).total).toBe(3);
		expect((await listFeedback(project.id, filters({ status: "all", sort: "oldest" }))).items[0].id).toBe(a.id);
		expect(await listTags(project.id)).toEqual(expect.arrayContaining([{ tag: "ui", n: 1 }, { tag: "happy", n: 1 }]));
	});

	it("paginates", async () => {
		const { project } = await seedProject();
		for (let i = 0; i < 27; i++) await submitFeedback(project, { message: `note ${i}` }, { source: "api", ip: `2.2.${i}.1` });
		const page2 = await listFeedback(project.id, filters({ page: 2 }));
		expect(page2).toMatchObject({ total: 27, pageCount: 2, page: 2 });
		expect(page2.items).toHaveLength(2);
	});

	it("never leaks feedback across projects", async () => {
		const one = await seeded();
		const { createProject } = await import("#/server/services/projects");
		const other = await createProject(one.actor, one.workspace.id, { name: "Other", description: "", color: "sky" });
		await expect(getFeedback(other.id, one.a.id)).rejects.toThrow(/not found/i);
		await expect(updateFeedback(other.id, one.a.id, { status: "done" })).rejects.toThrow(/not found/i);
		expect(await deleteFeedback(other.id, [one.a.id])).toBe(0);
		expect(await bulkUpdateStatus(other.id, [one.a.id], "closed")).toBe(0);
		await expect(addNote(other.id, one.a.id, one.user.id, "hi")).rejects.toThrow(/not found/i);
	});

	it("bulk updates, deletes and counts by status", async () => {
		const { project, a, b, c } = await seeded();
		expect(await bulkUpdateStatus(project.id, [a.id, b.id], "planned")).toBe(2);
		expect(await countByStatus(project.id)).toMatchObject({ planned: 2, new: 1 });
		expect(await deleteFeedback(project.id, [c.id])).toBe(1);
		expect((await listFeedback(project.id, filters({ status: "all" }))).total).toBe(2);
	});

	it("handles internal notes with permissions", async () => {
		const { project, a, user, actor } = await seeded();
		const note = await addNote(project.id, a.id, user.id, "Looking into it");
		const detail = await getFeedback(project.id, a.id);
		expect(detail.notes).toEqual([expect.objectContaining({ body: "Looking into it", authorName: "Olive Owner" })]);
		await expect(deleteNote({ userId: "other", role: "member" }, project.id, note.id)).rejects.toThrow(/own notes/);
		await deleteNote(actor, project.id, note.id);
		expect((await getFeedback(project.id, a.id)).notes).toHaveLength(0);
	});
});

describe("public board", () => {
	it("shows only public posts and toggles votes", async () => {
		const { project } = await seedProject();
		const pub = (await submitFeedback(project, { message: "Public idea" }, widget()))!;
		const priv = (await submitFeedback(project, { message: "Private bug" }, widget()))!;
		await updateFeedback(project.id, pub.id, { isPublic: true, publicReply: "On it!" });

		expect((await listPublicPosts(project.id, { sort: "top" })).map((p) => p.id)).toEqual([pub.id]);
		await expect(toggleVote(project.id, priv.id, "voter-1")).rejects.toThrow(/not found/i);

		expect(await toggleVote(project.id, pub.id, "voter-1")).toEqual({ voted: true, voteCount: 1 });
		expect(await toggleVote(project.id, pub.id, "voter-2")).toEqual({ voted: true, voteCount: 2 });
		const [post] = await listPublicPosts(project.id, { sort: "top", voterId: "voter-1" });
		expect(post).toMatchObject({ hasVoted: true, voteCount: 2, publicReply: "On it!" });
		expect(await toggleVote(project.id, pub.id, "voter-1")).toEqual({ voted: false, voteCount: 1 });
	});

	it("counts concurrent votes correctly", async () => {
		const { project } = await seedProject();
		const pub = (await submitFeedback(project, { message: "Popular" }, widget()))!;
		await updateFeedback(project.id, pub.id, { isPublic: true });
		await Promise.all(Array.from({ length: 10 }, (_, i) => toggleVote(project.id, pub.id, `v${i}`)));
		const [post] = await listPublicPosts(project.id, { sort: "top" });
		expect(post.voteCount).toBe(10);
	});
});

describe("insights & export", () => {
	it("computes stats", async () => {
		const { project } = await seedProject();
		await submitFeedback(project, { message: "great", type: "praise", rating: 5 }, widget());
		await submitFeedback(project, { message: "meh", type: "bug", rating: 2 }, widget());
		await submitFeedback(project, { message: "idea!", type: "idea" }, widget());
		const stats = await getStats(project.id, 14);
		expect(stats).toMatchObject({ total: 3, open: 3, fresh: 3, last7: 3, prev7: 0, avgRating: 3.5, ratingCount: 2 });
		expect(stats.byType).toMatchObject({ praise: 1, bug: 1, idea: 1, question: 0 });
		expect(stats.daily).toHaveLength(14);
		expect(stats.daily.at(-1)?.n).toBe(3);
		expect(stats.ratings.find((r) => r.rating === 5)?.n).toBe(1);
	});

	it("exports CSV safely", async () => {
		const { project } = await seedProject();
		await submitFeedback(project, { message: '=HYPERLINK("http://evil")', name: 'Quote "Me"' }, widget());
		await submitFeedback(project, { message: "line one\nline two" }, widget());
		const csv = await exportCsv(project.id);
		const lines = csv.split("\r\n");
		expect(lines[0]).toMatch(/^number,createdAt,type/);
		expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
		expect(csv).toContain('"Quote ""Me"""');
		expect(csv).toContain('"line one\nline two"');
	});
});

describe("toPrefixQuery", () => {
	it("sanitises search input", () => {
		expect(toPrefixQuery("Dark  mode!")).toBe("dark:* & mode:*");
		expect(toPrefixQuery("'&|!")).toBeNull();
		expect(toPrefixQuery("café")).toBe("café:*");
	});
});
