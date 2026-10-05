import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { ArrowUpCircle, LogOut, Menu, Plus, UserRound, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "#/components/Owl";
import { colorMeta, initials } from "#/lib/meta";
import { getSessionFn, logoutFn } from "#/server/functions/auth";
import { listProjectsFn } from "#/server/functions/projects";
import { getVersionFn } from "#/server/functions/team";

export const Route = createFileRoute("/app")({
	beforeLoad: async ({ location }) => {
		const session = await getSessionFn();
		if (!session.user || !session.workspace || !session.role) {
			throw redirect({ to: "/login", search: { next: location.href } });
		}
		return { user: session.user, workspace: session.workspace, role: session.role };
	},
	loader: () => listProjectsFn(),
	head: () => ({ meta: [{ title: "Hootbox" }, { name: "robots", content: "noindex" }] }),
	component: AppLayout,
});

function AppLayout() {
	const [open, setOpen] = useState(false);
	return (
		<div className="min-h-dvh lg:grid lg:grid-cols-[272px_1fr]">
			<header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b-2 border-ink bg-cream/95 backdrop-blur px-4 py-3">
				<Link to="/app">
					<Logo />
				</Link>
				<button type="button" className="btn btn-ghost btn-icon" onClick={() => setOpen(true)} aria-label="Open menu">
					<Menu className="size-5" />
				</button>
			</header>
			{open && (
				<button type="button" aria-label="Close menu" className="lg:hidden fixed inset-0 z-40 bg-ink/30" onClick={() => setOpen(false)} />
			)}
			<aside
				className={`fixed inset-y-0 left-0 z-50 w-[272px] transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
			>
				<Sidebar onNavigate={() => setOpen(false)} />
			</aside>
			<main className="min-w-0 px-4 py-6 sm:px-8 lg:py-10">
				<div className="mx-auto max-w-6xl">
					<Outlet />
				</div>
			</main>
		</div>
	);
}

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
	const projects = Route.useLoaderData();
	const { user, workspace, role } = Route.useRouteContext();
	const router = useRouter();

	async function logout() {
		await logoutFn();
		await router.navigate({ to: "/login" });
	}

	return (
		<nav className="flex h-full flex-col gap-6 border-r-2 border-ink bg-paper p-5 overflow-y-auto">
			<div className="flex items-center justify-between">
				<Link to="/app" onClick={onNavigate}>
					<Logo />
				</Link>
				<button type="button" className="lg:hidden btn btn-quiet btn-icon" onClick={onNavigate} aria-label="Close menu">
					<X className="size-5" />
				</button>
			</div>

			<div className="rounded-2xl bg-fog px-3 py-2">
				<p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-faint">Workspace</p>
				<p className="font-extrabold truncate">{workspace.name}</p>
			</div>

			<div className="flex-1">
				<p className="mb-2 px-2 text-[11px] font-extrabold uppercase tracking-wider text-ink-faint">Projects</p>
				<ul className="space-y-1">
					{projects.map((p) => (
						<li key={p.id}>
							<Link
								to="/app/p/$projectId"
								params={{ projectId: p.id }}
								onClick={onNavigate}
								className="group flex items-center gap-2.5 rounded-2xl px-2.5 py-2 font-bold hover:bg-fog"
								activeProps={{ className: "bg-fog" }}
								activeOptions={{ exact: false }}
							>
								<span className={`size-3.5 shrink-0 rounded-full border-2 border-ink ${colorMeta(p.color).bg}`} />
								<span className="truncate flex-1">{p.name}</span>
								{p.newCount > 0 && (
									<span className="rounded-full border-2 border-ink bg-sunny px-1.5 text-[11px] font-extrabold leading-4">
										{p.newCount > 99 ? "99+" : p.newCount}
									</span>
								)}
							</Link>
						</li>
					))}
				</ul>
				{role !== "member" && (
					<Link
						to="/app/new"
						onClick={onNavigate}
						className="mt-2 flex items-center gap-2 rounded-2xl px-2.5 py-2 text-sm font-extrabold text-ink-soft hover:bg-fog hover:text-ink"
					>
						<Plus className="size-4" /> New project
					</Link>
				)}
			</div>

			<div className="space-y-1 border-t-2 border-dashed border-ink/15 pt-4">
				<Link
					to="/app/team"
					onClick={onNavigate}
					className="flex items-center gap-2.5 rounded-2xl px-2.5 py-2 font-bold hover:bg-fog"
					activeProps={{ className: "bg-fog" }}
				>
					<UsersRound className="size-4" /> Team
				</Link>
				<Link
					to="/app/account"
					onClick={onNavigate}
					className="flex items-center gap-2.5 rounded-2xl px-2.5 py-2 font-bold hover:bg-fog"
					activeProps={{ className: "bg-fog" }}
				>
					<UserRound className="size-4" /> Account
				</Link>
				<div className="flex items-center gap-2.5 px-2.5 pt-3">
					<span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-bubblegum text-xs font-extrabold">
						{initials(user.name)}
					</span>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-extrabold">{user.name}</p>
						<p className="truncate text-xs text-ink-soft">{user.email}</p>
					</div>
					<button type="button" onClick={logout} className="btn btn-quiet btn-icon" aria-label="Log out" title="Log out">
						<LogOut className="size-4" />
					</button>
				</div>
				<VersionInfo />
			</div>
		</nav>
	);
}

/** Running version, plus a nudge for admins when a newer release exists. Loaded after paint. */
function VersionInfo() {
	const [info, setInfo] = useState<Awaited<ReturnType<typeof getVersionFn>> | null>(null);
	useEffect(() => {
		getVersionFn()
			.then(setInfo)
			.catch(() => {});
	}, []);
	if (!info) return null;
	return (
		<div className="px-2.5 pt-1 text-[11px] font-bold text-ink-faint">
			{info.update ? (
				<a
					href={info.update.url}
					target="_blank"
					rel="noreferrer"
					className="flex items-center gap-1.5 rounded-xl bg-mint-soft px-2 py-1.5 text-ink hover:bg-mint"
				>
					<ArrowUpCircle className="size-3.5" /> Update available: v{info.update.version}
				</a>
			) : (
				<span>Hootbox v{info.current}</span>
			)}
		</div>
	);
}
