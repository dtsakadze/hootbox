import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { AuthLayout } from "#/components/AuthLayout";
import { Button, ErrorNote, Field } from "#/components/ui";
import { useFormAction } from "#/lib/use-form";
import { acceptInviteFn, getInviteFn } from "#/server/functions/auth";

export const Route = createFileRoute("/invite/$token")({
	loader: ({ params }) => getInviteFn({ data: { token: params.token } }),
	head: () => ({ meta: [{ title: "Join · Hootbox" }, { name: "robots", content: "noindex" }] }),
	component: InvitePage,
});

function InvitePage() {
	const invite = Route.useLoaderData();
	const { token } = Route.useParams();
	const router = useRouter();
	const form = useFormAction(async (data: { name: string; email: string; password: string }) => {
		await acceptInviteFn({ data: { ...data, token } });
		await router.navigate({ to: "/app" });
	});

	if (!invite) {
		return (
			<AuthLayout title="Invite expired" subtitle="This invite link is invalid, expired, or already used." color="tomato">
				<p className="text-sm text-ink-soft">Ask your teammate for a fresh link.</p>
				<Link to="/login" className="btn btn-ghost mt-5 w-full">
					Go to login
				</Link>
			</AuthLayout>
		);
	}
	return (
		<AuthLayout
			title={`Join ${invite.workspaceName}`}
			subtitle={`You've been invited as ${invite.role === "member" ? "a member" : `an ${invite.role}`}. Create your account to hop in.`}
			color="mint"
		>
			<form onSubmit={form.onSubmit} className="space-y-4">
				<ErrorNote>{form.error}</ErrorNote>
				<Field label="Your name">{(id) => <input id={id} name="name" className="input" required autoComplete="name" />}</Field>
				<Field label="Email">{(id) => <input id={id} name="email" type="email" className="input" required autoComplete="email" />}</Field>
				<Field label="Password" hint="At least 8 characters.">
					{(id) => <input id={id} name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />}
				</Field>
				<Button type="submit" variant="mint" loading={form.pending} className="w-full mt-2">
					Join the team
				</Button>
			</form>
		</AuthLayout>
	);
}
