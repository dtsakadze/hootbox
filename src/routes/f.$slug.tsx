import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { Owl } from "#/components/Owl";
import { PublicFeedbackForm } from "#/components/PublicFeedbackForm";
import { REPO_URL } from "#/lib/constants-app";
import { getFormFn } from "#/server/functions/public";

export const Route = createFileRoute("/f/$slug")({
	validateSearch: z.object({ embed: z.coerce.boolean().optional().catch(false) }),
	loader: async ({ params }) => {
		const form = await getFormFn({ data: { slug: params.slug } });
		if (!form) throw notFound();
		return form;
	},
	head: ({ loaderData }) => ({
		meta: [{ title: loaderData ? `Feedback for ${loaderData.project.name}` : "Feedback" }],
	}),
	component: FormPage,
});

function FormPage() {
	const { project } = Route.useLoaderData();
	const { embed } = Route.useSearch();

	const form = (
		<PublicFeedbackForm
			slug={project.slug}
			source="form"
			types={project.types}
			askEmail={project.askEmail}
			thankYouMessage={project.thankYouMessage}
			color={project.color}
		/>
	);

	if (embed) {
		return <div className="min-h-dvh bg-paper p-5">{form}</div>;
	}

	return (
		<main className="min-h-dvh flex flex-col items-center justify-center px-4 py-12">
			<div className="relative w-full max-w-lg">
				<Owl size={84} mood="curious" color={project.color} className="absolute -top-16 left-1/2 -translate-x-1/2 animate-float" />
				<div className="card p-7 sm:p-9 animate-pop-in">
					<h1 className="text-center text-3xl font-extrabold">
						Help us improve <span className="squiggle">{project.name}</span>
					</h1>
					<p className="mt-2 mb-6 text-center text-ink-soft">We read every message. Seriously.</p>
					{form}
				</div>
			</div>
			<p className="mt-8 text-xs text-ink-faint">
				Powered by{" "}
				<a href={REPO_URL} target="_blank" rel="noreferrer" className="font-bold underline hover:text-ink">
					Hootbox 🦉
				</a>
			</p>
		</main>
	);
}
