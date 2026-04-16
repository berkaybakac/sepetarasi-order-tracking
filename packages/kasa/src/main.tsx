import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { logRendererEvent } from "./lib/electron";
import "./styles/global.css";

window.addEventListener("error", (event) => {
	logRendererEvent({
		level: "error",
		component: "renderer.window",
		event: "renderer.window_error",
		message: "Unhandled renderer error",
		error: event.error ?? event.message,
		context: {
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno,
		},
	});
});

window.addEventListener("unhandledrejection", (event) => {
	logRendererEvent({
		level: "error",
		component: "renderer.window",
		event: "renderer.unhandled_rejection",
		message: "Unhandled renderer promise rejection",
		error: event.reason,
	});
});

// biome-ignore lint/style/noNonNullAssertion: root element always exists in index.html
ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
