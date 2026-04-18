import type React from "react";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ApiError, api } from "./lib/api";
import { useAuthStore } from "./stores/auth.store";
import { AdminView } from "./views/admin/AdminView";
import { LoginView } from "./views/admin/LoginView";
import { AdminBootSplash } from "./views/admin/ui/LoadingStates";
import { CustomerDisplay } from "./views/display/CustomerDisplay";

const AUTH_CHECK_RETRY_DELAYS_MS = [350, 900, 1800] as const;

function isRecoverableAuthCheckError(error: unknown) {
	return error instanceof ApiError && error.recoverable && error.status !== 401;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
	const { isAdmin, setAuthStatus } = useAuthStore();
	const location = useLocation();
	// Sunucuya cookie doğrulaması henüz tamamlanmadı mı?
	const [verifying, setVerifying] = useState(true);

	useEffect(() => {
		let cancelled = false;
		let retryTimeoutId: number | null = null;

		const verifyAuth = async (attempt = 0) => {
			try {
				await api.authCheck();
				if (cancelled) return;
				setAuthStatus(true);
				setVerifying(false);
			} catch (error) {
				if (cancelled) return;

				if (isRecoverableAuthCheckError(error)) {
					const retryDelay = AUTH_CHECK_RETRY_DELAYS_MS[attempt];
					if (retryDelay !== undefined) {
						retryTimeoutId = window.setTimeout(() => {
							void verifyAuth(attempt + 1);
						}, retryDelay);
						return;
					}

					// Dev reload / transient backend restarts should not force a visible logout.
					if (isAdmin) {
						setVerifying(false);
						return;
					}
				}

				setAuthStatus(false);
				setVerifying(false);
			}
		};

		void verifyAuth();

		return () => {
			cancelled = true;
			if (retryTimeoutId !== null) {
				window.clearTimeout(retryTimeoutId);
			}
		};
	}, [isAdmin, setAuthStatus]);

	// Auth doğrulaması tamamlanmadan korumalı ekranı render etme.
	if (verifying) {
		if (isAdmin) {
			return children;
		}
		return <AdminBootSplash />;
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
				<Route path="/display.html" element={<CustomerDisplay />} />
				<Route path="*" element={<Navigate to="/admin" replace />} />
			</Routes>
		</BrowserRouter>
	);
}
