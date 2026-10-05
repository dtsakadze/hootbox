import { CheckCircle2, XCircle } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: number; kind: "success" | "error"; message: string };
type ToastApi = { success: (m: string) => void; error: (m: string) => void };

const ToastContext = createContext<ToastApi>({ success: () => {}, error: () => {} });

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const push = useCallback((kind: Toast["kind"], message: string) => {
		const id = nextId++;
		setToasts((t) => [...t.slice(-3), { id, kind, message }]);
		setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3000);
	}, []);
	const api = useMemo<ToastApi>(() => ({ success: (m) => push("success", m), error: (m) => push("error", m) }), [push]);
	return (
		<ToastContext.Provider value={api}>
			{children}
			<div
				aria-live="polite"
				className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none"
			>
				{toasts.map((t) => (
					<div
						key={t.id}
						className={`animate-pop-in pointer-events-auto flex items-center gap-2 rounded-full border-2 border-ink px-4 py-2 text-sm font-extrabold shadow-pop ${t.kind === "success" ? "bg-mint" : "bg-tomato text-white"}`}
					>
						{t.kind === "success" ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
						{t.message}
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export const useToast = () => useContext(ToastContext);

export function errorMessage(err: unknown) {
	if (err instanceof Error && err.message) return err.message;
	return "Something went wrong. Please try again.";
}
