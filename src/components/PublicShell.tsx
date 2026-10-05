import type { ReactNode } from "react";
import { REPO_URL } from "#/lib/constants-app";
import { colorMeta } from "#/lib/meta";
import { Owl } from "./Owl";

export function PublicShell({ project, children }: { project: { name: string; description: string; color: string }; children: ReactNode }) {
	const c = colorMeta(project.color);
	return (
		<div className="min-h-dvh">
			<header className={`border-b-2 border-ink ${c.bg}`}>
				<div className="mx-auto flex max-w-4xl items-center gap-5 px-4 py-10 sm:py-14">
					<div className="grid size-20 shrink-0 place-items-center rounded-[26px] border-2 border-ink bg-paper shadow-pop -rotate-3">
						<Owl size={60} color={project.color} mood="happy" />
					</div>
					<div className="min-w-0">
						<h1 className="text-3xl font-extrabold sm:text-5xl">{project.name}</h1>
						{project.description && <p className="mt-2 max-w-xl text-base font-semibold sm:text-lg">{project.description}</p>}
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
			<footer className="pb-10 text-center text-xs text-ink-faint">
				Powered by{" "}
				<a href={REPO_URL} target="_blank" rel="noreferrer" className="font-bold underline hover:text-ink">
					Hootbox 🦉
				</a>
			</footer>
		</div>
	);
}
