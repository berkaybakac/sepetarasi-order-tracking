export type StructuredLogLevel = "info" | "warn" | "error";

export interface TextChangeSummary {
	field: string;
	encoding: string;
	codePage: number;
	originalLength: number;
	renderedLength: number;
	changedCharacterCount: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object") return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function countChangedCharacters(original: string, rendered: string): number {
	const maxLength = Math.max(original.length, rendered.length);
	let changed = 0;
	for (let i = 0; i < maxLength; i += 1) {
		if (original[i] !== rendered[i]) changed += 1;
	}
	return changed;
}

export function summarizeTextChange(
	field: string,
	encoding: string,
	codePage: number,
	original: string,
	rendered: string,
): TextChangeSummary {
	return {
		field,
		encoding,
		codePage,
		originalLength: original.length,
		renderedLength: rendered.length,
		changedCharacterCount: countChangedCharacters(original, rendered),
	};
}

export function serializeLogError(error: unknown): Record<string, unknown> | string | null {
	if (error == null) return null;

	if (error instanceof Error) {
		const serialized: Record<string, unknown> = {
			name: error.name,
			message: error.message,
		};
		if (error.stack) serialized.stack = error.stack;
		const code = Reflect.get(error, "code");
		if (typeof code === "string" || typeof code === "number") {
			serialized.code = code;
		}
		return serialized;
	}

	if (typeof error === "string") return error;
	if (typeof error === "number" || typeof error === "boolean") return String(error);
	const sanitized = sanitizeLogValue(error);
	if (sanitized == null) return null;
	if (typeof sanitized === "string") return sanitized;
	if (typeof sanitized === "object") return sanitized as Record<string, unknown>;
	return String(sanitized);
}

export function sanitizeLogValue(value: unknown, depth = 0): unknown {
	if (value == null) return value;
	if (depth >= 4) return "[truncated]";

	if (value instanceof Error) {
		return serializeLogError(value);
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (typeof value === "bigint") {
		return value.toString();
	}

	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value;
	}

	if (Array.isArray(value)) {
		return value.slice(0, 20).map((item) => sanitizeLogValue(item, depth + 1));
	}

	if (isPlainObject(value)) {
		const entries = Object.entries(value).slice(0, 30);
		return Object.fromEntries(
			entries.map(([key, entryValue]) => [key, sanitizeLogValue(entryValue, depth + 1)]),
		);
	}

	return String(value);
}
