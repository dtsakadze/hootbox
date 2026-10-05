import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { AuthLayout } from "#/components/AuthLayout";
import { Button, ErrorNote, Field } from "#/components/ui";
import { useFormAction } from "#/lib/use-form";
import { getSessionFn, signUpFn } from "#/server/functions/auth";

/** Only reachable when an extension enables open sign-ups (e.g. the hosted edition). */
export const Route = createFileRoute("/signup")({
	beforeLoad: async () => {
		const session = await getSessionFn();
		if (!session.setupComplete) throw redirect({ to: "/setup" });
		if (session.user) throw redirect({ to: "/app" });
		if (!session.allowSignup) throw redirect({ to: "/login" });
	},
	head: () => ({ meta: [{ title: "Sign up · Hootbox" }] }),
	component: SignUpPage,
});

function SignUpPage() {
	const router = useRouter();
	const form = useFormAction(async (data: { name: string; email: string; password: string; workspaceName: string }) => {
		await signUpFn({ data });
		await router.navigate({ to: "/app" });
	});
	return (
		<AuthLayout title="Create your account" subtitle="Start collecting feedback in a minute." color="mint">
			<form onSubmit={form.onSubmit} className="space-y-4">
				<ErrorNote>{form.error}</ErrorNote>
				<Field label="Your name">{(id) => <input id={id} name="name" className="input" required autoComplete="name" />}</Field>
				<Field label="Email">{(id) => <input id={id} name="email" type="email" className="input" required autoComplete="email" />}</Field>
				<Field label="Password" hint="At least 8 characters.">
					{(id) => <input id={id} name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />}
				</Field>
				<Field label="Workspace name">
					{(id) => <input id={id} name="workspaceName" className="input" required placeholder="Acme Inc." />}
				</Field>
				<Button type="submit" variant="mint" loading={form.pending} className="w-full mt-2">
					Create account
				</Button>
			</form>
			<p className="mt-5 text-sm text-ink-soft text-center">
				Already have an account?{" "}
				<Link to="/login" className="font-extrabold text-ink underline">
					Log in
				</Link>
			</p>
		</AuthLayout>
	);
}
