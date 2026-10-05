import { createFileRoute, getRouteApi, Link, stripSearchParams, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Download, Heart, Search, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { FeedbackDetail } from "#/components/FeedbackDetail";
import { errorMessage, useToast } from "#/components/toast";
import { Button, EmptyState, StatusBadge } from "#/components/ui";
import { FEEDBACK_STATUSES, FEEDBACK_TYPES, type FeedbackStatus } from "#/lib/constants";
import { RATING_FACES, STATUS_META, TYPE_META, timeAgo } from "#/lib/meta";
import { feedbackFiltersSchema } from "#/lib/validation";
import { bulkStatusFn, deleteFeedbackFn, getFeedbackFn, listFeedbackFn } from "#/server/functions/feedback";

const projectRoute = getRouteApi("/app/p/$projectId");

const searchSchema = feedbackFiltersSchema.extend({ id: z.string().max(64).optional().catch(undefined) });

export const Route = createFileRoute("/app/p/$projectId/")({
	validateSearch: searchSchema,
	search: { middlewares: [stripSearchParams({ status: "open", sort: "newest", page: 1 })] },
	loaderDeps: ({ search }) => search,
	loader: async ({ params, deps: { id, ...filters } }) => {
		const [list, detail] = await Promise.all([
			listFeedbackFn({ data: { projectId: params.projectId, filters } }),
			id ? getFeedbackFn({ data: { projectId: params.projectId, feedbackId: id } }).catch(() => null) : null,
		]);
		return { list, detail };
	},
	component: Inbox,
});

const STATUS_TABS: { value: FeedbackStatus | "open" | "all"; label: string }[] = [
	{ value: "open", label: "Open" },
	...FEEDBACK_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label })),
	{ value: "all", label: "All" },
];

function Inbox() {
	const { list, detail } = Route.useLoaderData();
	const search = Route.useSearch();
	const { projectId } = Route.useParams();
	const { canManage } = projectRoute.useLoaderData();
	const navigate = useNavigate({ from: Route.fullPath });
	const router = useRouter();
	const toast = useToast();
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [q, setQ] = useState(search.q ?? "");
	const [busy, setBusy] = useState(false);

	const setFilter = (patch: Partial<typeof search>) => navigate({ search: (prev) => ({ ...prev, page: 1, ...patch }), replace: true });
	const setFilterRef = useRef(setFilter);
	setFilterRef.current = setFilter;

	// Debounced search-as-you-type.
	useEffect(() => {
		if ((search.q ?? "") === q) return;
		const t = setTimeout(() => setFilterRef.current({ q: q || undefined }), 300);
		return () => clearTimeout(t);
	}, [q, search.q]);

	// Clear the selection whenever the visible list changes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: list.items is the trigger, not a value used inside.
	useEffect(() => setSelected(new Set()), [list.items]);

	const openCount = list.counts.new + list.counts.reviewing + list.counts.planned + list.counts.in_progress;
	const countFor = (v: string) =>
		v === "open" ? openCount : v === "all" ? Object.values(list.counts).reduce((a, b) => a + b, 0) : list.counts[v as FeedbackStatus];

	async function bulk(action: "delete" | FeedbackStatus) {
		const ids = [...selected];
		if (action === "delete" && !confirm(`Delete ${ids.length} item(s)? This can't be undone.`)) return;
		setBusy(true);
		try {
			if (action === "delete") await deleteFeedbackFn({ data: { projectId, ids } });
			else await bulkStatusFn({ data: { projectId, ids, status: action } });
			toast.success(action === "delete" ? "Deleted" : `Moved to ${STATUS_META[action].label}`);
			if (search.id && ids.includes(search.id)) await navigate({ search: (p) => ({ ...p, id: undefined }) });
			await router.invalidate();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	const filtersActive = Boolean(search.q || search.type || search.tag);

	return (
		<div className={`grid gap-6 ${search.id ? "xl:grid-cols-[minmax(0,1fr)_440px]" : ""}`}>
			<section className="min-w-0">
				<div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
					{STATUS_TABS.map((t) => (
						<button
							key={t.value}
							type="button"
							onClick={() => setFilter({ status: t.value })}
							className={`chip cursor-pointer py-1.5 px-3 transition-colors ${search.status === t.value ? "bg-ink text-white" : "bg-paper hover:bg-fog"}`}
						>
							{t.label}
							<span className={`rounded-full px-1.5 text-[11px] ${search.status === t.value ? "bg-white/20" : "bg-fog"}`}>
								{countFor(t.value)}
							</span>
						</button>
					))}
				</div>

				<div className="mb-4 flex flex-wrap gap-2">
					<label className="relative min-w-[200px] flex-1">
						<span className="sr-only">Search feedback</span>
						<Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
						<input
							value={q}
							onChange={(e) => setQ(e.target.value)}
							placeholder="Search messages, emails or #number…"
							className="input pl-10"
							maxLength={200}
						/>
					</label>
					<select
						aria-label="Type"
						className="input w-auto"
						value={search.type ?? ""}
						onChange={(e) => setFilter({ type: (e.target.value || undefined) as typeof search.type })}
					>
						<option value="">All types</option>
						{FEEDBACK_TYPES.map((t) => (
							<option key={t} value={t}>
								{TYPE_META[t].emoji} {TYPE_META[t].label}
							</option>
						))}
					</select>
					{list.tags.length > 0 && (
						<select
							aria-label="Tag"
							className="input w-auto"
							value={search.tag ?? ""}
							onChange={(e) => setFilter({ tag: e.target.value || undefined })}
						>
							<option value="">All tags</option>
							{list.tags.map((t) => (
								<option key={t.tag} value={t.tag}>
									#{t.tag} ({t.n})
								</option>
							))}
						</select>
					)}
					<select
						aria-label="Sort"
						className="input w-auto"
						value={search.sort}
						onChange={(e) => setFilter({ sort: e.target.value as typeof search.sort })}
					>
						<option value="newest">Newest first</option>
						<option value="oldest">Oldest first</option>
						<option value="votes">Most votes</option>
					</select>
					<a href={`/api/projects/${projectId}/export`} className="btn btn-ghost" title="Download all feedback as CSV" download>
						<Download className="size-4" /> <span className="hidden sm:inline">CSV</span>
					</a>
				</div>

				{selected.size > 0 && (
					<div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-ink bg-sunny-soft px-3 py-2 animate-pop-in">
						<span className="text-sm font-extrabold">{selected.size} selected</span>
						<select
							aria-label="Set status"
							className="input w-auto py-1.5 text-sm"
							value=""
							disabled={busy}
							onChange={(e) => e.target.value && bulk(e.target.value as FeedbackStatus)}
						>
							<option value="">Set status…</option>
							{FEEDBACK_STATUSES.map((s) => (
								<option key={s} value={s}>
									{STATUS_META[s].label}
								</option>
							))}
						</select>
						{canManage && (
							<Button variant="danger" size="sm" onClick={() => bulk("delete")} loading={busy}>
								<Trash2 className="size-3.5" /> Delete
							</Button>
						)}
						<button type="button" className="ml-auto btn btn-quiet btn-sm" onClick={() => setSelected(new Set())}>
							Clear
						</button>
					</div>
				)}

				<div className="card overflow-hidden">
					{list.items.length === 0 ? (
						<EmptyState
							title={filtersActive ? "No matches" : search.status === "open" ? "Inbox zero! 🎉" : "Nothing here yet"}
							mood={filtersActive ? "curious" : "happy"}
							action={
								filtersActive ? (
									<Button
										variant="ghost"
										onClick={() => {
											setQ("");
											setFilter({ q: undefined, type: undefined, tag: undefined });
										}}
									>
										<X className="size-4" /> Clear filters
									</Button>
								) : (
									<Link to="/app/p/$projectId/install" params={{ projectId }} className="btn btn-primary">
										Start collecting feedback
									</Link>
								)
							}
						>
							{filtersActive
								? "Try a different search or filter."
								: "New feedback will land here. Add the widget or share your board to get going."}
						</EmptyState>
					) : (
						<ul className="divide-y-2 divide-ink/10">
							{list.items.map((item) => {
								const active = item.id === search.id;
								return (
									<li
										key={item.id}
										className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${active ? "bg-violet-soft" : "hover:bg-cream"}`}
									>
										<input
											type="checkbox"
											aria-label={`Select #${item.number}`}
											className="mt-1.5 size-4 accent-violet cursor-pointer"
											checked={selected.has(item.id)}
											onChange={(e) => {
												const next = new Set(selected);
												if (e.target.checked) next.add(item.id);
												else next.delete(item.id);
												setSelected(next);
											}}
										/>
										<Link
											from={Route.fullPath}
											search={(p) => ({ ...p, id: item.id })}
											resetScroll={false}
											className="flex min-w-0 flex-1 items-start gap-3"
										>
											<span
												className={`grid size-9 shrink-0 place-items-center rounded-xl border-2 border-ink text-base ${TYPE_META[item.type].className}`}
												title={TYPE_META[item.type].label}
											>
												{TYPE_META[item.type].emoji}
											</span>
											<span className="min-w-0 flex-1">
												<span className="flex items-baseline gap-2">
													<span className={`truncate ${item.status === "new" ? "font-extrabold" : "font-bold"}`}>
														{item.title || item.message}
													</span>
												</span>
												{item.title && <span className="block truncate text-sm text-ink-soft">{item.message}</span>}
												<span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
													<span className="font-bold text-ink-faint">#{item.number}</span>
													<span>{item.authorName || item.authorEmail || "Anonymous"}</span>
													<span>{timeAgo(item.createdAt)}</span>
													{item.rating && <span title={`Mood ${item.rating}/5`}>{RATING_FACES[item.rating - 1]}</span>}
													{item.isPublic && (
														<span className="inline-flex items-center gap-0.5 font-bold">
															<Heart className="size-3" /> {item.voteCount}
														</span>
													)}
													{item.tags.map((t) => (
														<span key={t} className="rounded-full bg-fog px-1.5 font-bold">
															#{t}
														</span>
													))}
												</span>
											</span>
											<StatusBadge status={item.status} className="hidden sm:inline-flex" />
										</Link>
									</li>
								);
							})}
						</ul>
					)}
				</div>

				{list.pageCount > 1 && (
					<div className="mt-4 flex items-center justify-center gap-3">
						<Button
							variant="ghost"
							size="sm"
							disabled={list.page <= 1}
							onClick={() => navigate({ search: (p) => ({ ...p, page: list.page - 1 }) })}
						>
							<ChevronLeft className="size-4" /> Prev
						</Button>
						<span className="text-sm font-bold">
							Page {list.page} of {list.pageCount}
						</span>
						<Button
							variant="ghost"
							size="sm"
							disabled={list.page >= list.pageCount}
							onClick={() => navigate({ search: (p) => ({ ...p, page: list.page + 1 }) })}
						>
							Next <ChevronRight className="size-4" />
						</Button>
					</div>
				)}
			</section>

			{search.id && (
				<aside className="fixed inset-0 z-40 overflow-y-auto bg-cream p-4 xl:static xl:z-auto xl:bg-transparent xl:p-0">
					<div className="xl:sticky xl:top-6">
						{detail ? (
							<FeedbackDetail
								key={detail.id}
								item={detail}
								projectId={projectId}
								canDelete={canManage}
								onClose={() => navigate({ search: (p) => ({ ...p, id: undefined }) })}
							/>
						) : (
							<div className="card">
								<EmptyState title="Feedback not found" mood="sleepy">
									It may have been deleted.
								</EmptyState>
							</div>
						)}
					</div>
				</aside>
			)}
		</div>
	);
}
