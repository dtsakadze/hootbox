import type { FeedbackStatus, FeedbackType, ProjectColor } from "./constants";

export const TYPE_META: Record<FeedbackType, { label: string; emoji: string; className: string }> = {
	idea: { label: "Idea", emoji: "💡", className: "bg-sunny-soft" },
	bug: { label: "Bug", emoji: "🐞", className: "bg-tomato-soft" },
	praise: { label: "Praise", emoji: "💛", className: "bg-bubblegum-soft" },
	question: { label: "Question", emoji: "❓", className: "bg-sky-soft" },
	other: { label: "Other", emoji: "💬", className: "bg-mint-soft" },
};

export const STATUS_META: Record<FeedbackStatus, { label: string; className: string; dot: string }> = {
	new: { label: "New", className: "bg-violet text-white", dot: "bg-violet" },
	reviewing: { label: "Reviewing", className: "bg-sky-soft", dot: "bg-sky" },
	planned: { label: "Planned", className: "bg-sunny", dot: "bg-sunny" },
	in_progress: { label: "In progress", className: "bg-tomato-soft", dot: "bg-tomato" },
	done: { label: "Done", className: "bg-mint", dot: "bg-mint" },
	closed: { label: "Closed", className: "bg-fog text-ink-soft", dot: "bg-ink-faint" },
};

export const COLOR_META: Record<ProjectColor, { bg: string; soft: string; label: string }> = {
	violet: { bg: "bg-violet", soft: "bg-violet-soft", label: "Grape" },
	tomato: { bg: "bg-tomato", soft: "bg-tomato-soft", label: "Tomato" },
	sunny: { bg: "bg-sunny", soft: "bg-sunny-soft", label: "Sunny" },
	mint: { bg: "bg-mint", soft: "bg-mint-soft", label: "Mint" },
	sky: { bg: "bg-sky", soft: "bg-sky-soft", label: "Sky" },
	bubblegum: { bg: "bg-bubblegum", soft: "bg-bubblegum-soft", label: "Bubblegum" },
};

export const colorMeta = (c: string) => COLOR_META[c as ProjectColor] ?? COLOR_META.violet;

export const RATING_FACES = ["😖", "🙁", "😐", "🙂", "😍"] as const;

const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;

export function timeAgo(date: Date | string, now = Date.now()) {
	const d = typeof date === "string" ? new Date(date) : date;
	const s = Math.round((d.getTime() - now) / 1000);
	const abs = Math.abs(s);
	if (!rtf) return d.toISOString().slice(0, 10);
	if (abs < 45) return "just now";
	if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
	if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
	if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
	return d.toLocaleDateString("en", { month: "short", day: "numeric", year: abs > 86400 * 300 ? "numeric" : undefined });
}

export function initials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase())
		.join("");
}
