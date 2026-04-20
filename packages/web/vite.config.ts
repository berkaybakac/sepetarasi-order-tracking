import tailwindcss from "@tailwindcss/vite";
import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiUrl = process.env.API_URL ?? "http://localhost:3000";
const wsUrl = apiUrl.replace(/^http/, "ws");
const tb1CompatProxyTarget = {
	target: apiUrl,
	changeOrigin: true,
};

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		legacy({
			targets: ["android >= 4.4", "chrome >= 30", "chromeAndroid >= 30", "safari >= 8"],
			modernPolyfills: true,
			renderLegacyChunks: true,
		}),
	],
	server: {
		proxy: {
			"^/display/index(?:-[^/]+)?\\.html$": tb1CompatProxyTarget,
			"^/(?:display-beacon\\.gif|test\\.html|ping)$": tb1CompatProxyTarget,
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
