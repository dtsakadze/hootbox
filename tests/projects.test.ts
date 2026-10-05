import { describe, expect, it } from "vitest";
import { registerExtensions } from "#/server/extensions";
import { AppError } from "#/server/lib/errors";
import {
	createProject,
	deleteProject,
	getProjectByPublicKey,
	getProjectBySlug,
	getProjectForUser,
	listProjects,
	rotateProjectSecret,
	slugify,
	updateProject,
} from "#/server/services/projects";
import { acceptInvite, createInvite } from "#/server/services/workspaces";
import { seedOwner, seedProject } from "./helpers";

describe("slugify", () => {
	it("makes friendly slugs", () => {
		expect(slugify("Héllo, World!")).toBe("hello-world");
		expect(slugify("  --My   App-- ")).toBe("my-app");
		expect(slugify("🦉")).toBe("project");
		expect(slugify("x").length).toBeGreaterThanOrEqual(2);
	});
});

describe("projects", () => {
	it("creates projects with unique slugs and secret keys", async () => {
		const { actor, workspace } = await seedOwner();
		const a = await createProject(actor, workspace.id, { name: "My App", description: "", color: "mint" });
		const b = await createProject(actor, workspace.id, { name: "My App", description: "", color: "mint" });
		expect(a.slug).toBe("my-app");
		expect(b.slug).toBe("my-app-2");
		expect(a.publicKey).toMatch(/^pk_/);
		expect(a.publicKey).not.toBe(b.publicKey);
		expect(a.webhookSecret).toMatch(/^whsec_/);
		expect((await getProjectBySlug("MY-APP"))?.id).toBe(a.id);
		expect((await getProjectByPublicKey(b.publicKey))?.id).toBe(b.id);
	});

	it("avoids reserved slugs", async () => {
		const { actor, workspace } = await seedOwner();
		const p = await createProject(actor, workspace.id, { name: "App", description: "", color: "mint" });
		expect(p.slug).toBe("app-2");
		await expect(updateProject(actor, p.id, { slug: "api" })).rejects.toThrow(/taken/);
	});

	it("lists projects with new-feedback counts", async () => {
		const { project, workspace } = await seedProject("Counted");
		const list = await listProjects(workspace.id);
		expect(list).toEqual([expect.objectContaining({ id: project.id, newCount: 0 })]);
	});

	it("hides projects from non-members", async () => {
		const { project, user } = await seedProject();
		await expect(getProjectForUser(user.id, project.id)).resolves.toMatchObject({ role: "owner" });
		await expect(getProjectForUser("someone-else", project.id)).rejects.toThrow(/not found/i);
	});

	it("lets only admins change settings", async () => {
		const { project, actor, workspace } = await seedProject();
		const { token } = await createInvite(actor, workspace.id, { role: "member" });
		const m = await acceptInvite({ token, name: "M", email: "m@example.com", password: "password123" });
		const member = { userId: m.id, role: "member" as const };
		await expect(updateProject(member, project.id, { name: "Hacked" })).rejects.toBeInstanceOf(AppError);
		await expect(deleteProject(member, project.id)).rejects.toBeInstanceOf(AppError);
		await expect(createProject(member, workspace.id, { name: "Nope", description: "", color: "mint" })).rejects.toBeInstanceOf(AppError);

		const updated = await updateProject(actor, project.id, { name: "Renamed", slug: "renamed", allowedOrigins: ["https://a.com"] });
		expect(updated).toMatchObject({ name: "Renamed", slug: "renamed", allowedOrigins: ["https://a.com"] });
	});

	it("rotates keys", async () => {
		const { project, actor } = await seedProject();
		const rotated = await rotateProjectSecret(actor, project.id, "publicKey");
		expect(rotated.publicKey).not.toBe(project.publicKey);
		expect(await getProjectByPublicKey(project.publicKey)).toBeNull();
	});

	it("respects the beforeProjectCreate extension (e.g. plan limits)", async () => {
		const { actor, workspace } = await seedOwner();
		registerExtensions({
			beforeProjectCreate: async () => {
				throw new AppError("FORBIDDEN", "Upgrade to add more projects");
			},
		});
		await expect(createProject(actor, workspace.id, { name: "X", description: "", color: "mint" })).rejects.toThrow("Upgrade");
	});
});
