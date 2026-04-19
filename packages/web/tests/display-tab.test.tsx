/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DisplayTab } from "../src/views/admin/tabs/DisplayTab";

vi.mock("../src/views/admin/DisplaySettingsCard", () => ({
	DisplaySettingsCard: () => <div data-testid="display-settings-card">display-settings-card</div>,
}));

vi.mock("../src/views/admin/ui/PageIntro", () => ({
	PageIntro: ({ eyebrow, title }: { eyebrow: string; title: string }) => (
		<div data-testid="page-intro">
			<span>{eyebrow}</span>
			<span>{title}</span>
		</div>
	),
}));

describe("DisplayTab", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
	});

	it("centers the display settings layout within the admin content area", async () => {
		await act(async () => {
			root.render(<DisplayTab />);
		});

		const tabShell = Array.from(container.querySelectorAll("div")).find(
			(node) => node.classList.contains("space-y-6") && node.textContent?.includes("Müşteri Ekranı"),
		);

		expect(tabShell).toBeTruthy();
		expect(tabShell?.classList.contains("mx-auto")).toBe(false);
		expect(tabShell?.classList.contains("max-w-6xl")).toBe(false);
		expect(tabShell?.textContent).toContain("display-settings-card");
	});
});
