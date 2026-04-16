import { describe, expect, it } from "vitest";
import {
	getOrderBadgeSizeClass,
	getOrderNumberCompactClass,
} from "../src/views/display/customer-display-parts";

describe("getOrderNumberCompactClass", () => {
	it("keeps single and double digit numbers at the base size", () => {
		expect(getOrderNumberCompactClass(7)).toBe("");
		expect(getOrderNumberCompactClass(42)).toBe("");
	});

	it("compacts three digit numbers so they stay inside the badge", () => {
		expect(getOrderNumberCompactClass(120)).toBe("text-[0.82em] tracking-[-0.045em]");
	});

	it("compacts four digit numbers more aggressively", () => {
		expect(getOrderNumberCompactClass(1005)).toBe("text-[0.64em] tracking-[-0.07em]");
	});
});

describe("getOrderBadgeSizeClass", () => {
	it("uses the compact base diameter for one and two digits", () => {
		expect(getOrderBadgeSizeClass(7)).toBe("w-[1.62em]");
		expect(getOrderBadgeSizeClass(42)).toBe("w-[1.62em]");
	});

	it("widens the badge for three digits", () => {
		expect(getOrderBadgeSizeClass(120)).toBe("w-[1.86em]");
	});
});
