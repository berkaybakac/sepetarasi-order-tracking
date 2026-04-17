import { useEffect } from "react";

const APP_BOOT_ELEMENT_ID = "app-boot";
const APP_SHELL_STATE = "data-app-shell";
const DEFAULT_MIN_VISIBLE_MS = 650;
const DEFAULT_MAX_VISIBLE_MS = 12_500;
const EXIT_TRANSITION_MS = 360;

let bootStartedAt = getTimestamp();
let hideScheduled = false;
let hideTimerId: number | null = null;
let removeTimerId: number | null = null;

interface BootScreenOptions {
	minVisibleMs?: number;
	maxVisibleMs?: number;
	disabled?: boolean;
}

function getTimestamp() {
	return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function getElapsedMs() {
	return Math.max(0, getTimestamp() - bootStartedAt);
}

function getBootElement() {
	if (typeof document === "undefined") return null;
	return document.getElementById(APP_BOOT_ELEMENT_ID);
}

function markShellReady() {
	if (typeof document === "undefined") return;
	document.documentElement.setAttribute(APP_SHELL_STATE, "ready");
}

function removeBootElementImmediately() {
	const bootElement = getBootElement();
	if (!bootElement) return;
	bootElement.setAttribute("data-state", "hidden");
	bootElement.setAttribute("aria-hidden", "true");
	bootElement.remove();
}

export function hideBootScreen({
	minVisibleMs = DEFAULT_MIN_VISIBLE_MS,
}: Pick<BootScreenOptions, "minVisibleMs"> = {}) {
	if (typeof window === "undefined") return;
	if (hideScheduled) return;

	hideScheduled = true;

	const delay = Math.max(0, minVisibleMs - getElapsedMs());
	hideTimerId = window.setTimeout(() => {
		hideTimerId = null;
		const bootElement = getBootElement();

		markShellReady();

		if (!bootElement) return;

		window.requestAnimationFrame(() => {
			bootElement.setAttribute("data-state", "leaving");
			bootElement.setAttribute("aria-hidden", "true");

			removeTimerId = window.setTimeout(() => {
				removeTimerId = null;
				bootElement.setAttribute("data-state", "hidden");
				bootElement.remove();
			}, EXIT_TRANSITION_MS);
		});
	}, delay);
}

export function useBootScreenReady(
	ready: boolean,
	{
		minVisibleMs = DEFAULT_MIN_VISIBLE_MS,
		maxVisibleMs = DEFAULT_MAX_VISIBLE_MS,
		disabled = false,
	}: BootScreenOptions = {},
) {
	useEffect(() => {
		if (typeof window === "undefined") return undefined;

		if (disabled) {
			markShellReady();
			removeBootElementImmediately();
			return undefined;
		}

		const remainingUntilFallback = Math.max(0, maxVisibleMs - getElapsedMs());
		const fallbackTimerId = window.setTimeout(() => {
			hideBootScreen({ minVisibleMs });
		}, remainingUntilFallback);

		if (ready) {
			hideBootScreen({ minVisibleMs });
		}

		return () => {
			window.clearTimeout(fallbackTimerId);
		};
	}, [disabled, maxVisibleMs, minVisibleMs, ready]);
}

export function resetBootScreenForTests() {
	if (hideTimerId !== null && typeof window !== "undefined") {
		window.clearTimeout(hideTimerId);
	}
	if (removeTimerId !== null && typeof window !== "undefined") {
		window.clearTimeout(removeTimerId);
	}

	bootStartedAt = getTimestamp();
	hideScheduled = false;
	hideTimerId = null;
	removeTimerId = null;

	if (typeof document === "undefined") return;

	document.documentElement.setAttribute(APP_SHELL_STATE, "booting");
	getBootElement()?.setAttribute("data-state", "visible");
}
