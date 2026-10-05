import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { AuthLayout } from "#/components/AuthLayout";
import { Button, ErrorNote, Field } from "#/components/ui";
import { useFormAction } from "#/lib/use-form";
import { getSessionFn, loginFn } from "#/server/functions/auth";

export const Route = createFileRoute("/login")({
	validateSearch: z.object({ next: z.string().optional().catch(undefined) }),
	beforeLoad: async () => {
		const session = await getSessionFn();
		if (!session.setupComplete) throw redirect({ to: "/setup" });
		if (session.user) throw redirect({ to: "/app" });
		return { allowSignup: session.allowSignup };
	},
	head: () => ({ meta: [{ title: "Log in · Hootbox" }] }),
	component: LoginPage,
});

/** Only allow same-site relative redirects. */
function safeNext(next?: string) {
	return next?.startsWith("/app") && !next.startsWith("//") ? next : "/app";
}

function LoginPage() {
	const router = useRouter();
	const { next } = Route.useSearch();
	const { allowSignup } = Route.useRouteContext();
	const form = useFormAction(async (data: { email: string; password: string }) => {
		await loginFn({ data });
		await router.navigate({ href: safeNext(next) });
	});
	return (
		<AuthLayout title="Welcome back" subtitle="Your feedback missed you.">
			<form onSubmit={form.onSubmit} className="space-y-4">
				<ErrorNote>{form.error}</ErrorNote>
				<Field label="Email">{(id) => <input id={id} name="email" type="email" className="input" required autoComplete="email" />}</Field>
				<Field label="Password">
					{(id) => <input id={id} name="password" type="password" className="input" required autoComplete="current-password" />}
				</Field>
				<Button type="submit" loading={form.pending} className="w-full mt-2">
					Log in
				</Button>
			</form>
			{allowSignup ? (
				<p className="mt-5 text-sm text-ink-soft text-center">
					New here?{" "}
					<Link to="/signup" className="font-extrabold text-ink underline">
						Create an account
					</Link>
				</p>
			) : (
				<p className="mt-5 text-xs text-ink-soft text-center">Need an account? Ask a workspace admin for an invite link.</p>
			)}
		</AuthLayout>
	);
}
