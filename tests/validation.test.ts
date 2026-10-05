import { describe, expect, it } from "vitest";
import {
	feedbackFiltersSchema,
	slugSchema,
	submitFeedbackSchema,
	tagSchema,
	updateProjectSchema,
} from "#/lib/validation";

describe("submitFeedbackSchema", () => {
	it("normalises optional fields", () => {
		const out = submitFeedbackSchema.parse({ message: "  Love it  ", email: " Me@Example.COM ", name: "" });
		expect(out).toMatchObject({ type: "idea", message: "Love it", email: "me@example.com", name: null, title: null });
	});

	it("rejects bad emails, tiny and huge messages", () => {
		expect(submitFeedbackSchema.safeParse({ message: "ok ok", email: "nope" }).success).toBe(false);
		expect(submitFeedbackSchema.safeParse({ message: "x" }).success).toBe(false);
		expect(submitFeedbackSchema.safeParse({ message: "x".repeat(5001) }).success).toBe(false);
	});

	it("limits metadata", () => {
		const many = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]));
		expect(submitFeedbackSchema.safeParse({ message: "hello", metadata: many }).success).toBe(false);
		expect(submitFeedbackSchema.safeParse({ message: "hello", metadata: { nested: { a: 1 } } }).success).toBe(false);
		expect(submitFeedbackSchema.parse({ message: "hello", metadata: { plan: "pro", seats: 3 } }).metadata).toEqual({ plan: "pro", seats: 3 });
	});

	it("only accepts ratings 1–5", () => {
		expect(submitFeedbackSchema.safeParse({ message: "hello", rating: 6 }).success).toBe(false);
		expect(submitFeedbackSchema.safeParse({ message: "hello", rating: 5 }).success).toBe(true);
	});
});

describe("other schemas", () => {
	it("validates slugs", () => {
		expect(slugSchema.parse("My-Board")).toBe("my-board");
		expect(slugSchema.safeParse("no spaces").success).toBe(false);
		expect(slugSchema.safeParse("-dash").success).toBe(false);
	});

	it("normalises tags", () => {
		expect(tagSchema.parse("  Dark Mode ")).toBe("dark mode");
		expect(tagSchema.safeParse("<script>").success).toBe(false);
	});

	it("turns allowed origins into bare origins and rejects non-http", () => {
		const out = updateProjectSchema.parse({ allowedOrigins: ["https://Example.com/some/path?x=1"] });
		expect(out.allowedOrigins).toEqual(["https://example.com"]);
		expect(updateProjectSchema.safeParse({ allowedOrigins: ["javascript:alert(1)"] }).success).toBe(false);
		expect(updateProjectSchema.safeParse({ webhookUrl: "ftp://x.y" }).success).toBe(false);
		expect(updateProjectSchema.parse({ webhookUrl: "" }).webhookUrl).toBeNull();
	});

	it("falls back to safe filter defaults", () => {
		expect(feedbackFiltersSchema.parse({ status: "bogus", sort: "evil", page: -3 })).toMatchObject({ status: "open", sort: "newest", page: 1 });
	});
});
