import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { AuthLayout } from "#/components/AuthLayout";
import { Button, ErrorNote, Field } from "#/components/ui";
import { useFormAction } from "#/lib/use-form";
import { getSessionFn, setupFn } from "#/server/functions/auth";

export const Route = createFileRoute("/setup")({
	beforeLoad: async () => {
		const session = await getSessionFn();
		if (session.setupComplete) throw redirect({ to: session.user ? "/app" : "/login" });
	},
	head: () => ({ meta: [{ title: "Welcome · Hootbox" }] }),
	component: SetupPage,
});

function SetupPage() {
	const router = useRouter();
	const form = useFormAction(async (data: { name: string; email: string; password: string; workspaceName: string }) => {
		await setupFn({ data });
		await router.navigate({ to: "/app" });
	});
	return (
		<AuthLayout title="Hoot hoot! 👋" subtitle="Let's set up your Hootbox. You'll be the owner of this instance.">
			<form onSubmit={form.onSubmit} className="space-y-4">
				<ErrorNote>{form.error}</ErrorNote>
				<Field label="Your name">{(id) => <input id={id} name="name" className="input" required autoComplete="name" />}</Field>
				<Field label="Email">{(id) => <input id={id} name="email" type="email" className="input" required autoComplete="email" />}</Field>
				<Field label="Password" hint="At least 8 characters.">
					{(id) => <input id={id} name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />}
				</Field>
				<Field label="Workspace name" hint="Your company or team — you can change it later.">
					{(id) => <input id={id} name="workspaceName" className="input" required placeholder="Acme Inc." />}
				</Field>
				<Button type="submit" loading={form.pending} className="w-full mt-2">
					Create my Hootbox
				</Button>
			</form>
		</AuthLayout>
	);
}
