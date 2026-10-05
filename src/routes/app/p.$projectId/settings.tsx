import { createFileRoute, getRouteApi, redirect, useRouter } from "@tanstack/react-router";
import { Eye, EyeOff, RefreshCw, Send } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import type { z } from "zod";
import { ColorPicker } from "#/components/ColorPicker";
import { CopyButton } from "#/components/CopyButton";
import { errorMessage, useToast } from "#/components/toast";
import { Button, Field, Toggle } from "#/components/ui";
import { FEEDBACK_TYPES, type FeedbackType, type ProjectColor } from "#/lib/constants";
import { TYPE_META } from "#/lib/meta";
import type { updateProjectSchema } from "#/lib/validation";
import { deleteProjectFn, getProjectFn, rotateSecretFn, sendTestWebhookFn, updateProjectFn } from "#/server/functions/projects";

const projectRoute = getRouteApi("/app/p/$projectId");
type Patch = z.input<typeof updateProjectSchema>;

export const Route = createFileRoute("/app/p/$projectId/settings")({
	beforeLoad: async ({ params }) => {
		const { canManage } = await getProjectFn({ data: { projectId: params.projectId } });
		if (!canManage) throw redirect({ to: "/app/p/$projectId", params });
	},
	component: Settings,
});

function useSaver(projectId: string) {
	const router = useRouter();
	const toast = useToast();
	const [pending, setPending] = useState<string | null>(null);
	async function save(section: string, patch: Patch, message = "Saved!") {
		setPending(section);
		try {
			await updateProjectFn({ data: { projectId, patch } });
			await router.invalidate();
			toast.success(message);
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setPending(null);
		}
	}
	return { save, pending };
}

function Settings() {
	const { project } = projectRoute.useLoaderData();
	const { save, pending } = useSaver(project.id);
	const router = useRouter();
	const toast = useToast();

	const [general, setGeneral] = useState({
		name: project.name,
		slug: project.slug,
		description: project.description,
		color: project.color as ProjectColor,
	});
	const [widget, setWidget] = useState(project.widgetSettings);
	const [origins, setOrigins] = useState(project.allowedOrigins.join("\n"));
	const [webhookUrl, setWebhookUrl] = useState(project.webhookUrl ?? "");
	const [showSecret, setShowSecret] = useState(false);
	const [confirmName, setConfirmName] = useState("");

	const submit = (section: string, patch: Patch) => (e: FormEvent) => {
		e.preventDefault();
		save(section, patch);
	};

	async function rotate(which: "publicKey" | "webhookSecret") {
		const msg =
			which === "publicKey"
				? "Rotate the project key? Your widget and API integrations will stop working until you update the snippet."
				: "Rotate the webhook secret? You'll need to update your signature verification.";
		if (!confirm(msg)) return;
		try {
			await rotateSecretFn({ data: { projectId: project.id, which } });
			await router.invalidate();
			toast.success("Rotated");
		} catch (err) {
			toast.error(errorMessage(err));
		}
	}

	async function testWebhook() {
		try {
			const { ok } = await sendTestWebhookFn({ data: { projectId: project.id } });
			if (ok) toast.success("Test sent — check your channel!");
			else toast.error("The webhook didn't accept our test. Check the URL.");
		} catch (err) {
			toast.error(errorMessage(err));
		}
	}

	async function remove() {
		try {
			await deleteProjectFn({ data: { projectId: project.id } });
			toast.success("Project deleted");
			await router.navigate({ to: "/app" });
			await router.invalidate();
		} catch (err) {
			toast.error(errorMessage(err));
		}
	}

	const toggleType = (t: FeedbackType) =>
		setWidget((w) => ({
			...w,
			types: w.types.includes(t) ? w.types.filter((x) => x !== t) : FEEDBACK_TYPES.filter((x) => x === t || w.types.includes(x)),
		}));

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			<Section title="General" onSubmit={submit("general", general)} pending={pending === "general"}>
				<Field label="Project name">
					{(id) => (
						<input
							id={id}
							className="input"
							value={general.name}
							maxLength={60}
							required
							onChange={(e) => setGeneral({ ...general, name: e.target.value })}
						/>
					)}
				</Field>
				<Field label="Public URL" hint="Used for your public board and form links.">
					{(id) => (
						<div className="flex items-center rounded-2xl border-2 border-ink bg-paper focus-within:border-violet">
							<span className="pl-4 text-sm font-bold text-ink-faint">/b/</span>
							<input
								id={id}
								className="w-full bg-transparent px-1 py-2.5 outline-none"
								value={general.slug}
								maxLength={48}
								required
								onChange={(e) => setGeneral({ ...general, slug: e.target.value.toLowerCase() })}
							/>
						</div>
					)}
				</Field>
				<Field label="Description">
					{(id) => (
						<textarea
							id={id}
							className="input min-h-20"
							maxLength={300}
							value={general.description}
							onChange={(e) => setGeneral({ ...general, description: e.target.value })}
						/>
					)}
				</Field>
				<div>
					<span className="label">Color</span>
					<ColorPicker value={general.color} onChange={(color) => setGeneral({ ...general, color })} />
				</div>
			</Section>

			<Section title="Widget" onSubmit={submit("widget", { widgetSettings: widget })} pending={pending === "widget"}>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field label="Button label">
						{(id) => (
							<input
								id={id}
								className="input"
								value={widget.buttonLabel}
								maxLength={30}
								required
								onChange={(e) => setWidget({ ...widget, buttonLabel: e.target.value })}
							/>
						)}
					</Field>
					<Field label="Position">
						{(id) => (
							<select
								id={id}
								className="input"
								value={widget.position}
								onChange={(e) => setWidget({ ...widget, position: e.target.value as typeof widget.position })}
							>
								<option value="bottom-right">Bottom right</option>
								<option value="bottom-left">Bottom left</option>
							</select>
						)}
					</Field>
				</div>
				<Field label="Ask for email">
					{(id) => (
						<select
							id={id}
							className="input"
							value={widget.askEmail}
							onChange={(e) => setWidget({ ...widget, askEmail: e.target.value as typeof widget.askEmail })}
						>
							<option value="optional">Optional</option>
							<option value="required">Required</option>
							<option value="hidden">Don't ask</option>
						</select>
					)}
				</Field>
				<div>
					<span className="label">Feedback types</span>
					<div className="flex flex-wrap gap-1.5">
						{FEEDBACK_TYPES.map((t) => (
							<button
								key={t}
								type="button"
								aria-pressed={widget.types.includes(t)}
								onClick={() => toggleType(t)}
								className={`chip cursor-pointer py-1 ${widget.types.includes(t) ? TYPE_META[t].className : "bg-paper text-ink-faint line-through"}`}
							>
								{TYPE_META[t].emoji} {TYPE_META[t].label}
							</button>
						))}
					</div>
					<p className="hint">Also used on the public form.</p>
				</div>
				<Field label="Thank-you message">
					{(id) => (
						<input
							id={id}
							className="input"
							value={widget.thankYouMessage}
							maxLength={200}
							required
							onChange={(e) => setWidget({ ...widget, thankYouMessage: e.target.value })}
						/>
					)}
				</Field>
			</Section>

			<Section title="Public board & form">
				<Toggle
					checked={project.boardEnabled}
					disabled={pending !== null}
					onChange={(v) => save("board", { boardEnabled: v })}
					label="Public board"
					description="Show public ideas, votes and a roadmap at /b/your-project."
				/>
				<Toggle
					checked={project.boardSubmissions}
					disabled={pending !== null}
					onChange={(v) => save("board", { boardSubmissions: v })}
					label="Accept public submissions"
					description="Anyone with the link can post via the board and the shareable form."
				/>
				<Toggle
					checked={project.autoPublish}
					disabled={pending !== null}
					onChange={(v) => save("board", { autoPublish: v })}
					label="Publish board posts instantly"
					description="Off = new board posts wait in your inbox until you make them public."
				/>
			</Section>

			<Section
				title="Security"
				onSubmit={submit("origins", { allowedOrigins: origins.split(/[\s,]+/).filter(Boolean) })}
				pending={pending === "origins"}
			>
				<Field label="Allowed websites" hint="One per line, e.g. https://myapp.com. Leave empty to accept the widget on any site.">
					{(id) => (
						<textarea
							id={id}
							className="input min-h-20 font-mono text-sm"
							value={origins}
							onChange={(e) => setOrigins(e.target.value)}
							placeholder="https://myapp.com"
						/>
					)}
				</Field>
				<div>
					<span className="label">Project key</span>
					<div className="flex flex-wrap items-center gap-2">
						<code className="kbd py-1 text-sm">{project.publicKey}</code>
						<CopyButton text={project.publicKey} />
						<Button variant="quiet" size="sm" onClick={() => rotate("publicKey")}>
							<RefreshCw className="size-3.5" /> Rotate
						</Button>
					</div>
				</div>
			</Section>

			<Section
				title="Notifications"
				onSubmit={submit("webhook", { webhookUrl })}
				pending={pending === "webhook"}
				extraActions={
					project.webhookUrl ? (
						<Button variant="ghost" onClick={testWebhook}>
							<Send className="size-4" /> Send test
						</Button>
					) : null
				}
			>
				<Field label="Webhook URL" hint="Slack & Discord webhook URLs get pretty messages. Anything else receives signed JSON.">
					{(id) => (
						<input
							id={id}
							type="url"
							className="input"
							value={webhookUrl}
							onChange={(e) => setWebhookUrl(e.target.value)}
							placeholder="https://hooks.slack.com/services/…"
						/>
					)}
				</Field>
				<div>
					<span className="label">Signing secret</span>
					<div className="flex flex-wrap items-center gap-2">
						<code className="kbd max-w-full truncate py-1 text-sm">{showSecret ? project.webhookSecret : "whsec_••••••••••••••••"}</code>
						<Button variant="quiet" size="sm" onClick={() => setShowSecret(!showSecret)}>
							{showSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
							{showSecret ? "Hide" : "Reveal"}
						</Button>
						<Button variant="quiet" size="sm" onClick={() => rotate("webhookSecret")}>
							<RefreshCw className="size-3.5" /> Rotate
						</Button>
					</div>
					<p className="hint">
						Verify <code>X-Hootbox-Signature</code> = <code>sha256=HMAC(secret, timestamp + "." + body)</code>.
					</p>
				</div>
			</Section>

			<section className="card border-tomato p-6 lg:col-span-2">
				<h2 className="text-lg font-extrabold text-tomato">Danger zone</h2>
				<p className="mt-1 text-sm text-ink-soft">Deleting a project permanently removes all of its feedback, notes and votes.</p>
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<input
						className="input max-w-xs"
						placeholder={`Type "${project.name}" to confirm`}
						value={confirmName}
						onChange={(e) => setConfirmName(e.target.value)}
						aria-label="Confirm project name"
					/>
					<Button variant="danger" disabled={confirmName !== project.name} onClick={remove}>
						Delete project
					</Button>
				</div>
			</section>
		</div>
	);
}

function Section({
	title,
	children,
	onSubmit,
	pending,
	extraActions,
}: {
	title: string;
	children: ReactNode;
	onSubmit?: (e: FormEvent) => void;
	pending?: boolean;
	extraActions?: ReactNode;
}) {
	const body = (
		<>
			<h2 className="text-lg font-extrabold">{title}</h2>
			<div className="mt-4 space-y-4">{children}</div>
			{onSubmit && (
				<div className="mt-5 flex gap-2">
					<Button type="submit" variant="ink" loading={pending}>
						Save
					</Button>
					{extraActions}
				</div>
			)}
		</>
	);
	return onSubmit ? (
		<form onSubmit={onSubmit} className="card p-6">
			{body}
		</form>
	) : (
		<section className="card p-6">{body}</section>
	);
}
