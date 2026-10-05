import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Link2, Trash2, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { CodeBlock } from "#/components/CopyButton";
import { errorMessage, useToast } from "#/components/toast";
import { Button, PageHeader } from "#/components/ui";
import { MEMBER_ROLES, type MemberRole } from "#/lib/constants";
import { initials, timeAgo } from "#/lib/meta";
import { createInviteFn, getTeamFn, removeMemberFn, renameWorkspaceFn, revokeInviteFn, updateRoleFn } from "#/server/functions/team";

export const Route = createFileRoute("/app/team")({
	loader: () => getTeamFn(),
	head: () => ({ meta: [{ title: "Team · Hootbox" }] }),
	component: Team,
});

const ROLE_HELP: Record<MemberRole, string> = {
	owner: "Everything, including managing owners",
	admin: "Manage projects, settings and members",
	member: "Triage feedback, add notes and tags",
};

function Team() {
	const team = Route.useLoaderData();
	const router = useRouter();
	const toast = useToast();
	const isAdmin = team.role !== "member";
	const [wsName, setWsName] = useState(team.workspace.name);
	const [inviteRole, setInviteRole] = useState<MemberRole>("member");
	const [inviteNote, setInviteNote] = useState("");
	const [inviteUrl, setInviteUrl] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function run(fn: () => Promise<unknown>, success?: string) {
		setBusy(true);
		try {
			await fn();
			await router.invalidate();
			if (success) toast.success(success);
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	const invite = (e: FormEvent) => {
		e.preventDefault();
		run(async () => {
			const { url } = await createInviteFn({ data: { role: inviteRole, note: inviteNote || undefined } });
			setInviteUrl(url);
			setInviteNote("");
		}, "Invite link created");
	};

	const remove = (userId: string, name: string) => {
		const self = userId === team.me;
		if (!confirm(self ? "Leave this workspace? You'll lose access." : `Remove ${name} from the workspace?`)) return;
		run(
			async () => {
				await removeMemberFn({ data: { userId } });
				if (self) await router.navigate({ to: "/login" });
			},
			self ? undefined : "Member removed",
		);
	};

	return (
		<>
			<PageHeader title="Team" subtitle="Everyone here can see all projects in this workspace." />
			<div className="grid gap-6 lg:grid-cols-[1fr_380px]">
				<section className="card p-6">
					<h2 className="mb-4 text-lg font-extrabold">Members ({team.members.length})</h2>
					<ul className="divide-y-2 divide-ink/10">
						{team.members.map((m) => (
							<li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
								<span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-mint-soft text-sm font-extrabold">
									{initials(m.name)}
								</span>
								<div className="min-w-0 flex-1">
									<p className="truncate font-extrabold">
										{m.name} {m.userId === team.me && <span className="text-xs font-bold text-ink-soft">(you)</span>}
									</p>
									<p className="truncate text-sm text-ink-soft">{m.email}</p>
								</div>
								{isAdmin && m.userId !== team.me ? (
									<select
										aria-label={`Role for ${m.name}`}
										className="input w-auto py-1.5 text-sm"
										value={m.role}
										disabled={busy}
										onChange={(e) =>
											run(() => updateRoleFn({ data: { userId: m.userId, role: e.target.value as MemberRole } }), "Role updated")
										}
									>
										{MEMBER_ROLES.map((r) => (
											<option key={r} value={r}>
												{r[0].toUpperCase() + r.slice(1)}
											</option>
										))}
									</select>
								) : (
									<span className="chip bg-fog capitalize">{m.role}</span>
								)}
								{(isAdmin || m.userId === team.me) && (
									<Button
										variant="quiet"
										size="sm"
										onClick={() => remove(m.userId, m.name)}
										aria-label={m.userId === team.me ? "Leave workspace" : `Remove ${m.name}`}
										title={m.userId === team.me ? "Leave" : "Remove"}
									>
										<Trash2 className="size-4" />
									</Button>
								)}
							</li>
						))}
					</ul>
				</section>

				<div className="space-y-6">
					{isAdmin && (
						<form onSubmit={invite} className="card bg-violet-soft p-6">
							<h2 className="flex items-center gap-2 text-lg font-extrabold">
								<UserPlus className="size-5" /> Invite a teammate
							</h2>
							<p className="mt-1 text-sm text-ink-soft">Create a single-use link (valid for 7 days) and send it however you like.</p>
							<div className="mt-4 space-y-3">
								<select
									aria-label="Role"
									className="input"
									value={inviteRole}
									onChange={(e) => setInviteRole(e.target.value as MemberRole)}
								>
									{MEMBER_ROLES.filter((r) => r !== "owner" || team.role === "owner").map((r) => (
										<option key={r} value={r}>
											{r[0].toUpperCase() + r.slice(1)}: {ROLE_HELP[r]}
										</option>
									))}
								</select>
								<input
									className="input"
									value={inviteNote}
									maxLength={100}
									onChange={(e) => setInviteNote(e.target.value)}
									placeholder="Who's it for? (optional)"
									aria-label="Note"
								/>
								<Button type="submit" loading={busy} className="w-full">
									<Link2 className="size-4" /> Create invite link
								</Button>
							</div>
							{inviteUrl && (
								<div className="mt-4 animate-pop-in">
									<CodeBlock code={inviteUrl} />
								</div>
							)}
						</form>
					)}

					{isAdmin && team.invites.length > 0 && (
						<section className="card p-6">
							<h2 className="mb-3 text-lg font-extrabold">Pending invites</h2>
							<ul className="space-y-2">
								{team.invites.map((i) => (
									<li key={i.id} className="flex items-center gap-2 text-sm">
										<span className="chip bg-fog capitalize">{i.role}</span>
										<span className="min-w-0 flex-1 truncate">{i.note || "Invite"}</span>
										<span className="text-xs text-ink-soft">expires {timeAgo(i.expiresAt)}</span>
										<Button
											variant="quiet"
											size="sm"
											onClick={() => run(() => revokeInviteFn({ data: { inviteId: i.id } }), "Invite revoked")}
										>
											Revoke
										</Button>
									</li>
								))}
							</ul>
						</section>
					)}

					{isAdmin && (
						<form
							className="card p-6"
							onSubmit={(e) => {
								e.preventDefault();
								run(() => renameWorkspaceFn({ data: { name: wsName } }), "Workspace renamed");
							}}
						>
							<h2 className="mb-3 text-lg font-extrabold">Workspace name</h2>
							<div className="flex gap-2">
								<input
									className="input"
									value={wsName}
									maxLength={80}
									required
									onChange={(e) => setWsName(e.target.value)}
									aria-label="Workspace name"
								/>
								<Button type="submit" variant="ink" disabled={busy || wsName === team.workspace.name}>
									Save
								</Button>
							</div>
						</form>
					)}
				</div>
			</div>
		</>
	);
}
