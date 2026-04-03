import { DashboardView } from "./views/dashboard/DashboardView";
import { CustomerDisplay } from "./views/display/CustomerDisplay";

function getView(): "dashboard" | "display" {
	const path = window.location.pathname;
	if (path.startsWith("/display")) return "display";
	return "dashboard";
}

export default function App() {
	const view = getView();

	switch (view) {
		case "display":
			return <CustomerDisplay />;
		case "dashboard":
		default:
			return <DashboardView />;
	}
}
