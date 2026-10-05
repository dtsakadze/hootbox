import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { availableUpdate, compareVersions, fetchLatestRelease } from "#/server/services/updates";

let body = "";
let status = 200;
const server = createServer((_req, res) => res.writeHead(status, { "content-type": "application/json" }).end(body));
let url = "";

beforeAll(async () => {
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/latest`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("compareVersions", () => {
	it("orders semver-ish versions", () => {
		expect(compareVersions("0.2.0", "0.1.9")).toBe(1);
		expect(compareVersions("v1.0.0", "1.0.0")).toBe(0);
		expect(compareVersions("0.10.0", "0.9.0")).toBe(1);
		expect(compareVersions("1.0", "1.0.1")).toBe(-1);
		expect(compareVersions("1.2.0-beta.1", "1.2.0")).toBe(0);
	});
});

describe("fetchLatestRelease", () => {
	it("parses a GitHub release", async () => {
		status = 200;
		body = JSON.stringify({ tag_name: "v0.3.0", html_url: "https://github.com/dtsakadze/hootbox/releases/tag/v0.3.0" });
		expect(await fetchLatestRelease(url)).toEqual({ version: "0.3.0", url: "https://github.com/dtsakadze/hootbox/releases/tag/v0.3.0" });
	});

	it("accepts component-prefixed tags", async () => {
		status = 200;
		body = JSON.stringify({ tag_name: "hootbox-v0.1.0", html_url: "https://github.com/dtsakadze/hootbox/releases/tag/hootbox-v0.1.0" });
		expect((await fetchLatestRelease(url))?.version).toBe("0.1.0");
	});

	it("rejects bad or unexpected responses", async () => {
		body = JSON.stringify({ tag_name: "v9.9.9", html_url: "https://evil.example/x" });
		expect(await fetchLatestRelease(url)).toBeNull();
		body = "not json";
		expect(await fetchLatestRelease(url)).toBeNull();
		status = 404;
		body = "{}";
		expect(await fetchLatestRelease(url)).toBeNull();
		expect(await fetchLatestRelease("http://127.0.0.1:1/nothing")).toBeNull();
	});
});

describe("availableUpdate", () => {
	it("can be disabled and skips dev builds", async () => {
		process.env.UPDATE_CHECK = "false";
		expect(await availableUpdate("0.1.0")).toBeNull();
		delete process.env.UPDATE_CHECK;
		expect(await availableUpdate("dev")).toBeNull();
	});
});
