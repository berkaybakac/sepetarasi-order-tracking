import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppDatabase } from "../src/db/connection.js";
import { terminals } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";

let db: AppDatabase;
let app: FastifyInstance;

beforeEach(async () => {
	db = createTestDb();
	db.insert(terminals).values({ id: "t-1", name: "Kasa 1", type: "kasa", is_active: 1 }).run();
	app = await buildApp({ db, disableWorker: true, disableStatic: true });
});

afterEach(async () => {
	await app.close();
});

describe("Concurrent display_no generation", () => {
	it("should assign unique sequential display_no under concurrent requests", async () => {
		const CONCURRENT_COUNT = 20;

		// Fire all requests at once
		const promises = Array.from({ length: CONCURRENT_COUNT }, (_, i) =>
			app.inject({
				method: "POST",
				url: "/api/v1/orders",
				payload: {
					items: [{ name: `Item-${i}`, quantity: 1, unit_price: 1000 }],
				},
			}),
		);

		const responses = await Promise.all(promises);

		// All should succeed
		const successful = responses.filter((r) => r.statusCode === 201);
		expect(successful.length).toBe(CONCURRENT_COUNT);

		// All display_no values should be unique
		const displayNos = successful.map((r) => r.json().data.display_no);
		const uniqueNos = new Set(displayNos);
		expect(uniqueNos.size).toBe(CONCURRENT_COUNT);

		// Should be sequential 1..N
		const sorted = [...displayNos].sort((a, b) => a - b);
		expect(sorted).toEqual(Array.from({ length: CONCURRENT_COUNT }, (_, i) => i + 1));
	});

	it("should not produce duplicate display_no even with same-millisecond inserts", async () => {
		// Rapid sequential creation (tests the transaction boundary)
		const results: number[] = [];
		for (let i = 0; i < 50; i++) {
			const res = await app.inject({
				method: "POST",
				url: "/api/v1/orders",
				payload: {
					items: [{ name: `Fast-${i}`, quantity: 1, unit_price: 500 }],
				},
			});
			expect(res.statusCode).toBe(201);
			results.push(res.json().data.display_no);
		}

		// All unique
		const unique = new Set(results);
		expect(unique.size).toBe(50);

		// Sequential
		expect(results).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
	});
});
