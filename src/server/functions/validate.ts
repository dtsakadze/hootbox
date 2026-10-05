import type { z } from "zod";
import { AppError } from "../lib/errors";

/** Input validator that reports the first problem as a friendly AppError. */
export function validate<T extends z.ZodType>(schema: T) {
	return (input: unknown): z.output<T> => {
		const result = schema.safeParse(input);
		if (!result.success) {
			const issue = result.error.issues[0];
			throw new AppError("BAD_REQUEST", issue?.message ?? "Invalid input");
		}
		return result.data;
	};
}
