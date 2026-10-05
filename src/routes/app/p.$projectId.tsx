import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { Owl } from "#/components/Owl";
import { colorMeta } from "#/lib/meta";
import { getProjectFn } from "#/server/functions/projects";

export const Route = createFileRoute("/app/p/$projectId")({
	loader: ({ params }) => getProjectFn({ data: { projectId: params.projectId } }),
	head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.project.name ?? "Project"} · Hootbox` }] }),
	component: ProjectLayout,
});

function ProjectLayout() {
	const { project, canManage } = Route.useLoaderData();
	const params = { projectId: project.id };
	const tabs = [
		{ to: "/app/p/$projectId", label: "Inbox", exact: true },
		{ to: "/app/p/$projectId/insights", label: "Insights" },
		{ to: "/app/p/$projectId/install", label: "Share & install" },
		...(canManage ? [{ to: "/app/p/$projectId/settings", label: "Settings" }] : []),
	] as const;

	return (
		<>
			<div className="mb-6 flex flex-wrap items-center gap-4">
				<div
					className={`grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-ink shadow-pop-sm ${colorMeta(project.color).soft}`}
				>
					<Owl size={42} color={project.color} />
				</div>
				<div className="min-w-0 flex-1">
					<h1 className="truncate text-3xl font-extrabold">{project.name}</h1>
					{project.boardEnabled ? (
						<a
							href={`/b/${project.slug}`}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1 text-sm font-bold text-ink-soft hover:text-ink"
						>
							/b/{project.slug} <ExternalLink className="size-3.5" />
						</a>
					) : (
						<p className="text-sm text-ink-soft">Public board is off</p>
					)}
				</div>
			</div>
			<nav className="mb-6 flex gap-1 overflow-x-auto rounded-full border-2 border-ink bg-paper p-1 shadow-pop-sm w-fit max-w-full">
				{tabs.map((t) => (
					<Link key={t.to} to={t.to} params={params} className="tab" activeOptions={{ exact: "exact" in t, includeSearch: false }}>
						{t.label}
					</Link>
				))}
			</nav>
			<Outlet />
		</>
	);
}
