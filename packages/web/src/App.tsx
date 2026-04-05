import { AdminView } from "./views/admin/AdminView";
import { DashboardView } from "./views/dashboard/DashboardView";
import { CustomerDisplay } from "./views/display/CustomerDisplay";

function getView(): "dashboard" | "display" | "admin" {
	const path = window.location.pathname;
	if (path.startsWith("/display")) return "display";
	if (path.startsWith("/admin")) return "admin";
	return "dashboard";
}

export default function App() {
	const view = getView();

	switch (view) {
		case "display":
			return <CustomerDisplay />;
		case "admin":
			return <AdminView />;
		default:
			return <DashboardView />;
	}
}
