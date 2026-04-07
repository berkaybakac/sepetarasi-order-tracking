import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminView } from "./views/admin/AdminView";
import { CustomerDisplay } from "./views/display/CustomerDisplay";

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/admin/*" element={<AdminView />} />
				<Route path="/display" element={<CustomerDisplay />} />
				{/* Varsayılan ana erişimi Admin paneline yönlendir */}
				<Route path="*" element={<Navigate to="/admin" replace />} />
			</Routes>
		</BrowserRouter>
	);
}
