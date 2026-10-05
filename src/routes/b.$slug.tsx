import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowBigUp, MessageSquareReply } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { PublicFeedbackForm } from "#/components/PublicFeedbackForm";
import { PublicShell } from "#/components/PublicShell";
import { errorMessage, useToast } from "#/components/toast";
import { EmptyState, StatusBadge, TypeBadge } from "#/components/ui";
import { ROADMAP_STATUSES } from "#/lib/constants";
import { STATUS_META, timeAgo } from "#/lib/meta";
import { getBoardFn, voteFn } from "#/server/functions/public";

export const Route = createFileRoute("/b/$slug")({
	validateSearch: z.object({
		view: z.enum(["ideas", "roadmap"]).catch("ideas").default("ideas"),
		sort: z.enum(["top", "new"]).catch("top").default("top"),
	}),
	loaderDeps: ({ search }) => ({ sort: search.sort }),
	loader: ({ params, deps }) => getBoardFn({ data: { slug: params.slug, sort: deps.sort } }),
	head: ({ loaderData }) => ({
		meta: loaderData
			? [
					{ title: `${loaderData.project.name} · Feedback board` },
					{
						name: "description",
						content: loaderData.project.description || `Share ideas and vote on what ${loaderData.project.name} builds next.`,
					},
					{ property: "og:title", content: `${loaderData.project.name} · Feedback board` },
				]
			: [{ title: "Feedback board" }],
	}),
	component: Board,
});

type Post = Awaited<ReturnType<typeof getBoardFn>>["posts"][number];

function Board() {
	const { project, posts } = Route.useLoaderData();
	const { view, sort } = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<PublicShell project={project}>
			<div className="mb-6 flex flex-wrap items-center gap-3">
				<nav className="flex gap-1 rounded-full border-2 border-ink bg-paper p-1 shadow-pop-sm">
					{(["ideas", "roadmap"] as const).map((v) => (
						<button
							key={v}
							type="button"
							onClick={() => navigate({ search: (p) => ({ ...p, view: v }) })}
							className={`tab cursor-pointer capitalize ${view === v ? "active" : ""}`}
						>
							{v === "ideas" ? "💡 Ideas" : "🗺️ Roadmap"}
						</button>
					))}
				</nav>
				{view === "ideas" && (
					<select
						aria-label="Sort"
						className="input ml-auto w-auto"
						value={sort}
						onChange={(e) => navigate({ search: (p) => ({ ...p, sort: e.target.value as "top" | "new" }), replace: true })}
					>
						<option value="top">Most votes</option>
						<option value="new">Newest</option>
					</select>
				)}
			</div>

			{view === "ideas" ? (
				<div className="grid gap-6 md:grid-cols-[1fr_320px]">
					<div className="space-y-3">
						{posts.length === 0 ? (
							<div className="card">
								<EmptyState title="No posts yet" mood="curious">
									Be the first to share an idea!
								</EmptyState>
							</div>
						) : (
							posts.map((p) => <PostCard key={p.id} post={p} />)
						)}
					</div>
					{project.boardSubmissions && (
						<aside className="md:sticky md:top-6 h-fit">
							<div className="card p-5">
								<h2 className="mb-3 text-xl font-extrabold">Share an idea</h2>
								<PublicFeedbackForm
									slug={project.slug}
									source="board"
									types={project.types.filter((t) => t !== "praise").length ? project.types.filter((t) => t !== "praise") : project.types}
									askEmail={project.askEmail}
									thankYouMessage={project.thankYouMessage}
									color={project.color}
									withTitle
								/>
							</div>
						</aside>
					)}
				</div>
			) : (
				<Roadmap posts={posts} />
			)}
		</PublicShell>
	);
}

function VoteButton({ post }: { post: Post }) {
	const { slug } = Route.useParams();
	const router = useRouter();
	const toast = useToast();
	const [state, setState] = useState({ voted: post.hasVoted, count: post.voteCount });
	const [pending, setPending] = useState(false);

	async function vote() {
		setPending(true);
		// Optimistic update.
		setState((s) => ({ voted: !s.voted, count: s.count + (s.voted ? -1 : 1) }));
		try {
			const res = await voteFn({ data: { slug, feedbackId: post.id } });
			setState({ voted: res.voted, count: res.voteCount });
		} catch (err) {
			setState({ voted: post.hasVoted, count: post.voteCount });
			toast.error(errorMessage(err));
			router.invalidate();
		} finally {
			setPending(false);
		}
	}

	return (
		<button
			type="button"
			onClick={vote}
			disabled={pending}
			aria-pressed={state.voted}
			aria-label={state.voted ? "Remove vote" : "Upvote"}
			className={`flex w-14 shrink-0 flex-col items-center rounded-2xl border-2 border-ink py-1.5 font-extrabold transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0.5 ${state.voted ? "bg-sunny shadow-pop-sm" : "bg-paper"}`}
		>
			<ArrowBigUp className={`size-6 ${state.voted ? "fill-ink" : ""}`} />
			<span className="tabular-nums">{state.count}</span>
		</button>
	);
}

function PostCard({ post }: { post: Post }) {
	return (
		<article className="card flex gap-4 p-4 animate-pop-in">
			<VoteButton post={post} />
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<TypeBadge type={post.type} />
					{post.status !== "new" && <StatusBadge status={post.status} />}
					<span className="text-xs text-ink-faint">{timeAgo(post.createdAt)}</span>
				</div>
				{post.title && <h3 className="mt-2 text-lg font-extrabold">{post.title}</h3>}
				<p className="mt-1 whitespace-pre-wrap break-words text-ink-soft">{post.message}</p>
				{post.publicReply && (
					<div className="mt-3 rounded-2xl border-2 border-ink bg-violet-soft px-3.5 py-2.5">
						<p className="flex items-center gap-1.5 text-xs font-extrabold">
							<MessageSquareReply className="size-3.5" /> Reply from the team
						</p>
						<p className="mt-1 whitespace-pre-wrap break-words text-sm">{post.publicReply}</p>
					</div>
				)}
			</div>
		</article>
	);
}

function Roadmap({ posts }: { posts: Post[] }) {
	const columns = ROADMAP_STATUSES.map((s) => ({ status: s, items: posts.filter((p) => p.status === s) }));
	const tint = { planned: "bg-sunny-soft", in_progress: "bg-tomato-soft", done: "bg-mint-soft" } as const;
	return (
		<div className="grid gap-5 md:grid-cols-3">
			{columns.map((col) => (
				<section key={col.status} className={`rounded-[var(--radius-blob)] border-2 border-ink p-4 ${tint[col.status]}`}>
					<h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
						<span className={`size-3 rounded-full border-2 border-ink ${STATUS_META[col.status].dot}`} />
						{STATUS_META[col.status].label}
						<span className="ml-auto text-sm text-ink-soft">{col.items.length}</span>
					</h2>
					<ul className="space-y-2.5">
						{col.items.length === 0 && (
							<li className="rounded-2xl border-2 border-dashed border-ink/25 p-4 text-center text-sm text-ink-soft">Nothing here yet</li>
						)}
						{col.items.map((p) => (
							<li key={p.id} className="card-flat p-3">
								<p className="font-extrabold leading-snug">{p.title || p.message}</p>
								<p className="mt-1 flex items-center gap-1 text-xs font-bold text-ink-soft">
									<ArrowBigUp className="size-4" /> {p.voteCount}
								</p>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
