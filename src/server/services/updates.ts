const RELEASES_URL = "https://api.github.com/repos/dtsakadze/hootbox/releases/latest";
const CACHE_MS = 6 * 60 * 60 * 1000;

export type LatestRelease = { version: string; url: string };

/** Compares "1.2.3" style versions (a leading "v" is ignored). Returns -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
	const parse = (v: string) =>
		v
			.replace(/^v/, "")
			.split("-")[0]
			.split(".")
			.map((n) => Number.parseInt(n, 10) || 0);
	const [x, y] = [parse(a), parse(b)];
	for (let i = 0; i < Math.max(x.length, y.length); i++) {
		const d = (x[i] ?? 0) - (y[i] ?? 0);
		if (d !== 0) return d > 0 ? 1 : -1;
	}
	return 0;
}

export async function fetchLatestRelease(url = RELEASES_URL): Promise<LatestRelease | null> {
	try {
		const res = await fetch(url, {
			headers: { accept: "application/vnd.github+json", "user-agent": "hootbox-update-check" },
			signal: AbortSignal.timeout(3000),
		});
		if (!res.ok) return null;
		const data = (await res.json()) as { tag_name?: unknown; html_url?: unknown };
		if (typeof data.tag_name !== "string" || typeof data.html_url !== "string") return null;
		if (!/^https:\/\/github\.com\//.test(data.html_url)) return null;
		return { version: data.tag_name.replace(/^v/, ""), url: data.html_url };
	} catch {
		return null;
	}
}

let cache: { at: number; value: LatestRelease | null } | undefined;

/**
 * Newest published release, if it's newer than the running version. Checked at
 * most every 6 hours per server instance. Disable with UPDATE_CHECK=false.
 */
export async function availableUpdate(current: string): Promise<LatestRelease | null> {
	if (process.env.UPDATE_CHECK === "false" || current === "dev") return null;
	if (!cache || Date.now() - cache.at > CACHE_MS) {
		cache = { at: Date.now(), value: await fetchLatestRelease() };
	}
	const latest = cache.value;
	return latest && compareVersions(latest.version, current) > 0 ? latest : null;
}
