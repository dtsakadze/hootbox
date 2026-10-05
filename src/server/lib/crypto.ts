const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array {
	const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function randomBytes(length: number): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(length));
}

/** URL-safe random token with `bytes` bytes of entropy. */
export function randomToken(bytes = 32): string {
	return toBase64Url(randomBytes(bytes));
}

export function newId(): string {
	return crypto.randomUUID();
}

export async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
	return toBase64Url(new Uint8Array(digest));
}

export async function hmacSha256Hex(secret: string, payload: string) {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
	return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}
