import React, { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AdminView } from "./views/admin/AdminView";
import { LoginView } from "./views/admin/LoginView";
import { CustomerDisplay } from "./views/display/CustomerDisplay";
import { useAuthStore } from "./stores/auth.store";
import { api } from "./lib/api";

function RequireAuth({ children }: { children: React.ReactNode }) {
	const { isAdmin, setAuthStatus } = useAuthStore();
	const location = useLocation();

	useEffect(() => {
		if (isAdmin === null) {
			api.authCheck()
				.then(() => setAuthStatus(true))
				.catch(() => setAuthStatus(false));
		}
	}, [isAdmin, setAuthStatus]);

	if (isAdmin === null) {
		return (
			<div className="min-h-screen bg-slate-900 flex items-center justify-center">
				<div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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
