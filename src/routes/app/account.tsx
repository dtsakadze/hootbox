import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { useRef } from "react";
import { useToast } from "#/components/toast";
import { Button, ErrorNote, Field, PageHeader } from "#/components/ui";
import { useFormAction } from "#/lib/use-form";
import { changePasswordFn, logoutFn, updateProfileFn } from "#/server/functions/auth";

const appRoute = getRouteApi("/app");

export const Route = createFileRoute("/app/account")({
	head: () => ({ meta: [{ title: "Account · Hootbox" }] }),
	component: Account,
});

function Account() {
	const { user } = appRoute.useRouteContext();
	const router = useRouter();
	const toast = useToast();
	const pwForm = useRef<HTMLFormElement>(null);

	const profile = useFormAction(async (data: { name: string; email: string }) => {
		await updateProfileFn({ data });
		await router.invalidate();
		toast.success("Profile updated");
	});
	const password = useFormAction(async (data: { currentPassword: string; newPassword: string }) => {
		await changePasswordFn({ data });
		pwForm.current?.reset();
		toast.success("Password changed. Other devices were signed out.");
	});

	return (
		<div className="mx-auto max-w-2xl">
			<PageHeader title="Your account" />
			<div className="space-y-6">
				<form onSubmit={profile.onSubmit} className="card space-y-4 p-6">
					<h2 className="text-lg font-extrabold">Profile</h2>
					<ErrorNote>{profile.error}</ErrorNote>
					<Field label="Name">
						{(id) => <input id={id} name="name" className="input" defaultValue={user.name} required maxLength={80} autoComplete="name" />}
					</Field>
					<Field label="Email">
						{(id) => <input id={id} name="email" type="email" className="input" defaultValue={user.email} required autoComplete="email" />}
					</Field>
					<Button type="submit" variant="ink" loading={profile.pending}>
						Save profile
					</Button>
				</form>

				<form ref={pwForm} onSubmit={password.onSubmit} className="card space-y-4 p-6">
					<h2 className="text-lg font-extrabold">Password</h2>
					<ErrorNote>{password.error}</ErrorNote>
					<Field label="Current password">
						{(id) => <input id={id} name="currentPassword" type="password" className="input" required autoComplete="current-password" />}
					</Field>
					<Field label="New password" hint="At least 8 characters.">
						{(id) => (
							<input id={id} name="newPassword" type="password" className="input" required minLength={8} autoComplete="new-password" />
						)}
					</Field>
					<Button type="submit" variant="ink" loading={password.pending}>
						Change password
					</Button>
				</form>

				<div className="card flex flex-wrap items-center justify-between gap-3 p-6">
					<div>
						<h2 className="text-lg font-extrabold">Sign out</h2>
						<p className="text-sm text-ink-soft">End your session on this device.</p>
					</div>
					<Button
						variant="ghost"
						onClick={async () => {
							await logoutFn();
							await router.navigate({ to: "/login" });
						}}
					>
						Log out
					</Button>
				</div>
			</div>
		</div>
	);
}
