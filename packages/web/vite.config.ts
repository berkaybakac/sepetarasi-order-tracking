import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiUrl = process.env.API_URL ?? "http://localhost:3000";
const wsUrl = apiUrl.replace(/^http/, "ws");

export default defineConfig({
	plugins: [react(), tailwindcss()],
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
	},
});
