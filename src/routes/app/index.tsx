import { createFileRoute, getRouteApi, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";
import { Owl } from "#/components/Owl";
import { EmptyState, PageHeader } from "#/components/ui";
import { colorMeta } from "#/lib/meta";
import { listProjectsFn } from "#/server/functions/projects";

const appRoute = getRouteApi("/app");

export const Route = createFileRoute("/app/")({
	loader: async () => {
		const projects = await listProjectsFn();
		if (projects.length === 1) throw redirect({ to: "/app/p/$projectId", params: { projectId: projects[0].id } });
		return projects;
	},
	component: Projects,
});

function Projects() {
	const projects = Route.useLoaderData();
	const { role, user } = appRoute.useRouteContext();
	const canCreate = role !== "member";

	if (projects.length === 0) {
		return (
			<div className="card mt-6">
				<EmptyState
					title={`Hi ${user.name.split(" ")[0]}! Let's start collecting feedback`}
					mood="happy"
					action={
						canCreate ? (
							<Link to="/app/new" className="btn btn-primary">
								<Plus className="size-4" /> Create your first project
							</Link>
						) : undefined
					}
				>
					{canCreate
						? "A project is one product or website you collect feedback for. It gets its own widget, public board and inbox."
						: "There are no projects yet. Ask an admin to create one."}
				</EmptyState>
			</div>
		);
	}

	return (
		<>
			<PageHeader
				title="Your projects"
				subtitle="Pick a project to see its feedback."
				actions={
					canCreate && (
						<Link to="/app/new" className="btn btn-primary">
							<Plus className="size-4" /> New project
						</Link>
					)
				}
			/>
			<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{projects.map((p, i) => (
					<Link
						key={p.id}
						to="/app/p/$projectId"
						params={{ projectId: p.id }}
						className="card group p-6 transition-transform hover:-translate-y-1 animate-pop-in"
						style={{ animationDelay: `${i * 50}ms` }}
					>
						<div className="flex items-start justify-between">
							<div className={`grid size-14 place-items-center rounded-2xl border-2 border-ink ${colorMeta(p.color).soft}`}>
								<Owl size={40} color={p.color} mood={p.newCount > 0 ? "curious" : "sleepy"} />
							</div>
							{p.newCount > 0 && <span className="chip bg-sunny">{p.newCount} new</span>}
						</div>
						<h2 className="mt-4 text-xl font-extrabold">{p.name}</h2>
						<p className="mt-1 line-clamp-2 text-sm text-ink-soft">{p.description || `/${p.slug}`}</p>
						<span className="mt-4 inline-flex items-center gap-1 text-sm font-extrabold group-hover:gap-2 transition-all">
							Open inbox <ArrowRight className="size-4" />
						</span>
					</Link>
				))}
			</div>
		</>
	);
}
