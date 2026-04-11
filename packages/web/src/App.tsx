import type React from "react";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./lib/api";
import { useAuthStore } from "./stores/auth.store";
import { AdminView } from "./views/admin/AdminView";
import { LoginView } from "./views/admin/LoginView";
import { CustomerDisplay } from "./views/display/CustomerDisplay";

function RequireAuth({ children }: { children: React.ReactNode }) {
	const { isAdmin, setAuthStatus } = useAuthStore();
	const location = useLocation();
	// Sunucuya cookie doğrulaması henüz tamamlanmadı mı?
	const [verifying, setVerifying] = useState(true);

	useEffect(() => {
		api
			.authCheck()
			.then(() => setAuthStatus(true))
			.catch(() => setAuthStatus(false))
			.finally(() => setVerifying(false));
	}, [setAuthStatus]);

	// Auth doğrulaması tamamlanmadan korumalı ekranı render etme.
	if (verifying) {
		return (
			<div className="min-h-screen bg-slate-900 flex items-center justify-center">
				<div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
			</div>
		);
	}

	if (!isAdmin) {
		return <Navigate to="/admin/login" state={{ from: location }} replace />;
	}

	return children;
}

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/admin/login" element={<LoginView />} />
				<Route
					path="/admin/*"
					element={
						<RequireAuth>
							<AdminView />
						</RequireAuth>
					}
				/>
				<Route path="/display" element={<CustomerDisplay />} />
				<Route path="*" element={<Navigate to="/admin" replace />} />
			</Routes>
		</BrowserRouter>
	);
}
