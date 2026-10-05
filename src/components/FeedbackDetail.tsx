import { useRouter } from "@tanstack/react-router";
import { ExternalLink, Globe, Lock, Mail, MessageSquareReply, Plus, Trash2, X } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import type { z } from "zod";
import { FEEDBACK_STATUSES, FEEDBACK_TYPES, type FeedbackStatus, type FeedbackType } from "#/lib/constants";
import { initials, RATING_FACES, STATUS_META, safeHttpUrl, summarizeUserAgent, TYPE_META, timeAgo } from "#/lib/meta";
import { LIMITS, type updateFeedbackSchema } from "#/lib/validation";
import { addNoteFn, deleteFeedbackFn, deleteNoteFn, type getFeedbackFn, updateFeedbackFn } from "#/server/functions/feedback";
import { errorMessage, useToast } from "./toast";
import { Button, Toggle } from "./ui";

type Item = Awaited<ReturnType<typeof getFeedbackFn>>;
type Patch = z.input<typeof updateFeedbackSchema>;

const SOURCE_LABEL = { widget: "Widget", board: "Public board", form: "Feedback form", api: "API" } as const;

export function FeedbackDetail({
	item,
	projectId,
	canDelete,
	onClose,
}: {
	item: Item;
	projectId: string;
	canDelete: boolean;
	onClose: () => void;
}) {
	const router = useRouter();
	const toast = useToast();
	const [reply, setReply] = useState(item.publicReply ?? "");
	const [tagInput, setTagInput] = useState("");
	const [note, setNote] = useState("");
	const [saving, setSaving] = useState<string | null>(null);

	async function save(patch: Patch, label = "patch", message = "Saved") {
		setSaving(label);
		try {
			await updateFeedbackFn({ data: { projectId, feedbackId: item.id, patch } });
			await router.invalidate();
			toast.success(message);
			return true;
		} catch (err) {
			toast.error(errorMessage(err));
			return false;
		} finally {
			setSaving(null);
		}
	}

	async function addTag(e: FormEvent) {
		e.preventDefault();
		const tag = tagInput.trim().toLowerCase();
		if (!tag || item.tags.includes(tag)) return setTagInput("");
		if (await save({ tags: [...item.tags, tag] }, "tags", "Tag added")) setTagInput("");
	}

	async function submitNote(e: FormEvent) {
		e.preventDefault();
		if (!note.trim()) return;
		setSaving("note");
		try {
			await addNoteFn({ data: { projectId, feedbackId: item.id, body: note } });
			setNote("");
			await router.invalidate();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setSaving(null);
		}
	}

	async function removeNote(noteId: string) {
		try {
			await deleteNoteFn({ data: { projectId, noteId } });
			await router.invalidate();
		} catch (err) {
			toast.error(errorMessage(err));
		}
	}

	async function remove() {
		if (!confirm(`Delete feedback #${item.number}? This can't be undone.`)) return;
		try {
			await deleteFeedbackFn({ data: { projectId, ids: [item.id] } });
			toast.success("Deleted");
			onClose();
			await router.invalidate();
		} catch (err) {
			toast.error(errorMessage(err));
		}
	}

	const pageUrl = safeHttpUrl(item.pageUrl);
	const ua = summarizeUserAgent(item.userAgent);
	const meta = Object.entries(item.metadata ?? {});

	return (
		<article className="card animate-pop-in overflow-hidden">
			<header className={`flex items-center gap-2 border-b-2 border-ink px-5 py-3 ${TYPE_META[item.type].className}`}>
				<span className="text-xl" aria-hidden>
					{TYPE_META[item.type].emoji}
				</span>
				<select
					aria-label="Type"
					className="rounded-full border-2 border-ink bg-paper px-2 py-0.5 text-sm font-extrabold cursor-pointer"
					value={item.type}
					onChange={(e) => save({ type: e.target.value as FeedbackType }, "type", "Type updated")}
				>
					{FEEDBACK_TYPES.map((t) => (
						<option key={t} value={t}>
							{TYPE_META[t].label}
						</option>
					))}
				</select>
				<span className="font-extrabold text-ink-soft">#{item.number}</span>
				<button type="button" onClick={onClose} className="ml-auto btn btn-ghost btn-icon btn-sm" aria-label="Close">
					<X className="size-4" />
				</button>
			</header>

			<div className="space-y-6 p-5">
				<div>
					{item.title && <h2 className="mb-2 text-xl font-extrabold">{item.title}</h2>}
					<p className="whitespace-pre-wrap break-words leading-relaxed">{item.message}</p>
					{item.rating && (
						<p className="mt-3 inline-flex items-center gap-2 rounded-full bg-fog px-3 py-1 text-sm font-bold">
							<span className="text-lg">{RATING_FACES[item.rating - 1]}</span> Mood {item.rating}/5
						</p>
					)}
				</div>

				<Section title="From">
					<div className="flex items-center gap-3">
						<span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-sky-soft text-sm font-extrabold">
							{item.authorName ? initials(item.authorName) : "?"}
						</span>
						<div className="min-w-0 flex-1">
							<p className="truncate font-extrabold">
								{item.authorName || (item.authorEmail ? item.authorEmail.split("@")[0] : "Anonymous")}
							</p>
							<p className="truncate text-sm text-ink-soft">{item.authorEmail || "No email left"}</p>
						</div>
						{item.authorEmail && (
							<a
								className="btn btn-ghost btn-sm"
								href={`mailto:${item.authorEmail}?subject=${encodeURIComponent(`Re: your feedback${item.title ? `: ${item.title}` : ""}`)}`}
							>
								<Mail className="size-3.5" /> Reply
							</a>
						)}
					</div>
					<dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
						<dt className="text-ink-soft">Received</dt>
						<dd className="font-bold" title={new Date(item.createdAt).toLocaleString()}>
							{timeAgo(item.createdAt)} via {SOURCE_LABEL[item.source]}
						</dd>
						{pageUrl && (
							<>
								<dt className="text-ink-soft">Page</dt>
								<dd className="min-w-0">
									<a
										href={pageUrl}
										target="_blank"
										rel="noopener noreferrer nofollow"
										className="inline-flex max-w-full items-center gap-1 font-bold underline decoration-2 decoration-sunny"
									>
										<span className="truncate">{pageUrl.replace(/^https?:\/\//, "")}</span>
										<ExternalLink className="size-3 shrink-0" />
									</a>
								</dd>
							</>
						)}
						{ua && (
							<>
								<dt className="text-ink-soft">Browser</dt>
								<dd className="font-bold" title={item.userAgent ?? ""}>
									{ua}
								</dd>
							</>
						)}
						{meta.map(([k, v]) => (
							<div key={k} className="contents">
								<dt className="truncate text-ink-soft">{k}</dt>
								<dd className="break-all font-mono text-xs leading-5">{String(v)}</dd>
							</div>
						))}
					</dl>
				</Section>

				<Section title="Status">
					<div className="flex flex-wrap gap-1.5">
						{FEEDBACK_STATUSES.map((s) => (
							<button
								key={s}
								type="button"
								disabled={saving !== null}
								onClick={() => s !== item.status && save({ status: s as FeedbackStatus }, "status", `Marked as ${STATUS_META[s].label}`)}
								className={`chip cursor-pointer py-1 transition-transform hover:-translate-y-0.5 ${item.status === s ? `${STATUS_META[s].className} shadow-pop-sm` : "bg-paper text-ink-soft"}`}
								aria-pressed={item.status === s}
							>
								<span className={`size-2 rounded-full ${STATUS_META[s].dot}`} />
								{STATUS_META[s].label}
							</button>
						))}
					</div>
				</Section>

				<Section title="Tags">
					<div className="flex flex-wrap items-center gap-1.5">
						{item.tags.map((t) => (
							<span key={t} className="chip bg-fog">
								#{t}
								<button
									type="button"
									aria-label={`Remove tag ${t}`}
									className="cursor-pointer rounded-full hover:text-tomato"
									onClick={() => save({ tags: item.tags.filter((x) => x !== t) }, "tags", "Tag removed")}
								>
									<X className="size-3" strokeWidth={3} />
								</button>
							</span>
						))}
						{item.tags.length < LIMITS.tags && (
							<form onSubmit={addTag} className="flex items-center gap-1">
								<input
									value={tagInput}
									onChange={(e) => setTagInput(e.target.value)}
									placeholder="add tag"
									maxLength={LIMITS.tag}
									aria-label="New tag"
									className="w-24 rounded-full border-2 border-dashed border-ink/40 bg-transparent px-2.5 py-0.5 text-xs font-bold outline-none focus:border-violet"
								/>
								{tagInput && (
									<button type="submit" className="btn btn-sunny btn-icon btn-sm" aria-label="Add tag">
										<Plus className="size-3" />
									</button>
								)}
							</form>
						)}
					</div>
				</Section>

				<Section title="Public board">
					<div className="space-y-3 rounded-2xl border-2 border-ink/15 bg-cream p-3.5">
						<Toggle
							checked={item.isPublic}
							disabled={saving !== null}
							onChange={(v) => save({ isPublic: v }, "public", v ? "Published to board" : "Hidden from board")}
							label={
								<span className="inline-flex items-center gap-1.5">
									{item.isPublic ? <Globe className="size-4" /> : <Lock className="size-4" />}
									{item.isPublic ? `Public · ${item.voteCount} vote${item.voteCount === 1 ? "" : "s"}` : "Private"}
								</span>
							}
							description="Public posts appear on your board and roadmap. Author details are never shown."
						/>
						{item.isPublic && (
							<form
								onSubmit={(e) => {
									e.preventDefault();
									save({ publicReply: reply }, "reply", reply.trim() ? "Reply published" : "Reply removed");
								}}
								className="space-y-2"
							>
								<label className="label mb-0 inline-flex items-center gap-1.5 text-xs" htmlFor={`reply-${item.id}`}>
									<MessageSquareReply className="size-3.5" /> Public reply
								</label>
								<textarea
									id={`reply-${item.id}`}
									className="input min-h-20 text-sm"
									maxLength={LIMITS.reply}
									value={reply}
									onChange={(e) => setReply(e.target.value)}
									placeholder="Thanks! This is planned for next month."
								/>
								{reply !== (item.publicReply ?? "") && (
									<Button type="submit" size="sm" variant="ink" loading={saving === "reply"}>
										Save reply
									</Button>
								)}
							</form>
						)}
					</div>
				</Section>

				<Section title={`Internal notes${item.notes.length ? ` (${item.notes.length})` : ""}`}>
					<ul className="space-y-2">
						{item.notes.map((n) => (
							<li key={n.id} className="group rounded-2xl bg-sunny-soft px-3.5 py-2.5">
								<div className="flex items-center gap-2 text-xs">
									<span className="font-extrabold">{n.authorName ?? "Former member"}</span>
									<span className="text-ink-soft">{timeAgo(n.createdAt)}</span>
									<button
										type="button"
										onClick={() => removeNote(n.id)}
										className="ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer hover:text-tomato"
										aria-label="Delete note"
									>
										<Trash2 className="size-3.5" />
									</button>
								</div>
								<p className="mt-1 whitespace-pre-wrap break-words text-sm">{n.body}</p>
							</li>
						))}
					</ul>
					<form onSubmit={submitNote} className="mt-2 flex gap-2">
						<input
							value={note}
							onChange={(e) => setNote(e.target.value)}
							className="input py-2 text-sm"
							placeholder="Add a note for your team…"
							maxLength={LIMITS.note}
							aria-label="New note"
						/>
						<Button type="submit" variant="sunny" size="sm" loading={saving === "note"} disabled={!note.trim()}>
							Add
						</Button>
					</form>
				</Section>

				{canDelete && (
					<div className="flex justify-end border-t-2 border-dashed border-ink/15 pt-4">
						<Button variant="quiet" size="sm" onClick={remove} className="text-tomato">
							<Trash2 className="size-3.5" /> Delete feedback
						</Button>
					</div>
				)}
			</div>
		</article>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section>
			<h3 className="mb-2 font-sans text-[11px] font-extrabold uppercase tracking-wider text-ink-faint">{title}</h3>
			{children}
		</section>
	);
}
