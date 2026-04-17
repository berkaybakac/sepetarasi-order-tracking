import tailwindcss from "@tailwindcss/vite";
import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiUrl = process.env.API_URL ?? "http://localhost:3000";
const wsUrl = apiUrl.replace(/^http/, "ws");

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		legacy({
			targets: ["chrome >= 49", "safari >= 10", "firefox >= 52", "edge >= 15"],
			additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
			modernPolyfills: true,
			renderLegacyChunks: true,
		}),
	],
	server: {
		proxy: {
			"/api": apiUrl,
			"/ws": {
				target: wsUrl,
				ws: true,
			},
		},
	},
	build: {
		outDir: "dist",
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules/recharts")) return "charts";
					if (id.includes("node_modules/framer-motion")) return "motion";
					if (id.includes("node_modules/react-router")) return "router";
				},
			},
		},
	},
});
