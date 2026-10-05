import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "#/server/db/client";
import { sessions } from "#/server/db/schema";
import { sha256 } from "#/server/lib/crypto";
import {
	authenticate,
	changePassword,
	createSession,
	deleteSession,
	isSetupComplete,
	setupInstance,
	updateProfile,
	validateSession,
} from "#/server/services/auth";
import { getMembership } from "#/server/services/workspaces";
import { seedOwner } from "./helpers";

describe("setup", () => {
	it("creates the owner and workspace exactly once", async () => {
		expect(await isSetupComplete()).toBe(false);
		const { user, workspace } = await seedOwner();
		expect(await isSetupComplete()).toBe(true);
		expect(await getMembership(user.id)).toMatchObject({ role: "owner", workspace: { id: workspace.id } });
		await expect(setupInstance({ name: "Eve", email: "eve@example.com", password: "password123", workspaceName: "Evil" })).rejects.toThrow(
			/already set up/,
		);
	});

	it("survives racing setups", async () => {
		const attempt = (i: number) =>
			setupInstance({ name: `U${i}`, email: `u${i}@example.com`, password: "password123", workspaceName: "W" });
		const results = await Promise.allSettled([attempt(1), attempt(2), attempt(3)]);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
	});
});

describe("authentication", () => {
	it("accepts the right password, case-insensitive email", async () => {
		const { password } = await seedOwner();
		await expect(authenticate("OWNER@example.com", password)).resolves.toMatchObject({ email: "owner@example.com" });
	});

	it("rejects wrong password and unknown users with the same message", async () => {
		await seedOwner();
		await expect(authenticate("owner@example.com", "nope")).rejects.toThrow("don't match");
		await expect(authenticate("ghost@example.com", "nope")).rejects.toThrow("don't match");
	});
});

describe("sessions", () => {
	it("validates, and stores only a hash of the token", async () => {
		const { user } = await seedOwner();
		const { token } = await createSession(user.id);
		const [row] = await getDb().select().from(sessions);
		expect(row.id).toBe(await sha256(token));
		expect(row.id).not.toBe(token);
		expect((await validateSession(token))?.user.id).toBe(user.id);
		expect(await validateSession("garbage")).toBeNull();
	});

	it("rejects expired sessions and renews ageing ones", async () => {
		const { user } = await seedOwner();
		const { token } = await createSession(user.id);
		const id = await sha256(token);

		await getDb()
			.update(sessions)
			.set({ expiresAt: new Date(Date.now() + 86_400_000) })
			.where(eq(sessions.id, id));
		const renewed = await validateSession(token);
		expect(renewed?.renewed).toBe(true);
		expect(renewed?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 20 * 86_400_000);

		await getDb()
			.update(sessions)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(sessions.id, id));
		expect(await validateSession(token)).toBeNull();
	});

	it("logs out", async () => {
		const { user } = await seedOwner();
		const { token } = await createSession(user.id);
		await deleteSession(token);
		expect(await validateSession(token)).toBeNull();
	});
});

describe("account", () => {
	it("changes password and revokes other sessions", async () => {
		const { user, password } = await seedOwner();
		const keep = await createSession(user.id);
		const other = await createSession(user.id);
		await expect(changePassword(user.id, "wrong", "new-password-1")).rejects.toThrow(/incorrect/);
		await changePassword(user.id, password, "new-password-1", keep.token);
		expect(await validateSession(keep.token)).not.toBeNull();
		expect(await validateSession(other.token)).toBeNull();
		await expect(authenticate(user.email, "new-password-1")).resolves.toBeTruthy();
	});

	it("prevents taking another user's email", async () => {
		const { user } = await seedOwner();
		const { acceptInvite, createInvite } = await import("#/server/services/workspaces");
		const ws = (await getMembership(user.id))!.workspace;
		const { token } = await createInvite({ userId: user.id, role: "owner" }, ws.id, { role: "member" });
		const bob = await acceptInvite({ token, name: "Bob", email: "bob@example.com", password: "password123" });
		await expect(updateProfile(bob.id, { name: "Bob", email: "owner@example.com" })).rejects.toThrow(/already used/);
		await expect(updateProfile(bob.id, { name: "Bobby", email: "bobby@example.com" })).resolves.toMatchObject({ name: "Bobby" });
	});
});
