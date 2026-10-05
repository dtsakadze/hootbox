import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ColorPicker } from "#/components/ColorPicker";
import { Owl } from "#/components/Owl";
import { Button, ErrorNote, Field, PageHeader } from "#/components/ui";
import type { ProjectColor } from "#/lib/constants";
import { useFormAction } from "#/lib/use-form";
import { createProjectFn } from "#/server/functions/projects";

export const Route = createFileRoute("/app/new")({
	head: () => ({ meta: [{ title: "New project · Hootbox" }] }),
	component: NewProject,
});

function NewProject() {
	const router = useRouter();
	const [color, setColor] = useState<ProjectColor>("violet");
	const form = useFormAction(async (data: { name: string; description: string; color: ProjectColor }) => {
		const { id } = await createProjectFn({ data });
		await router.invalidate();
		await router.navigate({ to: "/app/p/$projectId/install", params: { projectId: id } });
	});

	return (
		<div className="mx-auto max-w-xl">
			<PageHeader title="New project" subtitle="One project per product, app or website." />
			<form onSubmit={form.onSubmit} className="card relative space-y-5 p-7">
				<Owl size={64} color={color} mood="happy" className="absolute -top-10 right-6" />
				<ErrorNote>{form.error}</ErrorNote>
				<Field label="Name">
					{(id) => <input id={id} name="name" className="input" required maxLength={60} placeholder="My awesome app" />}
				</Field>
				<Field label="Short description" hint="Shown on your public board.">
					{(id) => (
						<textarea
							id={id}
							name="description"
							className="input min-h-20"
							maxLength={300}
							placeholder="Tell us how we can make things better!"
						/>
					)}
				</Field>
				<div>
					<span className="label">Color</span>
					<ColorPicker name="color" value={color} onChange={setColor} />
				</div>
				<Button type="submit" loading={form.pending} className="w-full">
					Create project
				</Button>
			</form>
		</div>
	);
}
