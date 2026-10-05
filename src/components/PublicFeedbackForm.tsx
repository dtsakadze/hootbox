import { type FormEvent, useState } from "react";
import type { FeedbackType } from "#/lib/constants";
import { RATING_FACES, TYPE_META } from "#/lib/meta";
import { LIMITS } from "#/lib/validation";
import { submitPublicFn } from "#/server/functions/public";
import { Owl } from "./Owl";
import { errorMessage } from "./toast";
import { Button, ErrorNote } from "./ui";

type Props = {
	slug: string;
	source: "board" | "form";
	types: FeedbackType[];
	askEmail: "optional" | "required" | "hidden";
	thankYouMessage: string;
	color: string;
	withTitle?: boolean;
	onSubmitted?: (result: { isPublic: boolean }) => void;
};

export function PublicFeedbackForm({ slug, source, types, askEmail, thankYouMessage, color, withTitle, onSubmitted }: Props) {
	const [type, setType] = useState<FeedbackType>(types[0] ?? "idea");
	const [rating, setRating] = useState<number | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState<{ isPublic: boolean } | null>(null);

	async function onSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
		setPending(true);
		setError(null);
		try {
			const res = await submitPublicFn({
				data: {
					slug,
					source,
					feedback: {
						type,
						rating,
						title: f.title || null,
						message: f.message,
						name: f.name || null,
						email: f.email || null,
						website: f.website,
						pageUrl: typeof document !== "undefined" ? document.referrer || null : null,
					},
				},
			});
			setDone({ isPublic: res.isPublic });
			onSubmitted?.({ isPublic: res.isPublic });
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setPending(false);
		}
	}

	if (done) {
		return (
			<div className="flex flex-col items-center py-6 text-center animate-pop-in">
				<Owl size={96} mood="happy" color={color} className="animate-[wiggle_0.6s_ease-in-out]" />
				<h3 className="mt-3 text-2xl font-extrabold">Got it!</h3>
				<p className="mt-1 max-w-sm text-ink-soft">{thankYouMessage}</p>
				{source === "board" && !done.isPublic && (
					<p className="mt-2 text-xs text-ink-faint">Your post will appear on the board once the team reviews it.</p>
				)}
				<Button
					variant="ghost"
					className="mt-5"
					onClick={() => {
						setDone(null);
						setRating(null);
					}}
				>
					Send another
				</Button>
			</div>
		);
	}

	return (
		<form onSubmit={onSubmit} className="@container space-y-4">
			<ErrorNote>{error}</ErrorNote>
			{types.length > 1 && (
				<fieldset>
					<legend className="label">What's on your mind?</legend>
					<div className="flex flex-wrap gap-2">
						{types.map((t) => (
							<button
								key={t}
								type="button"
								aria-pressed={type === t}
								onClick={() => setType(t)}
								className={`chip cursor-pointer px-3 py-1.5 text-sm transition-transform ${type === t ? `${TYPE_META[t].className} shadow-pop-sm -translate-y-0.5` : "bg-paper text-ink-soft hover:bg-fog"}`}
							>
								{TYPE_META[t].emoji} {TYPE_META[t].label}
							</button>
						))}
					</div>
				</fieldset>
			)}
			{withTitle && (
				<input name="title" className="input font-bold" placeholder="A short title" maxLength={LIMITS.title} aria-label="Title" />
			)}
			<textarea
				name="message"
				className="input"
				required
				minLength={2}
				maxLength={LIMITS.message}
				aria-label="Your feedback"
				placeholder={
					type === "bug"
						? "What happened? What did you expect?"
						: type === "idea"
							? "What would make things better?"
							: "Tell us everything…"
				}
			/>
			<fieldset>
				<legend className="label">
					How do you feel? <span className="font-bold text-ink-faint">(optional)</span>
				</legend>
				<div className="flex gap-1.5">
					{RATING_FACES.map((face, i) => (
						<button
							key={face}
							type="button"
							aria-label={`Mood ${i + 1} of 5`}
							aria-pressed={rating === i + 1}
							onClick={() => setRating(rating === i + 1 ? null : i + 1)}
							className={`grid size-11 place-items-center rounded-2xl border-2 text-2xl transition-all cursor-pointer ${rating === i + 1 ? "border-ink bg-sunny scale-110 shadow-pop-sm" : "border-transparent hover:bg-fog hover:scale-110"} ${rating && rating !== i + 1 ? "opacity-40 grayscale" : ""}`}
						>
							{face}
						</button>
					))}
				</div>
			</fieldset>
			{askEmail !== "hidden" && (
				<div className="grid gap-3 @md:grid-cols-2">
					<input
						name="name"
						className="input"
						placeholder="Your name (optional)"
						maxLength={LIMITS.name}
						aria-label="Name"
						autoComplete="name"
					/>
					<input
						name="email"
						type="email"
						className="input"
						placeholder={askEmail === "required" ? "Email" : "Email (optional)"}
						required={askEmail === "required"}
						maxLength={LIMITS.email}
						aria-label="Email"
						autoComplete="email"
					/>
				</div>
			)}
			{/* Honeypot: hidden from humans */}
			<input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
			<Button type="submit" loading={pending} className="w-full" variant="ink">
				Send feedback
			</Button>
		</form>
	);
}
