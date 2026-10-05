import { type FormEvent, useState } from "react";
import { errorMessage } from "#/components/toast";

/** Minimal form helper: collects FormData into an object and tracks pending/error state. */
export function useFormAction<T extends Record<string, unknown>>(action: (values: T) => Promise<unknown>) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	async function onSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const values = Object.fromEntries(new FormData(e.currentTarget)) as T;
		setPending(true);
		setError(null);
		try {
			await action(values);
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setPending(false);
		}
	}
	return { onSubmit, pending, error, setError };
}
