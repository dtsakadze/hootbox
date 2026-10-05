import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ToastProvider } from "#/components/toast";
import appCss from "../styles.css?url";

const FAVICON = `data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="M18 62C18 32 38 18 60 18s42 14 42 44v24c0 18-18 26-42 26s-42-8-42-26z" fill="#7b61ff" stroke="#1e1b2e" stroke-width="6"/><circle cx="41" cy="54" r="14" fill="#fff" stroke="#1e1b2e" stroke-width="5"/><circle cx="79" cy="54" r="14" fill="#fff" stroke="#1e1b2e" stroke-width="5"/><circle cx="43" cy="56" r="6" fill="#1e1b2e"/><circle cx="81" cy="56" r="6" fill="#1e1b2e"/><path d="M52 66h16l-8 12z" fill="#ffc83d" stroke="#1e1b2e" stroke-width="4" stroke-linejoin="round"/></svg>`,
)}`;

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Hootbox — friendly feedback collection" },
			{ name: "description", content: "Collect, organise and act on feedback from your users." },
			{ name: "theme-color", content: "#fff8e7" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: FAVICON },
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<ToastProvider>{children}</ToastProvider>
				<Scripts />
			</body>
		</html>
	);
}
