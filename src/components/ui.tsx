import { Loader2 } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";
import type { FeedbackStatus, FeedbackType } from "#/lib/constants";
import { STATUS_META, TYPE_META } from "#/lib/meta";
import { Owl } from "./Owl";

type Variant = "primary" | "ink" | "sunny" | "mint" | "ghost" | "danger" | "quiet";

export function Button({
	variant = "primary",
	size,
	loading,
	className = "",
	children,
	disabled,
	type = "button",
	...props
}: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "icon"; loading?: boolean }) {
	return (
		<button
			type={type}
			className={`btn btn-${variant} ${size ? `btn-${size}` : ""} ${className}`}
			disabled={disabled || loading}
			{...props}
		>
			{loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
			{children}
		</button>
	);
}

export function Field({
	label,
	hint,
	error,
	children,
	className = "",
}: {
	label: ReactNode;
	hint?: ReactNode;
	error?: string | null;
	children: (id: string) => ReactNode;
	className?: string;
}) {
	const id = useId();
	return (
		<div className={className}>
			<label htmlFor={id} className="label">
				{label}
			</label>
			{children(id)}
			{error ? <p className="mt-1.5 text-xs font-bold text-tomato">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
		</div>
	);
}

export function Toggle({
	checked,
	onChange,
	label,
	description,
	disabled,
}: {
	checked: boolean;
	onChange: (v: boolean) => void;
	label: ReactNode;
	description?: ReactNode;
	disabled?: boolean;
}) {
	const id = useId();
	return (
		<div className="flex items-start justify-between gap-4">
			<div>
				<label htmlFor={id} className="font-extrabold text-sm cursor-pointer">
					{label}
				</label>
				{description && <p className="text-xs text-ink-soft mt-0.5">{description}</p>}
			</div>
			<button
				id={id}
				type="button"
				role="switch"
				aria-checked={checked}
				disabled={disabled}
				onClick={() => onChange(!checked)}
				className={`relative shrink-0 h-7 w-12 rounded-full border-2 border-ink transition-colors cursor-pointer disabled:opacity-50 ${checked ? "bg-mint" : "bg-fog"}`}
			>
				<span
					className={`absolute top-0.5 size-5 rounded-full border-2 border-ink bg-paper transition-[left] duration-200 ${checked ? "left-[22px]" : "left-0.5"}`}
				/>
			</button>
		</div>
	);
}

export function TypeBadge({ type, className = "" }: { type: FeedbackType; className?: string }) {
	const m = TYPE_META[type];
	return (
		<span className={`chip ${m.className} ${className}`}>
			<span aria-hidden>{m.emoji}</span>
			{m.label}
		</span>
	);
}

export function StatusBadge({ status, className = "" }: { status: FeedbackStatus; className?: string }) {
	const m = STATUS_META[status];
	return <span className={`chip ${m.className} ${className}`}>{m.label}</span>;
}

export function Spinner({ className = "" }: { className?: string }) {
	return <Loader2 className={`animate-spin ${className}`} aria-label="Loading" />;
}

export function EmptyState({
	title,
	children,
	mood = "sleepy",
	action,
}: {
	title: ReactNode;
	children?: ReactNode;
	mood?: "happy" | "curious" | "wink" | "sleepy";
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center text-center py-14 px-6">
			<Owl size={88} mood={mood} className="animate-float" />
			<h3 className="mt-4 text-xl font-extrabold">{title}</h3>
			{children && <div className="mt-1.5 max-w-sm text-sm text-ink-soft">{children}</div>}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}

export function ErrorNote({ children }: { children: ReactNode }) {
	if (!children) return null;
	return (
		<div role="alert" className="rounded-2xl border-2 border-ink bg-tomato-soft px-4 py-2.5 text-sm font-bold">
			{children}
		</div>
	);
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-4 mb-6">
			<div>
				<h1 className="text-3xl sm:text-4xl font-extrabold">{title}</h1>
				{subtitle && <p className="mt-1 text-ink-soft">{subtitle}</p>}
			</div>
			{actions && <div className="flex flex-wrap gap-2">{actions}</div>}
		</div>
	);
}
