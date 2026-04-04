import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		electron([
			{
				entry: "electron/main.ts",
				vite: {
					build: {
						outDir: "dist-electron",
					},
				},
			},
			{
				entry: "electron/preload.ts",
				onstart(args) {
					args.reload();
				},
				vite: {
					build: {
						outDir: "dist-electron",
					},
				},
			},
		]),
		renderer(),
	],
	build: {
		outDir: "dist",
	},
});
