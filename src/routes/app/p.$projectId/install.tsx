import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { Code2, ExternalLink, LayoutList, Link2, Megaphone, Sparkles, Terminal } from "lucide-react";
import type { ReactNode } from "react";
import { CodeBlock, CopyButton } from "#/components/CopyButton";

const projectRoute = getRouteApi("/app/p/$projectId");

export const Route = createFileRoute("/app/p/$projectId/install")({
	component: Install,
});

function Install() {
	const { project, appUrl, canManage } = projectRoute.useLoaderData();
	const boardUrl = `${appUrl}/b/${project.slug}`;
	const formUrl = `${appUrl}/f/${project.slug}`;

	const snippet = `<script src="${appUrl}/widget.js" data-key="${project.publicKey}" defer></script>`;
	const jsApi = `// Open the widget from your own button
<button data-hootbox>Send feedback</button>

// …or from code, optionally pre-selecting a type
Hootbox.open({ type: "bug" });

// Attach who's talking + any context (shown in your inbox)
Hootbox.identify({ email: "jane@acme.com", name: "Jane" });
Hootbox.setMetadata({ plan: "pro", appVersion: "2.4.1" });`;
	const iframe = `<iframe src="${formUrl}?embed=1" width="100%" height="560" style="border:0" title="Feedback"></iframe>`;
	const curl = `curl -X POST ${appUrl}/api/v1/feedback \\
  -H "content-type: application/json" \\
  -d '{
    "key": "${project.publicKey}",
    "type": "bug",
    "message": "The export button does nothing",
    "email": "jane@acme.com",
    "rating": 2,
    "metadata": { "plan": "pro" }
  }'`;

	return (
		<div className="space-y-6">
			<Step icon={<Code2 className="size-5" />} title="Add the widget to your site" tint="bg-violet-soft" badge="Most popular">
				<p className="mb-3 text-sm text-ink-soft">
					Paste this before <code className="kbd">&lt;/body&gt;</code>. A friendly feedback button appears in the corner — tweak its label,
					position and fields in{" "}
					{canManage ? (
						<Link to="/app/p/$projectId/settings" params={{ projectId: project.id }} className="font-bold underline">
							settings
						</Link>
					) : (
						"settings"
					)}
					.
				</p>
				<CodeBlock code={snippet} />
				<button type="button" className="btn btn-sunny mt-3" onClick={() => previewWidget(project.publicKey)}>
					<Sparkles className="size-4" /> Preview the widget here
				</button>
				<details className="mt-4 group">
					<summary className="cursor-pointer text-sm font-extrabold">Custom triggers & JavaScript API</summary>
					<div className="mt-3">
						<CodeBlock code={jsApi} />
						<p className="hint">
							Add <code className="kbd">data-hide-button</code> to the script tag to hide the floating button and use only your own
							triggers.
						</p>
					</div>
				</details>
			</Step>

			<div className="grid gap-6 lg:grid-cols-2">
				<Step icon={<LayoutList className="size-5" />} title="Public board & roadmap" tint="bg-sunny-soft">
					<p className="mb-3 text-sm text-ink-soft">Let users post ideas, upvote, and see what you're working on.</p>
					{project.boardEnabled ? (
						<LinkRow url={boardUrl} />
					) : (
						<p className="rounded-2xl bg-fog px-3 py-2 text-sm font-bold">The public board is turned off in settings.</p>
					)}
				</Step>
				<Step icon={<Link2 className="size-5" />} title="Shareable feedback form" tint="bg-mint-soft">
					<p className="mb-3 text-sm text-ink-soft">A standalone page — perfect for emails, QR codes, or support replies.</p>
					{project.boardSubmissions ? (
						<>
							<LinkRow url={formUrl} />
							<details className="mt-3">
								<summary className="cursor-pointer text-sm font-extrabold">Embed with an iframe</summary>
								<div className="mt-3">
									<CodeBlock code={iframe} />
								</div>
							</details>
						</>
					) : (
						<p className="rounded-2xl bg-fog px-3 py-2 text-sm font-bold">Public submissions are turned off in settings.</p>
					)}
				</Step>
			</div>

			<Step icon={<Terminal className="size-5" />} title="Send feedback from anywhere (REST API)" tint="bg-sky-soft">
				<p className="mb-3 text-sm text-ink-soft">
					Submit from your backend, mobile app, CLI or Zapier. The project key is public — it can only <em>create</em> feedback.
				</p>
				<CodeBlock code={curl} />
			</Step>

			<Step icon={<Megaphone className="size-5" />} title="Get notified" tint="bg-bubblegum-soft">
				<p className="text-sm text-ink-soft">
					Paste a Slack, Discord or any webhook URL in{" "}
					{canManage ? (
						<Link to="/app/p/$projectId/settings" params={{ projectId: project.id }} className="font-bold underline">
							settings
						</Link>
					) : (
						"settings"
					)}{" "}
					and we'll ping you on every new piece of feedback.
				</p>
			</Step>
		</div>
	);
}

declare global {
	interface Window {
		Hootbox?: { open: (opts?: { type?: string }) => void };
	}
}

/** Loads the real widget into the dashboard so admins can try it out. */
function previewWidget(key: string) {
	if (window.Hootbox) return window.Hootbox.open();
	const s = document.createElement("script");
	s.src = "/widget.js";
	s.dataset.key = key;
	s.setAttribute("data-hide-button", "");
	s.onload = () => window.Hootbox?.open();
	document.body.appendChild(s);
}

function Step({
	icon,
	title,
	tint,
	badge,
	children,
}: {
	icon: ReactNode;
	title: string;
	tint: string;
	badge?: string;
	children: ReactNode;
}) {
	return (
		<section className="card p-6">
			<div className="mb-3 flex items-center gap-3">
				<span className={`grid size-10 place-items-center rounded-2xl border-2 border-ink ${tint}`}>{icon}</span>
				<h2 className="text-lg font-extrabold">{title}</h2>
				{badge && <span className="chip bg-sunny ml-auto">{badge}</span>}
			</div>
			{children}
		</section>
	);
}

function LinkRow({ url }: { url: string }) {
	return (
		<div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-ink bg-paper p-2 pl-4">
			<span className="min-w-0 flex-1 truncate font-mono text-sm">{url}</span>
			<CopyButton text={url} />
			<a href={url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ink">
				Open <ExternalLink className="size-3.5" />
			</a>
		</div>
	);
}
