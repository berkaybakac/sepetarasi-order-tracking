import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/db/migrate.ts", "src/db/seed.ts", "src/server.ts"],
			thresholds: {
				statements: 75,
				lines: 75,
				functions: 75,
				branches: 75,
			},
		},
	},
});
