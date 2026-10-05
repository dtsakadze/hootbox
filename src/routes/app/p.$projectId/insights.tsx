import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Heart } from "lucide-react";
import { type ReactNode, useState } from "react";
import { z } from "zod";
import { EmptyState, StatusBadge } from "#/components/ui";
import { FEEDBACK_STATUSES, FEEDBACK_TYPES } from "#/lib/constants";
import { RATING_FACES, STATUS_META, TYPE_META } from "#/lib/meta";
import { getStatsFn } from "#/server/functions/feedback";

export const Route = createFileRoute("/app/p/$projectId/insights")({
	validateSearch: z.object({
		days: z
			.union([z.literal(7), z.literal(30), z.literal(90)])
			.catch(30)
			.default(30),
	}),
	search: { middlewares: [stripSearchParams({ days: 30 })] },
	loaderDeps: ({ search }) => ({ days: search.days }),
	loader: ({ params, deps }) => getStatsFn({ data: { projectId: params.projectId, days: deps.days } }),
	component: Insights,
});

function Insights() {
	const stats = Route.useLoaderData();
	const { days } = Route.useSearch();
	const { projectId } = Route.useParams();
	const navigate = useNavigate({ from: Route.fullPath });

	if (stats.total === 0) {
		return (
			<div className="card">
				<EmptyState title="No data to chew on yet" mood="sleepy">
					Insights appear once the first feedback arrives.
				</EmptyState>
			</div>
		);
	}

	const delta = stats.last7 - stats.prev7;
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Tile label="Total feedback" value={stats.total} tint="bg-violet-soft" />
				<Tile label="Needs attention" value={stats.open} sub={`${stats.fresh} brand new`} tint="bg-sunny-soft" />
				<Tile
					label="Last 7 days"
					value={stats.last7}
					tint="bg-sky-soft"
					sub={
						<span className="inline-flex items-center gap-0.5">
							{delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
							{delta === 0 ? "same as the week before" : `${Math.abs(delta)} ${delta > 0 ? "more" : "fewer"} than the week before`}
						</span>
					}
				/>
				<Tile
					label="Average mood"
					value={stats.avgRating ? `${RATING_FACES[Math.round(stats.avgRating) - 1]} ${stats.avgRating.toFixed(1)}` : "—"}
					sub={`${stats.ratingCount} rating${stats.ratingCount === 1 ? "" : "s"}`}
					tint="bg-bubblegum-soft"
				/>
			</div>

			<Panel
				title="Feedback per day"
				actions={
					<div className="flex gap-1 rounded-full border-2 border-ink bg-paper p-0.5">
						{([7, 30, 90] as const).map((d) => (
							<button
								key={d}
								type="button"
								onClick={() => navigate({ search: { days: d }, replace: true })}
								className={`rounded-full px-3 py-0.5 text-xs font-extrabold cursor-pointer ${days === d ? "bg-ink text-white" : "hover:bg-fog"}`}
							>
								{d}d
							</button>
						))}
					</div>
				}
			>
				<DailyChart data={stats.daily} />
			</Panel>

			<div className="grid gap-6 lg:grid-cols-2">
				<Panel title="By type">
					<BarList
						rows={FEEDBACK_TYPES.map((t) => ({ key: t, label: `${TYPE_META[t].emoji} ${TYPE_META[t].label}`, value: stats.byType[t] }))}
						linkFor={(key) => ({ type: key })}
						projectId={projectId}
					/>
				</Panel>
				<Panel title="By status">
					<BarList
						rows={FEEDBACK_STATUSES.map((s) => ({ key: s, label: STATUS_META[s].label, value: stats.byStatus[s] }))}
						linkFor={(key) => ({ status: key })}
						projectId={projectId}
					/>
				</Panel>
				<Panel title="Mood ratings">
					{stats.ratingCount === 0 ? (
						<p className="text-sm text-ink-soft">No ratings yet. The widget asks for an optional mood.</p>
					) : (
						<BarList
							rows={stats.ratings
								.map((r) => ({ key: String(r.rating), label: `${RATING_FACES[r.rating - 1]} ${r.rating}`, value: r.n }))
								.reverse()}
						/>
					)}
				</Panel>
				<Panel title="Popular on your board">
					{stats.topVoted.length === 0 ? (
						<p className="text-sm text-ink-soft">No votes yet. Make ideas public so people can upvote them.</p>
					) : (
						<ul className="space-y-2">
							{stats.topVoted.map((f) => (
								<li key={f.id}>
									<Link
										to="/app/p/$projectId"
										params={{ projectId }}
										search={{ id: f.id, status: "all" }}
										className="flex items-center gap-3 rounded-2xl px-2 py-1.5 hover:bg-fog"
									>
										<span className="flex w-12 shrink-0 items-center gap-1 font-extrabold">
											<Heart className="size-3.5 fill-bubblegum" /> {f.voteCount}
										</span>
										<span className="min-w-0 flex-1 truncate font-bold">{f.title || f.message}</span>
										<StatusBadge status={f.status} />
									</Link>
								</li>
							))}
						</ul>
					)}
					{stats.tags.length > 0 && (
						<div className="mt-5">
							<p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-ink-faint">Top tags</p>
							<div className="flex flex-wrap gap-1.5">
								{stats.tags.map((t) => (
									<Link
										key={t.tag}
										to="/app/p/$projectId"
										params={{ projectId }}
										search={{ tag: t.tag, status: "all" }}
										className="chip bg-fog hover:bg-sunny-soft"
									>
										#{t.tag} <span className="text-ink-soft">{t.n}</span>
									</Link>
								))}
							</div>
						</div>
					)}
				</Panel>
			</div>
		</div>
	);
}

function Tile({ label, value, sub, tint }: { label: string; value: ReactNode; sub?: ReactNode; tint: string }) {
	return (
		<div className={`card p-5 ${tint}`}>
			<p className="text-xs font-extrabold uppercase tracking-wider text-ink-soft">{label}</p>
			<p className="mt-1 font-display text-4xl font-extrabold tabular-nums">{value}</p>
			{sub && <p className="mt-1 text-xs font-bold text-ink-soft">{sub}</p>}
		</div>
	);
}

function Panel({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
	return (
		<section className="card p-6">
			<div className="mb-4 flex items-center justify-between gap-3">
				<h2 className="text-lg font-extrabold">{title}</h2>
				{actions}
			</div>
			{children}
		</section>
	);
}

/** Single-series column chart with hover tooltip. */
function DailyChart({ data }: { data: { day: string; n: number }[] }) {
	const [hover, setHover] = useState<number | null>(null);
	const max = Math.max(1, ...data.map((d) => d.n));
	const ticks = [0, Math.ceil(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
	const fmt = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
	const labelEvery = Math.ceil(data.length / 8);

	return (
		<div className="relative">
			<div className="flex h-48 gap-3">
				<div className="flex flex-col justify-between pb-6 text-right text-[11px] font-bold text-ink-faint tabular-nums">
					{[...ticks].reverse().map((t) => (
						<span key={t}>{t}</span>
					))}
				</div>
				<div className="relative flex-1">
					<div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
						{ticks.map((t) => (
							<div key={t} className="border-t border-dashed border-ink/10" />
						))}
					</div>
					{/* biome-ignore lint/a11y/noStaticElementInteractions: hover tooltip is an enhancement; each bar has an aria-label. */}
					<div className="absolute inset-x-0 top-0 bottom-6 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
						{data.map((d, i) => (
							<div
								key={d.day}
								className="group relative flex h-full flex-1 items-end"
								onMouseEnter={() => setHover(i)}
								role="img"
								aria-label={`${fmt(d.day)}: ${d.n} feedback`}
							>
								<div
									className={`w-full rounded-t-[4px] transition-colors ${hover === i ? "bg-ink" : "bg-violet"}`}
									style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n > 0 ? 3 : 0 }}
								/>
							</div>
						))}
					</div>
					<div className="absolute inset-x-0 bottom-0 flex h-6 items-end">
						{data.map((d, i) => (
							<span key={d.day} className="flex-1 text-center text-[10px] font-bold text-ink-faint whitespace-nowrap">
								{i % labelEvery === 0 ? fmt(d.day) : ""}
							</span>
						))}
					</div>
					{hover !== null && (
						<div
							className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-xl border-2 border-ink bg-paper px-2.5 py-1 text-xs font-bold shadow-pop-sm whitespace-nowrap"
							style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
						>
							{fmt(data[hover].day)} · <span className="font-extrabold">{data[hover].n}</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function BarList({
	rows,
	linkFor,
	projectId,
}: {
	rows: { key: string; label: string; value: number }[];
	linkFor?: (key: string) => Record<string, string>;
	projectId?: string;
}) {
	const max = Math.max(1, ...rows.map((r) => r.value));
	const total = rows.reduce((a, r) => a + r.value, 0) || 1;
	return (
		<ul className="space-y-2.5">
			{rows.map((r) => {
				const inner = (
					<>
						<span className="w-28 shrink-0 truncate text-sm font-bold">{r.label}</span>
						<span className="relative h-5 flex-1 rounded-full bg-fog">
							<span
								className="absolute inset-y-0 left-0 rounded-full bg-violet"
								style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? 8 : 0 }}
							/>
						</span>
						<span className="w-16 shrink-0 text-right text-sm font-extrabold tabular-nums">
							{r.value} <span className="text-xs font-bold text-ink-faint">{Math.round((r.value / total) * 100)}%</span>
						</span>
					</>
				);
				return (
					<li key={r.key} title={`${r.label}: ${r.value}`}>
						{linkFor && projectId ? (
							<Link
								to="/app/p/$projectId"
								params={{ projectId }}
								search={{ status: "all", ...linkFor(r.key) }}
								className="flex items-center gap-3 rounded-xl hover:bg-cream"
							>
								{inner}
							</Link>
						) : (
							<div className="flex items-center gap-3">{inner}</div>
						)}
					</li>
				);
			})}
		</ul>
	);
}
