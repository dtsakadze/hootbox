import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { ErrorPage, NotFoundPage } from "./components/ErrorPages";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	return createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultErrorComponent: ErrorPage,
		defaultNotFoundComponent: NotFoundPage,
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
