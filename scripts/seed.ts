/**
 * Fills the database with demo data so you can click around right away.
 *
 *   pnpm db:seed           # refuses if the database already has users
 *   pnpm db:seed --reset   # wipes everything first (never in production)
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import type { FeedbackStatus, FeedbackType } from "../src/lib/constants";
import { closeDb, getDb } from "../src/server/db/client";
import { feedback, notes, projects, votes } from "../src/server/db/schema";
import { newId } from "../src/server/lib/crypto";
import { setupInstance } from "../src/server/services/auth";
import { createProject, updateProject } from "../src/server/services/projects";
import { acceptInvite, createInvite } from "../src/server/services/workspaces";

const DEMO_PASSWORD = "hootbox123";
const reset = process.argv.includes("--reset");

// Deterministic PRNG so every seed looks the same.
let s = 42;
const rand = () => {
	s = (s * 1664525 + 1013904223) % 2 ** 32;
	return s / 2 ** 32;
};
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;

type Seed = {
	type: FeedbackType;
	message: string;
	title?: string;
	status?: FeedbackStatus;
	tags?: string[];
	public?: boolean;
	votes?: number;
	reply?: string;
	note?: string;
	rating?: number;
};

const PIXEL: Seed[] = [
	{
		type: "idea",
		title: "Dark mode 🌙",
		message: "Please add a dark mode! I plan my week late at night and the white background is blinding.",
		status: "in_progress",
		tags: ["ui"],
		public: true,
		votes: 48,
		reply: "It's happening! We're polishing the colors right now.",
		note: "Design is done, Sam is on the implementation.",
	},
	{
		type: "idea",
		title: "Google Calendar sync",
		message: "Two-way sync with Google Calendar would make this a no-brainer for our team.",
		status: "planned",
		tags: ["integrations"],
		public: true,
		votes: 37,
		reply: "Planned for next quarter. Thanks for all the votes!",
	},
	{
		type: "idea",
		title: "Recurring tasks",
		message: "I need tasks that repeat every Monday. Right now I copy them manually each week.",
		status: "done",
		tags: ["tasks"],
		public: true,
		votes: 29,
		reply: "Shipped in v2.3 🎉 Look for the repeat icon when creating a task.",
	},
	{
		type: "idea",
		title: "Keyboard shortcuts",
		message: "Power-user request: keyboard shortcuts for creating and completing tasks. Something like N for new, X to complete.",
		status: "planned",
		tags: ["ux"],
		public: true,
		votes: 22,
	},
	{
		type: "idea",
		title: "Export to PDF",
		message: "Would love to print my weekly plan as a nice PDF to stick on the fridge.",
		status: "reviewing",
		public: true,
		votes: 11,
	},
	{
		type: "idea",
		title: "Pomodoro timer",
		message: "A built-in focus timer next to each task would be amazing.",
		status: "new",
		public: true,
		votes: 15,
	},
	{
		type: "idea",
		title: "Shared boards with family",
		message: "Can I share a board with my partner without them needing a paid account?",
		status: "reviewing",
		tags: ["sharing"],
		public: true,
		votes: 18,
	},
	{
		type: "idea",
		title: "Mobile widgets",
		message: "An iOS home screen widget showing today's tasks, please!",
		status: "planned",
		tags: ["mobile"],
		public: true,
		votes: 26,
	},
	{ type: "idea", message: "Emoji reactions on comments would make collaboration more fun.", status: "new", public: true, votes: 4 },
	{
		type: "idea",
		message: "Let me pick a custom accent color for each project.",
		status: "done",
		tags: ["ui"],
		public: true,
		votes: 9,
		reply: "Done! Check the project settings.",
	},
	{
		type: "bug",
		title: "Drag & drop broken on Safari",
		message: "When I drag a task to another day on Safari 18, it snaps back to the original position.",
		status: "in_progress",
		tags: ["safari", "drag-drop"],
		rating: 2,
		note: "Reproduced on Safari 18.1. Looks like a pointer-events issue.",
	},
	{
		type: "bug",
		message: "The export button does nothing when I have more than 500 tasks.",
		status: "reviewing",
		tags: ["export"],
		rating: 2,
	},
	{ type: "bug", message: "Notifications arrive twice on Android.", status: "new", tags: ["mobile", "notifications"], rating: 3 },
	{ type: "bug", message: "Typo on the pricing page: 'anually' should be 'annually'.", status: "done", rating: 4 },
	{
		type: "bug",
		message: "Week view shows the wrong start day for users in Australia (should be Monday).",
		status: "planned",
		tags: ["i18n"],
		rating: 2,
	},
	{
		type: "bug",
		message: "After logging out and in again my filters are reset.",
		status: "closed",
		rating: 3,
		note: "Works as intended: filters are per session. Maybe revisit later.",
	},
	{ type: "bug", message: "The app crashed when I pasted an image into a task description.", status: "new", rating: 1 },
	{
		type: "praise",
		message: "Honestly the best planner I've used. The animations make me happy every morning!",
		rating: 5,
		status: "closed",
	},
	{ type: "praise", message: "Your support team fixed my sync issue in 10 minutes. You rock!", rating: 5, status: "closed" },
	{ type: "praise", message: "Switched from Notion and never looked back. So fast.", rating: 5 },
	{ type: "praise", message: "Love the new onboarding, my whole team got set up in minutes.", rating: 4 },
	{ type: "question", message: "Is there an API I can use to create tasks from Zapier?", status: "reviewing", tags: ["integrations"] },
	{ type: "question", message: "Do you offer discounts for non-profits?", status: "done", note: "Replied by email: 50% off." },
	{ type: "question", message: "How do I move a task to a different project?", status: "new" },
	{ type: "other", message: "Your logo looks a bit like a cat. I like it.", rating: 4, status: "closed" },
];

const RECIPES: Seed[] = [
	{
		type: "idea",
		title: "Shopping list from recipe",
		message: "One tap to add all ingredients of a recipe to my shopping list.",
		status: "done",
		public: true,
		votes: 41,
		reply: "Live in the latest update. Enjoy!",
	},
	{
		type: "idea",
		title: "Metric / imperial toggle",
		message: "Please let me switch between cups and grams.",
		status: "in_progress",
		public: true,
		votes: 33,
		tags: ["i18n"],
	},
	{
		type: "idea",
		title: "Meal planner",
		message: "A weekly meal planner that suggests recipes based on what's in my fridge.",
		status: "planned",
		public: true,
		votes: 27,
	},
	{
		type: "idea",
		title: "Vegan filter",
		message: "Filter recipes by dietary needs: vegan, gluten-free, nut-free.",
		status: "reviewing",
		public: true,
		votes: 19,
		tags: ["filters"],
	},
	{ type: "idea", message: "Hands-free cooking mode that reads steps out loud.", status: "new", public: true, votes: 12 },
	{ type: "bug", message: "Timer stops when the screen locks.", status: "in_progress", rating: 2, tags: ["timer"] },
	{
		type: "bug",
		message: "Search for 'crème brûlée' returns nothing, but 'creme brulee' works.",
		status: "new",
		rating: 3,
		tags: ["search"],
	},
	{ type: "praise", message: "My kids now ask to cook with me thanks to the step-by-step photos 🥰", rating: 5 },
	{ type: "praise", message: "Gorgeous app. The colors make me hungry.", rating: 5 },
	{ type: "question", message: "Can I import recipes from a website URL?", status: "reviewing" },
];

const DOCS: Seed[] = [
	{ type: "bug", message: "The code sample in 'Getting started' is missing an import.", status: "done", rating: 3, tags: ["docs"] },
	{ type: "idea", message: "Add a search bar to the docs.", status: "planned", rating: 4 },
	{ type: "question", message: "Is there a changelog page?", status: "new" },
];

const NAMES = ["Ava", "Noah", "Mia", "Leo", "Zoe", "Kai", "Ivy", "Theo", "Luna", "Omar", "Nina", "Jonas", "Priya", "Mateo", "Elif", "Sora"];
const UAS = [
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
	"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
	"Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
	"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36",
];

const FILLER: Record<FeedbackType, string[]> = {
	idea: [
		"Would be great to have more templates.",
		"Please add a way to archive old items.",
		"Bulk editing would save me so much time.",
		"Can we get a compact view?",
		"Let me reorder the sidebar.",
	],
	bug: [
		"The page flickers when I scroll quickly.",
		"Avatar doesn't update after changing it.",
		"Got a blank screen after login once.",
		"Tooltip covers the save button on small screens.",
	],
	praise: ["Super smooth experience!", "Love it, keep going 💜", "Clean, fast, delightful.", "This made my week easier."],
	question: ["Is there a student plan?", "Where can I find my invoices?", "Does it work offline?"],
	other: ["Just saying hi 👋", "Found you via Product Hunt, nice launch!"],
};

async function insertAll(projectId: string, domain: string, seeds: Seed[], fillerCount: number, userIds: string[]) {
	const db = getDb();
	const all: Seed[] = [...seeds];
	for (let i = 0; i < fillerCount; i++) {
		const type = pick(["idea", "idea", "bug", "bug", "praise", "question", "other"] as const);
		all.push({
			type,
			message: pick(FILLER[type]),
			status: pick(["new", "new", "new", "reviewing", "closed", "done"] as const),
			rating: chance(0.6) ? (type === "praise" ? pick([4, 5]) : type === "bug" ? pick([1, 2, 3]) : pick([2, 3, 4, 5])) : undefined,
		});
	}
	// Oldest first so numbers grow over time.
	const dated = all
		.map((seed) => ({ seed, at: new Date(Date.now() - Math.floor(rand() * 60 * 86_400_000) - 60_000) }))
		.sort((a, b) => a.at.getTime() - b.at.getTime());

	let number = 0;
	for (const { seed, at } of dated) {
		const id = newId();
		const name = chance(0.75) ? pick(NAMES) : null;
		const email = name && chance(0.8) ? `${name.toLowerCase()}@${pick(["gmail.com", "proton.me", "acme.io", "hey.com"])}` : null;
		await db.insert(feedback).values({
			id,
			projectId,
			number: ++number,
			type: seed.type,
			status: seed.status ?? "new",
			source: seed.public && chance(0.5) ? "board" : pick(["widget", "widget", "widget", "form", "api"] as const),
			title: seed.title ?? null,
			message: seed.message,
			rating: seed.rating ?? null,
			authorName: name,
			authorEmail: email,
			pageUrl: `https://${domain}${pick(["/", "/app", "/app/settings", "/pricing", "/app/week", "/blog/launch"])}`,
			userAgent: pick(UAS),
			metadata: chance(0.5) ? { plan: pick(["free", "pro", "team"]), appVersion: pick(["2.3.0", "2.3.1", "2.4.0"]) } : {},
			tags: seed.tags ?? [],
			isPublic: seed.public ?? false,
			publicReply: seed.reply ?? null,
			voteCount: seed.votes ?? 0,
			createdAt: at,
			updatedAt: at,
		});
		if (seed.votes) {
			await db.insert(votes).values(Array.from({ length: seed.votes }, (_, i) => ({ feedbackId: id, voterId: `seed-voter-${i}` })));
		}
		if (seed.note) {
			await db
				.insert(notes)
				.values({ id: newId(), feedbackId: id, userId: pick(userIds), body: seed.note, createdAt: new Date(at.getTime() + 3_600_000) });
		}
	}
	await db.update(projects).set({ feedbackSeq: number }).where(sql`${projects.id} = ${projectId}`);
	return number;
}

async function main() {
	const db = getDb();
	if (reset) {
		if (process.env.NODE_ENV === "production") throw new Error("Refusing to --reset in production.");
		await db.execute(
			sql`truncate table users, sessions, workspaces, workspace_members, invites, projects, feedback, notes, votes, rate_limits restart identity cascade`,
		);
		console.log("🧹 Database wiped");
	} else {
		const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from users`);
		if (n > 0) {
			console.error("This database already has users. Run `pnpm db:seed --reset` to wipe it and start over.");
			process.exitCode = 1;
			return;
		}
	}

	const { user, workspace } = await setupInstance({
		name: "Olivia Owl",
		email: "demo@hootbox.dev",
		password: DEMO_PASSWORD,
		workspaceName: "Owl Labs",
	});
	const owner = { userId: user.id, role: "owner" as const };
	const { token } = await createInvite(owner, workspace.id, { role: "member" });
	const sam = await acceptInvite({ token, name: "Sam Sparrow", email: "sam@hootbox.dev", password: DEMO_PASSWORD });
	await createInvite(owner, workspace.id, { role: "admin", note: "For Robin (design)" });

	const pixel = await createProject(owner, workspace.id, {
		name: "Pixel Planner",
		description: "Tell us how to make planning your week even more delightful ✨",
		color: "violet",
	});
	await updateProject(owner, pixel.id, { autoPublish: false, webhookUrl: null });
	const recipes = await createProject(owner, workspace.id, {
		name: "Sunny Recipes",
		description: "Ideas, bugs and love letters for our cooking app 🍳",
		color: "sunny",
	});
	const docs = await createProject(owner, workspace.id, {
		name: "Docs Site",
		description: "Help us improve the documentation.",
		color: "sky",
	});
	await updateProject(owner, docs.id, { boardEnabled: false });

	const ids = [user.id, sam.id];
	const counts = [
		await insertAll(pixel.id, "pixelplanner.app", PIXEL, 45, ids),
		await insertAll(recipes.id, "sunnyrecipes.com", RECIPES, 18, ids),
		await insertAll(docs.id, "docs.example.com", DOCS, 2, ids),
	];

	console.log(`
🦉 Seeded ${counts.reduce((a, b) => a + b, 0)} pieces of feedback across 3 projects.

   Log in:   demo@hootbox.dev / ${DEMO_PASSWORD}   (owner)
             sam@hootbox.dev  / ${DEMO_PASSWORD}   (member)

   Boards:   /b/${pixel.slug}   /b/${recipes.slug}
   Form:     /f/${pixel.slug}
   Widget:   project key ${pixel.publicKey}
`);
}

main()
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(() => closeDb());
