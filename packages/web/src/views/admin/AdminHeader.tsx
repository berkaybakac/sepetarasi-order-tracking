import { useState } from "react";
import { api } from "../../lib/api";
import { logger } from "../../lib/logger";
import { useAuthStore } from "../../stores/auth.store";
import { AdminStatusPanel } from "./header/AdminStatusPanel";
import { AdminTabNav } from "./header/AdminTabNav";
import { PasswordChangeModal } from "./header/PasswordChangeModal";

export function AdminHeader() {
	const { logout } = useAuthStore();
	const [showModal, setShowModal] = useState(false);

	const handleLogout = async () => {
		try {
			await api.authLogout();
		} catch (error) {
			logger.warn("AdminHeader", "Logout request failed; clearing local auth state anyway.", error);
		}
		logout();
	};

	return (
		<>
			<AdminStatusPanel onOpenPasswordModal={() => setShowModal(true)} onLogout={handleLogout}>
				<AdminTabNav />
			</AdminStatusPanel>
			<PasswordChangeModal open={showModal} onClose={() => setShowModal(false)} />
		</>
	);
}
