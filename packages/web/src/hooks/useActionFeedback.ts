import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../utils/error";

export type ActionFeedbackStatus = "idle" | "pending" | "success" | "error";

interface UseActionFeedbackOptions {
	resetAfterMs?: number;
}

export function useActionFeedback({ resetAfterMs = 2200 }: UseActionFeedbackOptions = {}) {
	const [status, setStatus] = useState<ActionFeedbackStatus>("idle");
	const [message, setMessage] = useState<string | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearTimer = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	useEffect(() => clearTimer, [clearTimer]);

	const reset = useCallback(() => {
		clearTimer();
		setStatus("idle");
		setMessage(null);
	}, [clearTimer]);

	const setPending = useCallback(
		(nextMessage?: string | null) => {
			clearTimer();
			setStatus("pending");
			setMessage(nextMessage ?? null);
		},
		[clearTimer],
	);

	const setSuccess = useCallback(
		(nextMessage?: string | null) => {
			clearTimer();
			setStatus("success");
			setMessage(nextMessage ?? null);
			timerRef.current = setTimeout(() => {
				setStatus("idle");
				setMessage(null);
			}, resetAfterMs);
		},
		[clearTimer, resetAfterMs],
	);

	const setError = useCallback(
		(error: unknown, fallback: string) => {
			clearTimer();
			setStatus("error");
			setMessage(getErrorMessage(error, fallback));
		},
		[clearTimer],
	);

	return {
		status,
		message,
		isPending: status === "pending",
		isSuccess: status === "success",
		isError: status === "error",
		reset,
		setPending,
		setSuccess,
		setError,
	};
}
