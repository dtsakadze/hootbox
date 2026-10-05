import { describe, expect, it } from "vitest";
import { fromBase64Url, hmacSha256Hex, randomToken, sha256, toBase64Url } from "#/server/lib/crypto";
import { hashPassword, verifyPassword } from "#/server/lib/password";

describe("crypto helpers", () => {
	it("round-trips base64url", () => {
		const bytes = new Uint8Array([0, 1, 250, 255, 62, 63]);
		expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
		expect(toBase64Url(bytes)).not.toMatch(/[+/=]/);
	});

	it("creates unique url-safe tokens", () => {
		const a = randomToken();
		expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(randomToken()).not.toBe(a);
	});

	it("hashes deterministically", async () => {
		expect(await sha256("hello")).toBe(await sha256("hello"));
		expect(await sha256("hello")).not.toBe(await sha256("hello!"));
	});

	it("computes HMAC-SHA256 like the spec", async () => {
		// RFC 4231 test case 2
		expect(await hmacSha256Hex("Jefe", "what do ya want for nothing?")).toBe(
			"5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
		);
	});
});

describe("passwords", () => {
	it("verifies the right password only", async () => {
		const hash = await hashPassword("s3cret-password");
		expect(hash).toMatch(/^pbkdf2_sha256\$1000\$/);
		expect(await verifyPassword("s3cret-password", hash)).toBe(true);
		expect(await verifyPassword("wrong-password", hash)).toBe(false);
	});

	it("salts every hash", async () => {
		expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
	});

	it("keeps verifying hashes made with other iteration counts", async () => {
		const hash = await hashPassword("portable", 2000);
		expect(await verifyPassword("portable", hash)).toBe(true);
	});

	it("rejects malformed hashes", async () => {
		expect(await verifyPassword("x", "")).toBe(false);
		expect(await verifyPassword("x", "md5$1$abc$def")).toBe(false);
		expect(await verifyPassword("x", "pbkdf2_sha256$NaN$abc$def")).toBe(false);
	});
});
