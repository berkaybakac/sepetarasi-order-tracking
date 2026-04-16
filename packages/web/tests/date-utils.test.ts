import { afterEach, describe, expect, it, vi } from "vitest";
import { formatAverageDeliveryMinutes, getDeliveredOrderDurationLabel } from "../src/utils/date";

describe("delivery duration helpers", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("keeps delivered duration fixed even if current time moves forward", () => {
		const createdAt = "2026-04-16T00:16:00.000Z";
		const deliveredAt = "2026-04-16T00:23:18.000Z";

		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-16T00:24:00.000Z"));
		expect(getDeliveredOrderDurationLabel(createdAt, deliveredAt)).toBe("7 dk 18 sn");

		vi.setSystemTime(new Date("2026-04-16T00:45:00.000Z"));
		expect(getDeliveredOrderDurationLabel(createdAt, deliveredAt)).toBe("7 dk 18 sn");
	});

	it("formats short deliveries in seconds", () => {
		expect(
			getDeliveredOrderDurationLabel("2026-04-16T00:16:00.000Z", "2026-04-16T00:16:45.000Z"),
		).toBe("45 sn");
	});

	it("formats deliveries longer than one hour with hour and minute parts", () => {
		expect(
			getDeliveredOrderDurationLabel("2026-04-16T00:16:00.000Z", "2026-04-16T01:18:59.000Z"),
		).toBe("1 sa 02 dk");
	});

	it("falls back to updated_at when delivered_at is missing and clamps negatives", () => {
		expect(
			getDeliveredOrderDurationLabel("2026-04-16T00:16:00.000Z", null, "2026-04-16T00:23:18.000Z"),
		).toBe("7 dk 18 sn");

		expect(
			getDeliveredOrderDurationLabel("2026-04-16T00:16:00.000Z", null, "2026-04-16T00:15:59.000Z"),
		).toBe("0 sn");
	});

	it("formats average delivery seconds as compact minutes", () => {
		expect(formatAverageDeliveryMinutes(1038)).toBe("17.3");
		expect(formatAverageDeliveryMinutes(1020)).toBe("17");
		expect(formatAverageDeliveryMinutes(null)).toBeNull();
	});
});
