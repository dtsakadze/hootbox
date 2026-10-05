import type { ReactNode } from "react";
import { REPO_URL } from "#/lib/constants-app";
import { Logo, Owl } from "./Owl";

export function AuthLayout({ title, subtitle, children, color = "violet" }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; color?: string }) {
	return (
		<main className="min-h-dvh flex flex-col items-center justify-center px-4 py-10">
			<Logo className="mb-6" />
			<div className="relative w-full max-w-md">
				<Owl size={76} mood="curious" color={color} className="absolute -top-14 right-6 animate-float" />
				<div className="card p-7 sm:p-9 animate-pop-in">
					<h1 className="text-3xl font-extrabold">{title}</h1>
					{subtitle && <p className="mt-1.5 text-ink-soft">{subtitle}</p>}
					<div className="mt-6">{children}</div>
				</div>
			</div>
			<p className="mt-8 text-xs text-ink-faint">
				Powered by{" "}
				<a className="underline hover:text-ink" href={REPO_URL} target="_blank" rel="noreferrer">
					Hootbox
				</a>{" "}
				· open-source feedback
			</p>
		</main>
	);
}
