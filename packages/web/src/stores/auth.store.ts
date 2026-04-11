import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
	isAdmin: boolean | null; // null = ilk yükleme, henüz bilinmiyor
	login: () => void;
	logout: () => void;
	setAuthStatus: (status: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			isAdmin: null,
			login: () => set({ isAdmin: true }),
			logout: () => set({ isAdmin: false }),
			setAuthStatus: (status: boolean) => set({ isAdmin: status }),
		}),
		{
			name: "sepetarasi-auth",
			// Sadece isAdmin değerini sakla
			partialize: (state) => ({ isAdmin: state.isAdmin }),
		},
	),
);
