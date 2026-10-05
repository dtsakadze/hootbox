import { fromBase64Url, randomBytes, timingSafeEqual, toBase64Url } from "./crypto";

// PBKDF2 via WebCrypto runs everywhere (Node, Bun, Vercel, Cloudflare Workers).
// Cloudflare Workers caps PBKDF2 at 100k iterations, so we use that there and the
// OWASP-recommended 600k elsewhere. The count is stored in the hash, so hashes
// created on one runtime keep verifying on another.
const isWorkerd = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
const DEFAULT_ITERATIONS = isWorkerd ? 100_000 : 600_000;
const ALGO = "pbkdf2_sha256";

async function derive(password: string, salt: Uint8Array, iterations: number) {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
	const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
	return new Uint8Array(bits);
}

export async function hashPassword(
	password: string,
	iterations = Number(process.env.PASSWORD_ITERATIONS) || DEFAULT_ITERATIONS,
): Promise<string> {
	const salt = randomBytes(16);
	const hash = await derive(password, salt, iterations);
	return `${ALGO}$${iterations}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [algo, iter, salt, hash] = stored.split("$");
	const iterations = Number(iter);
	if (algo !== ALGO || !salt || !hash || !Number.isInteger(iterations) || iterations < 1) {
		return false;
	}
	const candidate = await derive(password, fromBase64Url(salt), iterations);
	return timingSafeEqual(candidate, fromBase64Url(hash));
}
