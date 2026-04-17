import { describe, expect, it } from "vitest";
import { getOrderUrgency } from "../src/index.js";

describe("getOrderUrgency", () => {
	it("returns normal when elapsed is well under target", () => {
		expect(getOrderUrgency(17, 20)).toBe("normal");
	});

	it("flips to warning exactly 2 minutes before target", () => {
		expect(getOrderUrgency(18, 20)).toBe("warning");
	});

	it("returns overdue when elapsed equals target", () => {
		expect(getOrderUrgency(20, 20)).toBe("overdue");
	});

	it("returns overdue when elapsed exceeds target", () => {
		expect(getOrderUrgency(25, 20)).toBe("overdue");
	});

	it("scales to target=30 (warning at 28, overdue at 30)", () => {
		expect(getOrderUrgency(27, 30)).toBe("normal");
		expect(getOrderUrgency(28, 30)).toBe("warning");
		expect(getOrderUrgency(30, 30)).toBe("overdue");
	});

	it("accepts a custom buffer", () => {
		expect(getOrderUrgency(14, 20, 5)).toBe("normal");
		expect(getOrderUrgency(15, 20, 5)).toBe("warning");
	});

	it("falls back to normal for invalid inputs", () => {
		expect(getOrderUrgency(Number.NaN, 20)).toBe("normal");
		expect(getOrderUrgency(5, 0)).toBe("normal");
		expect(getOrderUrgency(5, -1)).toBe("normal");
	});
});
