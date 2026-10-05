import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router";
import { Owl } from "./Owl";

export function NotFoundPage() {
	return (
		<div className="min-h-[70dvh] grid place-items-center p-6">
			<div className="card max-w-md p-10 text-center animate-pop-in">
				<Owl size={96} mood="sleepy" className="mx-auto" />
				<h1 className="mt-4 text-3xl font-extrabold">Nothing to see here</h1>
				<p className="mt-2 text-ink-soft">This page flew away (or never existed).</p>
				<Link to="/" className="btn btn-primary mt-6">
					Take me home
				</Link>
			</div>
		</div>
	);
}

export function ErrorPage({ error, reset }: ErrorComponentProps) {
	const router = useRouter();
	return (
		<div className="min-h-[70dvh] grid place-items-center p-6">
			<div className="card max-w-md p-10 text-center animate-pop-in">
				<Owl size={96} mood="curious" color="tomato" className="mx-auto" />
				<h1 className="mt-4 text-3xl font-extrabold">Oops, a hiccup</h1>
				<p className="mt-2 text-ink-soft">{(error as Error | undefined)?.message || "Something went wrong."}</p>
				<button
					type="button"
					className="btn btn-ink mt-6"
					onClick={() => {
						reset();
						router.invalidate();
					}}
				>
					Try again
				</button>
			</div>
		</div>
	);
}
