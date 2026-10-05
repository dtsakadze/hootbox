import { setupInstance } from "#/server/services/auth";
import { createProject } from "#/server/services/projects";

let counter = 0;

export async function seedOwner(overrides: Partial<{ email: string; password: string }> = {}) {
	const password = overrides.password ?? "correct-horse-battery";
	const { user, workspace } = await setupInstance({
		name: "Olive Owner",
		email: overrides.email ?? "owner@example.com",
		password,
		workspaceName: "Acme",
	});
	return { user, workspace, password, actor: { userId: user.id, role: "owner" as const } };
}

export async function seedProject(name = `Project ${++counter}`) {
	const owner = await seedOwner();
	const project = await createProject(owner.actor, owner.workspace.id, { name, description: "", color: "violet" });
	return { ...owner, project };
}
